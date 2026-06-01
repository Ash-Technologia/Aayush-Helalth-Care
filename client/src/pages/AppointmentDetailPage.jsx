import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { appointmentService, paymentService } from '@services';
import styles from './AppointmentDetailPage.module.css';

const STATUS_MAP = {
  awaiting_payment: { label:'Awaiting Payment',  cls:'badge-warning', icon:'⏳' },
  pending_approval: { label:'Under Review',      cls:'badge-info',    icon:'🔍' },
  confirmed:        { label:'Confirmed',         cls:'badge-success', icon:'✅' },
  payment_rejected: { label:'Payment Rejected',  cls:'badge-danger',  icon:'❌' },
  completed:        { label:'Completed',         cls:'badge-primary', icon:'✔' },
  cancelled:        { label:'Cancelled',         cls:'badge-neutral', icon:'🚫' },
  expired:          { label:'Expired',           cls:'badge-neutral', icon:'⌛' },
  no_show:          { label:'No Show',           cls:'badge-danger',  icon:'👻' },
};

const fmt = (str) => str ? new Date(str).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) : '—';

export default function AppointmentDetailPage() {
  const { id } = useParams();

  const { data: appt, isLoading: loadingAppt } = useQuery({
    queryKey: ['appointment', id],
    queryFn:  () => appointmentService.getById(id).then((r) => r.data.data.appointment),
    enabled:  !!id,
  });

  const payment = appt?.paymentSubmission;

  if (loadingAppt) {
    return (
      <div className={`section container ${styles.loading}`}>
        {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:60, borderRadius:12 }} />)}
      </div>
    );
  }

  if (!appt) return (
    <div className="section container" style={{ textAlign:'center' }}>
      <p style={{ color:'var(--text-secondary)' }}>Appointment not found.</p>
      <Link to="/appointments" className="btn btn-secondary" style={{ marginTop:16 }}>← Back</Link>
    </div>
  );

  const status = STATUS_MAP[appt.status] || { label: appt.status, cls:'badge-neutral', icon:'•' };

  return (
    <>
      <Helmet><title>Appointment #{id.slice(-6).toUpperCase()} — Aayush Health Care</title></Helmet>

      <div className={`section ${styles.page}`}>
        <div className="container" style={{ maxWidth:760 }}>
          <Link to="/appointments" className={styles.backLink}>← My Appointments</Link>

          {/* Header */}
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Appointment Details</h1>
              <p className={styles.id}>ID: #{id.slice(-8).toUpperCase()}</p>
            </div>
            <span className={`badge ${status.cls} ${styles.bigBadge}`}>
              {status.icon} {status.label}
            </span>
          </div>

          {/* Details card */}
          <div className={`card ${styles.detailCard}`}>
            <h3 className={styles.sectionHead}>Consultation Info</h3>
            <div className={styles.grid}>
              <div className={styles.field}><span>Date</span><strong>{fmt(appt.appointmentDate)}</strong></div>
              <div className={styles.field}><span>Time</span><strong>{appt.slotStart} – {appt.slotEnd}</strong></div>
              <div className={styles.field}><span>Type</span><strong>{appt.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic'}</strong></div>
              <div className={styles.field}><span>Fee</span><strong>₹{appt.feeSnapshot}</strong></div>
              <div className={styles.field}><span>Patient</span><strong>{appt.patientName}</strong></div>
              <div className={styles.field}><span>Phone</span><strong>{appt.patientPhone || '—'}</strong></div>
              <div className={styles.field}><span>Email</span><strong>{appt.patientEmail || '—'}</strong></div>
              {appt.reason && <div className={`${styles.field} ${styles.wide}`}><span>Reason</span><strong>{appt.reason}</strong></div>}
            </div>
          </div>

          {/* Payment card */}
          {payment && (
            <div className={`card ${styles.detailCard}`}>
              <h3 className={styles.sectionHead}>Payment</h3>
              <div className={styles.grid}>
                <div className={styles.field}><span>Amount</span><strong>₹{payment.amountClaimed}</strong></div>
                <div className={styles.field}><span>Status</span>
                  <span className={`badge ${payment.status === 'approved' ? 'badge-success' : payment.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                    {payment.status}
                  </span>
                </div>
                {payment.upiTransactionId && <div className={styles.field}><span>UPI Ref</span><strong>{payment.upiTransactionId}</strong></div>}
                {payment.rejectionReason && (
                  <div className={`${styles.field} ${styles.wide}`}>
                    <span>Rejection Reason</span>
                    <strong style={{ color:'var(--clr-danger)' }}>{payment.rejectionReason}</strong>
                  </div>
                )}
                {payment.screenshotUrl && (
                  <div className={`${styles.field} ${styles.wide}`}>
                    <span>Screenshot</span>
                    <img src={payment.screenshotUrl} alt="Payment proof" className={styles.screenshot} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WhatsApp join for online confirmed */}
          {appt.status === 'confirmed' && appt.consultationType === 'online' && appt.whatsappJoinLink && (
            <a href={appt.whatsappJoinLink} target="_blank" rel="noreferrer" className={`btn btn-primary ${styles.waBtn}`}>
              💬 Join WhatsApp Consultation
            </a>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            {appt.status === 'completed' && (
              <Link to={`/review/${id}`} className="btn btn-primary">⭐ Leave a Review</Link>
            )}
            {appt.status === 'rejected' && (
              <Link to="/book" className="btn btn-primary">📅 Rebook Appointment</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
