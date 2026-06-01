import { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { selectUser } from '@store/slices/authSlice';
import {
  selectBookingStep, selectSelectedDate, selectSelectedSlot, selectConsultationType,
  setBookingStep, setSelectedDate, setSelectedSlot, setConsultationType, resetBookingFlow,
  nextBookingStep,
} from '@store/slices/uiSlice';
import { slotsService, appointmentService, paymentService, profileService } from '@services';
import styles from './BookingPage.module.css';

// ── Constants ─────────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const APPT_SESSION_KEY = 'ahc_booking_appt';

// ── Appointment persistence helpers ──────────────────────────────
// The Redux slice already persists step/date/slot/type in sessionStorage.
// We mirror `appointment` (created after lock/reschedule) to sessionStorage
// so that a page refresh on step 5 or 6 doesn't produce a blank screen.
const saveAppt = (appt) => {
  try { sessionStorage.setItem(APPT_SESSION_KEY, JSON.stringify(appt)); } catch { /* ignore */ }
};
const loadAppt = () => {
  try {
    const raw = sessionStorage.getItem(APPT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const clearAppt = () => {
  try { sessionStorage.removeItem(APPT_SESSION_KEY); } catch { /* ignore */ }
};

// ── Date helpers ──────────────────────────────────────────────────
const toLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const formatDate = (str) => {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

// ── StepBar ───────────────────────────────────────────────────────
// Normal flow:  1=Type  2=Date  3=Slot  4=Details  5=Payment  6=Done
// Reschedule:   1=Type  2=Date  3=Slot  4=Confirm  (skip 5)   6=Done
//
// Visually we always show 5 dots for reschedule, 6 for normal.
const NORMAL_STEPS = ['Type', 'Date', 'Slot', 'Details', 'Payment', 'Done'];
const RESCHEDULE_STEPS = ['Type', 'Date', 'Slot', 'Confirm', 'Done'];

function StepBar({ current, isRescheduled }) {
  const steps = isRescheduled ? RESCHEDULE_STEPS : NORMAL_STEPS;

  // Map real Redux step (1-6) → visual index (0-based) for reschedule flow:
  //   Redux 1→vis 0, 2→vis 1, 3→vis 2, 4→vis 3, 6→vis 4  (step 5 skipped)
  const toVisualIndex = (reduxStep) => {
    if (!isRescheduled) return reduxStep - 1;
    if (reduxStep <= 4) return reduxStep - 1;
    return 4; // redux step 6 → last visual dot
  };

  const currentVisual = toVisualIndex(current);

  return (
    <div className={styles.stepBar}>
      {steps.map((label, i) => {
        const done = i < currentVisual;
        const active = i === currentVisual;
        return (
          <div key={label} className={styles.stepItem}>
            <div className={`${styles.stepDot} ${done ? styles.done : active ? styles.active : ''}`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`${styles.stepLabel} ${active ? styles.activeLabel : ''}`}>{label}</span>
            {i < steps.length - 1 && (
              <div className={`${styles.stepLine} ${done ? styles.doneLine : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Consultation Type ────────────────────────────────────
function StepType({ type, onChange, onNext }) {
  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Choose Consultation Type</h2>
      <p className={styles.stepSub}>How would you like to consult with Amrut Singhavi?</p>
      <div className={styles.typeGrid}>
        {[
          { val: 'online', icon: '🎥', title: 'Virtual OPD', desc: 'WhatsApp video call — from your home' },
          { val: 'clinic', icon: '🏥', title: 'In-Clinic', desc: 'Visit the clinic in person — Pune' },
        ].map((opt) => (
          <button
            key={opt.val}
            onClick={() => onChange(opt.val)}
            className={`${styles.typeCard} ${type === opt.val ? styles.selected : ''}`}
          >
            <span className={styles.typeIcon}>{opt.icon}</span>
            <strong className={styles.typeTitle}>{opt.title}</strong>
            <span className={styles.typeDesc}>{opt.desc}</span>
            {type === opt.val && <span className={styles.checkBadge}>✓</span>}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={onNext} disabled={!type}>
        Continue →
      </button>
    </div>
  );
}

// ── Step 2: Date Picker ──────────────────────────────────────────
function StepDate({ selectedDate, onChange, onNext, onBack }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => {
    // If a date is already selected, open that month; otherwise open today's month
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDow = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handleDay = (d) => {
    if (!d) return;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date < todayMidnight || date > maxDate || date.getDay() === 0) return;
    onChange(toLocalDate(date));
  };

  const prevMonth = () => {
    const limit = new Date(today.getFullYear(), today.getMonth(), 1);
    if (viewDate <= limit) return;
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    const limit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    if (viewDate >= limit) return;
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Select a Date</h2>
      <p className={styles.stepSub}>Available Mon–Sat. Sundays are closed.</p>

      <div className={styles.calendar}>
        <div className={styles.calHeader}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
          <strong>{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</strong>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
        </div>
        <div className={styles.calDays}>
          {DAYS.map((d) => <div key={d} className={styles.calDayName}>{d}</div>)}
        </div>
        <div className={styles.calGrid}>
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
            const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const dateStr = toLocalDate(date);
            const disabled = date < todayMidnight || date > maxDate || date.getDay() === 0;
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={d}
                onClick={() => !disabled && handleDay(d)}
                disabled={disabled}
                className={`${styles.calCell} ${isSelected ? styles.calSelected : ''} ${disabled ? styles.calDisabled : ''}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && <div className={styles.selectedInfo}>📅 {formatDate(selectedDate)}</div>}

      <div className={styles.navBtns}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={!selectedDate}>Continue →</button>
      </div>
    </div>
  );
}

// ── Step 3: Slot Picker ──────────────────────────────────────────
function StepSlot({ date, type, selectedSlot, onChange, onNext, onBack }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['slots', date, type],
    queryFn: () => slotsService.getAvailability(date, type).then((r) => r.data),
    enabled: !!date && !!type,
  });

  const slots = data?.slots || [];

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Pick a Time Slot</h2>
      <p className={styles.stepSub}>{formatDate(date)} — {type === 'online' ? '🎥 Online' : '🏥 In-Clinic'}</p>

      {isLoading && (
        <div className={styles.slotsLoading}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {error && (
        <p className={styles.errorText}>Failed to load slots. Please go back and try again.</p>
      )}

      {!isLoading && slots.length === 0 && !error && (
        <div className={styles.emptySlots}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>
            {data?.reason === 'emergency' ? '🚨' : data?.reason === 'holiday' ? '🌴' : '😔'}
          </span>
          <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {data?.message || 'No available slots on this date. Please go back and select another date.'}
          </p>
        </div>
      )}

      {slots.length > 0 && (
        <div className={styles.slotsGrid}>
          {slots.map((slot) => {
            const isSelected = selectedSlot?.slotStart === slot.slotStart;
            return (
              <button
                key={slot.slotStart}
                onClick={() => onChange(slot)}
                className={`${styles.slotBtn} ${isSelected ? styles.slotSelected : ''}`}
              >
                <span className={styles.slotTime}>{slot.slotStart}</span>
                <span className={styles.slotDash}>–</span>
                <span className={styles.slotTime}>{slot.slotEnd}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.navBtns}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={!selectedSlot}>Continue →</button>
      </div>
    </div>
  );
}

// ── Step 4: Patient Details / Reschedule Confirmation ───────────
function StepDetails({ form, onChange, onNext, onBack, loading, isRescheduled }) {
  const handleChange = (e) => onChange({ ...form, [e.target.name]: e.target.value });
  const allFilled = form.patientName.trim() && form.patientPhone.trim() && form.patientEmail.trim() && form.reason.trim();

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>{isRescheduled ? 'Confirm Reschedule' : 'Your Details'}</h2>
      <p className={styles.stepSub}>
        {isRescheduled
          ? 'Confirm your details and slot to complete rescheduling.'
          : 'Confirm your contact information for this appointment.'}
      </p>

      <div className={styles.formGrid}>
        <div className="form-group">
          <label className="form-label" htmlFor="patientName">Full Name *</label>
          <input id="patientName" name="patientName" className="form-input"
            value={form.patientName} onChange={handleChange}
            placeholder="Your full name" required disabled={isRescheduled} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="patientPhone">Mobile Number *</label>
          <input id="patientPhone" name="patientPhone" className="form-input"
            value={form.patientPhone} onChange={handleChange}
            placeholder="10-digit mobile" inputMode="numeric" required disabled={isRescheduled} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label" htmlFor="patientEmail">Email Address *</label>
          <input id="patientEmail" name="patientEmail" className="form-input"
            value={form.patientEmail} onChange={handleChange}
            placeholder="email@example.com" type="email" required disabled={isRescheduled} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">
            Reason for Consultation *
          </label>

          <div className={styles.reasonOptions}>
            {[
              'Diabetes',
              'Asthma',
              'Back Pain',
              'Kidney Stone',
              'Constipation',
              'Others',
            ].map((option) => (
              <label key={option} className={styles.reasonCard}>
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={form.reason === option}
                  onChange={handleChange}
                  required
                  disabled={isRescheduled}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          {form.reason === 'Others' && (
            <input
              type="text"
              name="reason"
              className="form-input"
              placeholder="Please specify your issue"
              value={form.reason === 'Others' ? '' : form.reason}
              onChange={handleChange}
              disabled={isRescheduled}
              style={{ marginTop: '12px' }}
            />
          )}
        </div>
      </div>

      <div className={styles.navBtns}>
        <button className="btn btn-secondary" onClick={onBack} disabled={loading}>← Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={!allFilled || loading}>
          {loading ? (
            <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              {isRescheduled ? ' Rescheduling…' : ' Reserving…'}</>
          ) : (
            isRescheduled ? 'Confirm & Reschedule ✓' : 'Continue →'
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 5: Payment ──────────────────────────────────────────────
function StepPayment({ profile, appointment, onNext, onBack }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [upiRef, setUpiRef] = useState('');
  const [waSent, setWaSent] = useState(false);
  const [submitting, setSub] = useState(false);

  // ── Guard: appointment must exist (e.g. after page refresh) ──
  if (!appointment) {
    return (
      <div className={styles.stepContent} style={{ alignItems: 'center', textAlign: 'center', gap: 20 }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2 className={styles.stepTitle}>Session Expired</h2>
        <p className={styles.stepSub}>
          Your booking session was lost (likely a page refresh). Please start over.
        </p>
        <button className="btn btn-primary" onClick={onBack}>← Start Over</button>
      </div>
    );
  }

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file) return toast.error('Please upload your payment screenshot.');
    if (!waSent) return toast.error('Please confirm you have sent the screenshot on WhatsApp.');

    setSub(true);
    try {
      const fd = new FormData();
      fd.append('appointmentId', appointment._id);
      fd.append('screenshot', file);
      fd.append('amountClaimed', appointment.feeSnapshot || profile?.consultationFee || 500);
      fd.append('whatsappSentConfirmed', true);
      if (upiRef) fd.append('upiTransactionId', upiRef);
      await paymentService.submit(fd);
      onNext();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit payment. Try again.');
    } finally {
      setSub(false);
    }
  };

  const fee = appointment.feeSnapshot || profile?.consultationFee || 500;
  const upiId = appointment.payment?.upiId || 'aayushhealth@upi';
  const qrUrl = appointment.payment?.qrImageUrl;
  const resolvedQrUrl = qrUrl
    ? (qrUrl.startsWith('http') ? qrUrl : qrUrl.startsWith('/') ? qrUrl : `/${qrUrl}`)
    : '';

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Complete Payment</h2>
      <p className={styles.stepSub}>Pay ₹{fee} via UPI, then upload your screenshot.</p>

      <div className={styles.paymentGrid}>
        {/* QR Card */}
        <div className={`card ${styles.qrCard}`}>
          <div className={styles.payAmount}>₹{fee}</div>
          <div className={styles.payUpi}>{upiId}</div>
          {resolvedQrUrl
            ? <img src={resolvedQrUrl} alt="QR Code" className={styles.qrImage} />
            : (
              <div className={styles.qrPlaceholder}>
                <span>📱</span>
                <p>QR Code will appear here<br />after admin uploads it</p>
              </div>
            )
          }
          <p className={styles.qrHint}>{appointment.payment?.instructions || 'Pay exact amount. Screenshot required.'}</p>
        </div>

        {/* Upload Card */}
        <div className={styles.uploadCard}>
          <div className="form-group">
            <label className="form-label">Upload Payment Screenshot *</label>
            <label className={styles.fileLabel} htmlFor="screenshot">
              {preview
                ? <img src={preview} alt="Preview" className={styles.previewImg} />
                : <>
                  <span className={styles.fileIcon}>📸</span>
                  <span>Click to upload screenshot</span>
                  <span className={styles.fileHint}>PNG, JPG, WEBP — max 5MB</span>
                </>
              }
              <input id="screenshot" type="file" accept="image/*"
                onChange={handleFile} className={styles.fileInput} />
            </label>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="upiRef">
              UPI Transaction ID{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input id="upiRef" className="form-input" value={upiRef}
              onChange={(e) => setUpiRef(e.target.value)}
              placeholder="12-digit UPI ref number" />
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={waSent} onChange={(e) => setWaSent(e.target.checked)} />
            <span>
              I have also sent the screenshot on WhatsApp to{' '}
              <strong>{profile?.whatsappNumber || '9822843015'}</strong>
            </span>
          </label>
        </div>
      </div>

      <div className={styles.navBtns}>
        <button className="btn btn-secondary" onClick={onBack} disabled={submitting}>← Back</button>
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={submitting || !file || !waSent}>
          {submitting
            ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Submitting…</>
            : '✓ Submit Payment'}
        </button>
      </div>
    </div>
  );
}

// ── Step 6: Confirmation ─────────────────────────────────────────
function StepDone({ appointment, onReset, isRescheduled }) {
  const navigate = useNavigate();

  return (
    <div className={`${styles.stepContent} ${styles.doneStep}`}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <div className={styles.doneIcon}>✅</div>
      </motion.div>

      <h2 className={styles.doneTitle}>
        {isRescheduled ? 'Appointment Rescheduled!' : 'Payment Submitted!'}
      </h2>
      <p className={styles.doneSub}>
        {isRescheduled
          ? 'Your appointment has been successfully rescheduled. Our team has been notified and your calendar updated.'
          : "Your payment screenshot has been submitted. Our team will verify and confirm your appointment. You'll receive an email & SMS within a few minutes."}
      </p>

      {appointment && (
        <div className={`card ${styles.doneCard}`}>
          <div className={styles.doneRow}>
            <span>Appointment ID</span>
            <strong>#{appointment._id?.slice(-8).toUpperCase()}</strong>
          </div>
          <div className={styles.doneRow}>
            <span>Date</span>
            <strong>{formatDate(appointment.appointmentDate?.split?.('T')[0] || appointment.appointmentDate)}</strong>
          </div>
          <div className={styles.doneRow}>
            <span>Time</span>
            <strong>{appointment.slotStart} – {appointment.slotEnd}</strong>
          </div>
          <div className={styles.doneRow}>
            <span>Type</span>
            <strong>{appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic'}</strong>
          </div>
          <div className={styles.doneRow}>
            <span>Status</span>
            <span className={`badge ${isRescheduled && appointment.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>
              {isRescheduled && appointment.status === 'confirmed' ? '✅ Confirmed' : '⏳ Pending Verification'}
            </span>
          </div>
        </div>
      )}

      <div className={styles.doneActions}>
        <button className="btn btn-primary" onClick={() => navigate('/appointments')}>
          View My Appointments
        </button>
        {!isRescheduled && (
          <button className="btn btn-secondary" onClick={onReset}>Book Another</button>
        )}
      </div>
    </div>
  );
}

// ── BookingPage (root) ────────────────────────────────────────────
export default function BookingPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const step = useSelector(selectBookingStep);
  const date = useSelector(selectSelectedDate);
  const slot = useSelector(selectSelectedSlot);
  const type = useSelector(selectConsultationType);
  const [searchParams] = useSearchParams();
  const rescheduleId = searchParams.get('reschedule');

  // ── Form state ──────────────────────────────────────────────────
  const [form, setForm] = useState({
    patientName: user?.fullName || '',
    patientPhone: user?.phone || '',
    patientEmail: user?.email || '',
    reason: '',
  });

  // ── Appointment state — persisted in sessionStorage ─────────────
  // This is the single fix for the blank-screen-on-refresh bug.
  // After a lock or reschedule succeeds, we save the appointment object
  // to sessionStorage. On mount we restore it, so step 5/6 always has data.
  const [appointment, setAppointment] = useState(() => loadAppt());

  const persistAppt = useCallback((appt) => {
    setAppointment(appt);
    saveAppt(appt);
  }, []);

  // ── Doctor profile ──────────────────────────────────────────────
  const { data: profileData } = useQuery({
    queryKey: ['doctorProfile'],
    queryFn: () => profileService.getDoctorProfile().then((r) => r.data.data),
  });
  const profile = profileData;

  // ── Load old appointment for reschedule ──────────────────────────
  const { data: oldAppt } = useQuery({
    queryKey: ['appointment', rescheduleId],
    queryFn: () => appointmentService.getById(rescheduleId).then((r) => r.data.data.appointment),
    enabled: !!rescheduleId,
  });

  useEffect(() => {
    if (oldAppt) {
      setForm({
        patientName: oldAppt.patientName || user?.fullName || '',
        patientPhone: oldAppt.patientPhone || user?.phone || '',
        patientEmail: oldAppt.patientEmail || user?.email || '',
        reason: oldAppt.reason || '',
      });
      dispatch(setConsultationType(oldAppt.consultationType));
    }
  }, [oldAppt, user, dispatch]);

  // ── Browser back-button guard ────────────────────────────────────
  // When the user presses the browser back button while mid-flow, we
  // intercept it and go to the previous booking step instead of leaving
  // the page. On step 1 (or step 6 = done), we allow the real navigation.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => {
    // Push a history entry so we have something to intercept
    window.history.pushState({ bookingPage: true }, '');

    const handlePopState = (e) => {
      const currentStep = stepRef.current;

      // Allow normal back navigation from step 1 or the Done screen
      if (currentStep <= 1 || currentStep === 6) {
        // Let it navigate away, but clean up state first
        dispatch(resetBookingFlow());
        clearAppt();
        return;
      }

      // Otherwise: prevent leaving, go back one booking step
      e.preventDefault();
      window.history.pushState({ bookingPage: true }, ''); // re-push so back still works
      dispatch(setBookingStep(currentStep - 1));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch]); // intentionally only runs once on mount

  // ── Cleanup on unmount if flow is incomplete ─────────────────────
  // If user navigates away mid-flow (not via browser back, e.g. clicking
  // a nav link), reset the session so next visit starts fresh.
  // We do NOT reset if on the Done step (step 6) — that's a completed flow.
  const unmountStepRef = useRef(step);
  useEffect(() => { unmountStepRef.current = step; }, [step]);

  useEffect(() => {
    return () => {
      const s = unmountStepRef.current;
      // If they leave mid-flow (not done), reset so next visit is clean
      if (s > 1 && s < 6) {
        dispatch(resetBookingFlow());
        clearAppt();
      }
      // If they completed (step 6), also reset so next visit starts fresh
      if (s === 6) {
        dispatch(resetBookingFlow());
        clearAppt();
      }
    };
  }, [dispatch]); // intentionally only runs on unmount

  // ── Lock slot mutation ───────────────────────────────────────────
  const lockMutation = useMutation({
    mutationFn: (data) => appointmentService.lockSlot(data),
    onSuccess: (res) => {
      const lockData = res.data.data;
      const appt = {
        _id: lockData.appointmentId,
        appointmentDate: date,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        consultationType: type,
        feeSnapshot: lockData.fee,
        payment: lockData.payment,
      };
      persistAppt(appt);
      dispatch(nextBookingStep()); // → step 5
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Slot unavailable. Please pick another.'),
  });

  // ── Reschedule mutation ──────────────────────────────────────────
  const rescheduleMutation = useMutation({
    mutationFn: (data) => appointmentService.reschedule(rescheduleId, data),
    onSuccess: (res) => {
      const resData = res.data.data;
      const appt = {
        _id: resData.appointmentId,
        appointmentDate: date,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        consultationType: type,
        feeSnapshot: oldAppt?.feeSnapshot || profile?.consultationFee || 500,
        status: resData.status,
      };
      persistAppt(appt);
      dispatch(setBookingStep(6)); // skip payment step
      toast.success('Appointment rescheduled successfully! 📅');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reschedule. Please select another slot.'),
  });

  // ── Handlers ─────────────────────────────────────────────────────
  const handleLockSlot = useCallback(() => {
    lockMutation.mutate({
      date,
      slotStart: slot.slotStart,
      slotEnd: slot.slotEnd,
      consultationType: type,
      patientName: form.patientName,
      patientPhone: form.patientPhone,
      patientEmail: form.patientEmail,
      reason: form.reason,
    });
  }, [date, slot, type, form, lockMutation]);

  const handleReschedule = useCallback(() => {
    rescheduleMutation.mutate({
      date,
      slotStart: slot.slotStart,
      slotEnd: slot.slotEnd,
      consultationType: type,
    });
  }, [date, slot, type, rescheduleMutation]);

  const handleStep4Next = useCallback(() => {
    const { patientName, patientPhone, patientEmail, reason } = form;
    if (!patientName.trim() || !patientPhone.trim() || !patientEmail.trim() || !reason.trim()) {
      toast.error('All fields (Name, Phone, Email, Reason) are required.');
      return;
    }
    if (rescheduleId) handleReschedule();
    else handleLockSlot();
  }, [form, rescheduleId, handleReschedule, handleLockSlot]);

  const handleReset = () => {
    dispatch(resetBookingFlow());
    clearAppt();
    setAppointment(null);
    setForm({
      patientName: user?.fullName || '',
      patientPhone: user?.phone || '',
      patientEmail: user?.email || '',
      reason: '',
    });
  };

  const go = (n) => dispatch(setBookingStep(n));

  // ── Slide animation ──────────────────────────────────────────────
  const prevStepRef = useRef(step);
  const [direction, setDirection] = useState(1);
  useEffect(() => {
    setDirection(step > prevStepRef.current ? 1 : -1);
    prevStepRef.current = step;
  }, [step]);

  const slideVariants = {
    hidden: (dir) => ({ opacity: 0, x: dir * 40 }),
    visible: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir * -40 }),
  };

  return (
    <>
      <Helmet>
        <title>
          {rescheduleId ? 'Reschedule Appointment' : 'Book Appointment'} — Aayush Health Care
        </title>
        <meta name="description"
          content="Book or reschedule an Ayurvedic consultation with Amrut Singhavi. Online or in-clinic." />
      </Helmet>

      <div className={styles.page}>
        <div className="container">
          <div className={styles.pageHeader}>
            <h1 className="heading-display heading-2">
              {rescheduleId ? 'Reschedule Consultation' : 'Book a Consultation'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Amrut Singhavi — Acupressure & Neurotherapy Specialist
            </p>
          </div>

          {step < 6 && <StepBar current={step} isRescheduled={!!rescheduleId} />}

          <div className={styles.cardWrap}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
              >
                {step === 1 && (
                  <StepType
                    type={type}
                    onChange={(v) => dispatch(setConsultationType(v))}
                    onNext={() => go(2)}
                  />
                )}

                {step === 2 && (
                  <StepDate
                    selectedDate={date}
                    onChange={(d) => dispatch(setSelectedDate(d))}
                    onNext={() => go(3)}
                    onBack={() => go(1)}
                  />
                )}

                {step === 3 && (
                  <StepSlot
                    date={date}
                    type={type}
                    selectedSlot={slot}
                    onChange={(s) => dispatch(setSelectedSlot(s))}
                    onNext={() => go(4)}
                    onBack={() => go(2)}
                  />
                )}

                {step === 4 && (
                  <StepDetails
                    form={form}
                    onChange={setForm}
                    onBack={() => go(3)}
                    loading={lockMutation.isPending || rescheduleMutation.isPending}
                    isRescheduled={!!rescheduleId}
                    onNext={handleStep4Next}
                  />
                )}

                {step === 5 && (
                  <StepPayment
                    profile={profile}
                    appointment={appointment}
                    onBack={() => {
                      // Going back from payment cancels the locked slot flow.
                      // Reset appointment so a fresh lock is created on re-submit.
                      persistAppt(null);
                      clearAppt();
                      go(4);
                    }}
                    onNext={() => go(6)}
                  />
                )}

                {step === 6 && (
                  <StepDone
                    appointment={appointment}
                    onReset={handleReset}
                    isRescheduled={!!rescheduleId}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}