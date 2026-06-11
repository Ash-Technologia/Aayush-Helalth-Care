import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminService } from '@services';
import styles from './AdminAppointmentsPage.module.css';

export default function AdminAppointmentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState(''); // empty means 'all'
  const [typeFilter, setTypeFilter] = useState(''); // empty means 'all'
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Fetch appointments with full filters
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['adminAppointments', statusFilter, typeFilter, dateFilter, searchTerm, page],
    queryFn: async () => {
      const res = await adminService.listAppointments({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        date: dateFilter || undefined,
        search: searchTerm || undefined,
        page,
        limit: 10,
      });
      return res.data.data;
    },
  });

  // Mutate Complete
  const completeMutation = useMutation({
    mutationFn: (id) => adminService.completeAppt(id),
    onSuccess: () => {
      toast.success('Appointment marked as Completed.');
      queryClient.invalidateQueries(['adminAppointments']);
      queryClient.invalidateQueries(['adminDashboard']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Action failed.';
      toast.error(msg);
    },
  });

  // Mutate No-Show
  const noShowMutation = useMutation({
    mutationFn: (id) => adminService.noShowAppt(id),
    onSuccess: () => {
      toast.success('Appointment marked as Patient No-Show.');
      queryClient.invalidateQueries(['adminAppointments']);
      queryClient.invalidateQueries(['adminDashboard']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Action failed.';
      toast.error(msg);
    },
  });

  // Mutate Cancel
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => adminService.cancelAppt(id, reason),
    onSuccess: () => {
      toast.success('Appointment cancelled successfully.');
      setCancellingId(null);
      setCancelReason('');
      queryClient.invalidateQueries(['adminAppointments']);
      queryClient.invalidateQueries(['adminDashboard']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Cancellation failed.';
      toast.error(msg);
    },
  });

  const handleCancelSubmit = (e) => {
    e.preventDefault();
    cancelMutation.mutate({ id: cancellingId, reason: cancelReason });
  };

  const handleResetFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setDateFilter('');
    setSearchTerm('');
    setPage(1);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'confirmed': return 'status-confirmed';
      case 'pending_approval': return 'status-pending';
      case 'awaiting_payment': return 'status-pending';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      case 'payment_rejected': return 'status-rejected';
      case 'no_show': return 'status-rejected';
      default: return 'status-expired';
    }
  };

  const getStatusLabel = (status) => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <>
      <Helmet>
        <title>Manage Appointments — Aayush Health Care</title>
      </Helmet>

      <div className="page-enter">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Consultation Bookings</h1>
            <p className={styles.subtitle}>Track, cancel, complete, and search through patient appointments.</p>
          </div>
          <div>
            <button onClick={handleResetFilters} className="btn btn-secondary btn-sm">
              Clear All Filters
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className={styles.filterGrid}>
          <div className="form-group">
            <label className="form-label" htmlFor="search">Search Patient</label>
            <input
              id="search"
              type="text"
              className="form-input"
              placeholder="Name, phone, or email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="status">Filter Status</label>
            <select
              id="status"
              className="form-input"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ background: 'var(--bg-elevated)' }}
            >
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
              <option value="payment_rejected">Payment Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="type">Filter Type</label>
            <select
              id="type"
              className="form-input"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              style={{ background: 'var(--bg-elevated)' }}
            >
              <option value="">All Types</option>
              <option value="online">Online Consultation</option>
              <option value="clinic">In-Clinic Consultation</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="date">Filter Date</label>
            <input
              id="date"
              type="date"
              className="form-input"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className="spinner" />
            <p>Loading bookings ledger...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>Failed to retrieve bookings list.</p>
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm">Try Again</button>
          </div>
        ) : data?.appointments.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <p>No bookings match the filter criteria.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient Info</th>
                  <th>Appointment Time</th>
                  <th>Type</th>
                  <th>Fee Snapshot</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.appointments.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <div className={styles.patientCell}>
                        <div className={styles.name}>{a.patientName}</div>
                        <div className={styles.meta}>
                          <span>📞 {a.patientPhone}</span>
                          {a.patientEmail && <span style={{ marginLeft: 8 }}>✉️ {a.patientEmail}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.timeCell}>
                        <div className={styles.date}>{formatDate(a.appointmentDate)}</div>
                        <div className={styles.slotTime}>🕗 {a.slotStart} - {a.slotEnd}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${a.consultationType === 'online' ? 'badge-primary' : 'badge-neutral'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        {a.consultationType}
                      </span>
                    </td>
                    <td>
                      <span className={styles.feeText}>₹{a.feeSnapshot}</span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(a.status)}`} style={{ fontSize: '0.75rem' }}>
                        {getStatusLabel(a.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actionButtons}>
                        {a.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => {
                                if (window.confirm('Mark this appointment as Completed?')) {
                                  completeMutation.mutate(a._id);
                                }
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--clr-success)' }}
                              disabled={completeMutation.isPending || noShowMutation.isPending}
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Mark this appointment as Patient No-Show?')) {
                                  noShowMutation.mutate(a._id);
                                }
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--text-muted)' }}
                              disabled={completeMutation.isPending || noShowMutation.isPending}
                            >
                              No-Show
                            </button>
                            <button
                              onClick={() => setCancellingId(a._id)}
                              className="btn btn-danger btn-sm"
                              disabled={completeMutation.isPending || noShowMutation.isPending}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {(a.status === 'pending_approval' || a.status === 'awaiting_payment') && (
                          <Link to="/admin/payments" className="btn btn-primary btn-sm">
                            Review Payment
                          </Link>
                        )}
                        {a.consultationType === 'online' && a.whatsappJoinLink && a.status === 'confirmed' && (
                          <a
                            href={a.whatsappJoinLink}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#25D366' }}
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
            >
              &larr; Prev
            </button>
            <span className={styles.pageIndicator}>
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="btn btn-secondary btn-sm"
            >
              Next &rarr;
            </button>
          </div>
        )}

        {/* Cancel Modal */}
        <AnimatePresence>
          {cancellingId && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={styles.dialogContent}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
              >
                <div className={styles.modalHeader}>
                  <h3>Cancel Appointment</h3>
                  <button className={styles.closeBtn} onClick={() => setCancellingId(null)}>&times;</button>
                </div>
                <form onSubmit={handleCancelSubmit}>
                  <div className={styles.dialogBody}>
                    <p className={styles.warningMessage}>
                      Are you sure you want to cancel this appointment? An email and SMS notification
                      will be sent to the patient detailing this cancellation.
                    </p>
                    <div className="form-group" style={{ marginTop: 16 }}>
                      <label className="form-label" htmlFor="cancelReason">Cancellation Reason</label>
                      <textarea
                        id="cancelReason"
                        className="form-input"
                        rows="4"
                        placeholder="e.g. Doctor is unavailable due to an emergency. Slot cancelled."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        required
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>
                  <div className={styles.modalFooter}>
                    <button
                      type="button"
                      onClick={() => setCancellingId(null)}
                      className="btn btn-secondary btn-sm"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="btn btn-danger btn-sm"
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Appointment'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
