import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { appointmentService } from '@services';
import styles from './MyAppointmentsPage.module.css';

const STATUS_MAP = {
  awaiting_payment: { label: 'Awaiting Payment', cls: 'badge-warning' },
  pending_approval: { label: 'Under Review',     cls: 'badge-info'    },
  confirmed:        { label: 'Confirmed',        cls: 'badge-success' },
  payment_rejected: { label: 'Rejected',         cls: 'badge-danger'  },
  completed:        { label: 'Completed',        cls: 'badge-primary' },
  cancelled:        { label: 'Cancelled',        cls: 'badge-neutral' },
  expired:          { label: 'Expired',          cls: 'badge-neutral' },
  no_show:          { label: 'No Show',          cls: 'badge-danger'  },
};

function AppointmentCard({ appt }) {
  const status = STATUS_MAP[appt.status] || { label: appt.status, cls: 'badge-neutral' };
  const canReschedule = ['awaiting_payment', 'pending_approval', 'confirmed'].includes(appt.status);
  const apptDate = appt.appointmentDate ? new Date(appt.appointmentDate.split('T')[0] + 'T00:00:00') : new Date();

  return (
    <motion.div
      className={`card ${styles.apptCard}`}
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.3 }}
    >
      <div className={styles.cardTop}>
        <div className={styles.dateBlock}>
          <span className={styles.dateDay}>{apptDate.getDate()}</span>
          <span className={styles.dateMon}>{apptDate.toLocaleString('en-IN',{month:'short'})}</span>
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardTime}>{appt.slotStart} – {appt.slotEnd}</div>
          <div className={styles.cardType}>
            {appt.consultationType === 'online' ? '🎥 Online Consultation' : '🏥 In-Clinic Visit'}
          </div>
          <div className={styles.cardPatient}>{appt.patientName}</div>
        </div>
        <span className={`badge ${status.cls} ${styles.statusBadge}`}>{status.label}</span>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.cardFee}>₹{appt.feeSnapshot}</span>
        <div className={styles.cardActions}>
          <Link to={`/appointments/${appt._id}`} className="btn btn-secondary btn-sm">View Details</Link>
          {appt.status === 'locked' && (
            <Link to="/book" className="btn btn-primary btn-sm">Complete Payment</Link>
          )}
          {appt.status === 'completed' && (
            <Link to={`/review/${appt._id}`} className="btn btn-ghost btn-sm">Leave Review ⭐</Link>
          )}
          {canReschedule && (
            <Link to={`/book?reschedule=${appt._id}`} className="btn btn-primary btn-sm">Reschedule</Link>
          )}
        </div>
      </div>

      {appt.status === 'confirmed' && appt.consultationType === 'online' && appt.whatsappJoinLink && (
        <a href={appt.whatsappJoinLink} target="_blank" rel="noreferrer"
          className={`btn btn-primary btn-sm ${styles.waBtn}`}>
          💬 Join WhatsApp Consultation
        </a>
      )}
    </motion.div>
  );
}

export default function MyAppointmentsPage() {
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['myAppointments'],
    queryFn:  () => appointmentService.getMyList().then((r) => r.data.data),
  });

  const allAppts = data?.appointments || [];
  const filtered = filter === 'all' ? allAppts : allAppts.filter((a) => a.status === filter);

  const FILTERS = [
    { val:'all',       label:'All' },
    { val:'confirmed', label:'Confirmed' },
    { val:'submitted', label:'Under Review' },
    { val:'completed', label:'Completed' },
    { val:'cancelled', label:'Cancelled' },
  ];

  return (
    <>
      <Helmet>
        <title>My Appointments — Aayush Health Care</title>
      </Helmet>

      <div className={`section ${styles.page}`}>
        <div className="container">
          <div className={styles.pageHeader}>
            <div>
              <h1 className="heading-display heading-2" style={{ color:'var(--text-primary)' }}>My Appointments</h1>
              <p style={{ color:'var(--text-secondary)', marginTop:6 }}>Track and manage your consultations.</p>
            </div>
            <Link to="/book" className="btn btn-primary">+ Book New</Link>
          </div>

          {/* Filter tabs */}
          <div className={styles.filterRow}>
            {FILTERS.map((f) => (
              <button key={f.val} onClick={() => setFilter(f.val)}
                className={`${styles.filterBtn} ${filter===f.val ? styles.activeFilter : ''}`}>
                {f.label}
                {f.val !== 'all' && <span className={styles.filterCount}>
                  {allAppts.filter(a => a.status === f.val).length}
                </span>}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className={styles.skeletonList}>
              {[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:120, borderRadius:16 }} />)}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className={styles.empty}>
              <span>📅</span>
              <p>{filter === 'all' ? "You haven't booked any appointments yet." : `No ${filter} appointments.`}</p>
              {filter === 'all' && <Link to="/book" className="btn btn-primary">Book Your First Appointment</Link>}
            </div>
          )}

          <div className={styles.list}>
            {filtered.map((a) => (
              <AppointmentCard key={a._id} appt={a} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
