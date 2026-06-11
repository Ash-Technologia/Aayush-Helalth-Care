import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminService } from '@services';
import { resolveBackendAssetUrl } from '@services/api';
import styles from './AdminPaymentsPage.module.css';

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch payments
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['adminPayments', statusFilter, searchTerm, page],
    queryFn: async () => {
      const res = await adminService.listPayments({
        status: statusFilter,
        search: searchTerm || undefined,
        page,
        limit: 10,
      });
      return res.data.data;
    },
  });

  // Mutate approve
  const approveMutation = useMutation({
    mutationFn: (id) => adminService.approvePayment(id),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Payment approved and slot confirmed!');
      queryClient.invalidateQueries(['adminPayments']);
      queryClient.invalidateQueries(['adminDashboard']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Approval failed.';
      toast.error(msg);
    },
  });

  // Mutate reject
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => adminService.rejectPayment(id, reason),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Payment rejected.');
      setRejectingId(null);
      setRejectionReason('');
      queryClient.invalidateQueries(['adminPayments']);
      queryClient.invalidateQueries(['adminDashboard']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Rejection failed.';
      toast.error(msg);
    },
  });

  const handleApprove = (id) => {
    if (window.confirm('Are you sure you want to approve this payment? This will confirm the appointment booking.')) {
      approveMutation.mutate(id);
    }
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (rejectionReason.trim().length < 10) {
      toast.error('Rejection reason must be at least 10 characters.');
      return;
    }
    rejectMutation.mutate({ id: rejectingId, reason: rejectionReason });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getFullImageUrl = (url) => {
    return resolveBackendAssetUrl(url);
  };

  return (
    <>
      <Helmet>
        <title>Manage Payments — Aayush Health Care</title>
      </Helmet>

      <div className="page-enter">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Payment Verifications</h1>
            <p className={styles.subtitle}>Review manual UPI screenshot uploads to confirm appointment slots.</p>
          </div>
          <div className={styles.filterBar}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${statusFilter === 'submitted' ? styles.tabActive : ''}`}
                onClick={() => { setStatusFilter('submitted'); setPage(1); }}
              >
                Pending Review
              </button>
              <button
                className={`${styles.tab} ${statusFilter === 'approved' ? styles.tabActive : ''}`}
                onClick={() => { setStatusFilter('approved'); setPage(1); }}
              >
                Approved
              </button>
              <button
                className={`${styles.tab} ${statusFilter === 'rejected' ? styles.tabActive : ''}`}
                onClick={() => { setStatusFilter('rejected'); setPage(1); }}
              >
                Rejected
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className={styles.searchRow}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by patient name, phone, or email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>

        {/* Content Table */}
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className="spinner" />
            <p>Fetching payment transactions...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>Failed to load payments.</p>
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm">Try Again</button>
          </div>
        ) : data?.submissions?.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💳</div>
            <p>No payments found matching the selection criteria.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient / User</th>
                  <th>Appointment Details</th>
                  <th>Fee Check</th>
                  <th>Screenshot Receipt</th>
                  <th>Submitted At</th>
                  {statusFilter === 'rejected' && <th>Rejection Reason</th>}
                  {statusFilter === 'submitted' && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className={styles.patientCell}>
                        <div className={styles.name}>{s.appointment?.patientName || s.user?.fullName}</div>
                        <div className={styles.contact}>
                          {s.appointment?.patientPhone || s.user?.phone}
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.appointment ? (
                        <div className={styles.apptCell}>
                          <span className="badge badge-primary" style={{ fontSize: '0.75rem', marginBottom: 4, textTransform: 'uppercase' }}>
                            {s.appointment.consultationType}
                          </span>
                          <div>{formatDate(s.appointment.appointmentDate)}</div>
                          <div className={styles.time}>{s.appointment.slotStart} - {s.appointment.slotEnd}</div>
                        </div>
                      ) : (
                        <span className={styles.mutedText}>N/A</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.feeCell}>
                        <div>Claimed: <strong>₹{s.amountClaimed}</strong></div>
                        <div className={styles.expectedFee}>Required: ₹{s.appointment?.feeSnapshot || 'N/A'}</div>
                        {s.upiTransactionId && <div className={styles.upiId}>UPI: {s.upiTransactionId}</div>}
                      </div>
                    </td>
                    <td>
                      <div
                        className={styles.thumbnailWrapper}
                        onClick={() => setSelectedScreenshot(getFullImageUrl(s.screenshotUrl))}
                      >
                        <img
                          src={getFullImageUrl(s.screenshotUrl)}
                          alt="Transaction receipt"
                          className={styles.thumbnail}
                        />
                        <div className={styles.zoomOverlay}>🔍 View</div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.dateText}>
                        {new Date(s.screenshotUploadedAt || s.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    {statusFilter === 'rejected' && (
                      <td className={styles.rejectionReasonCell}>
                        <div className={styles.reasonText}>{s.rejectionReason}</div>
                        <div className={styles.adminReviewBy}>By: {s.adminReviewedBy?.fullName || 'Admin'}</div>
                      </td>
                    )}
                    {statusFilter === 'submitted' && (
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actionButtons}>
                          <button
                            onClick={() => handleApprove(s._id)}
                            className="btn btn-primary btn-sm"
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(s._id)}
                            className="btn btn-danger btn-sm"
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
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

        {/* Lightbox / Screenshot Modal */}
        <AnimatePresence>
          {selectedScreenshot && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedScreenshot(null)}
            >
              <motion.div
                className={styles.modalContent}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <h3>Receipt Verification</h3>
                  <button className={styles.closeBtn} onClick={() => setSelectedScreenshot(null)}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                  <img src={selectedScreenshot} alt="Full screenshot" className={styles.fullScreenshot} />
                </div>
                <div className={styles.modalFooter}>
                  <a href={selectedScreenshot} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    Open in New Tab
                  </a>
                  <button onClick={() => setSelectedScreenshot(null)} className="btn btn-primary btn-sm">
                    Close Preview
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reject Dialog Modal */}
        <AnimatePresence>
          {rejectingId && (
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
                  <h3>Reject Payment Submission</h3>
                  <button className={styles.closeBtn} onClick={() => setRejectingId(null)}>&times;</button>
                </div>
                <form onSubmit={handleRejectSubmit}>
                  <div className={styles.dialogBody}>
                    <p className={styles.warningMessage}>
                      This will decline the payment and mark the slot booking as **Payment Rejected**.
                      The user will receive an SMS and email alerting them of this cancellation.
                    </p>
                    <div className="form-group" style={{ marginTop: 16 }}>
                      <label className="form-label" htmlFor="reason">Reason for Rejection (Min 10 characters)</label>
                      <textarea
                        id="reason"
                        className="form-input"
                        rows="4"
                        placeholder="e.g. Transaction Reference number was invalid, or screenshot is blurry. Please pay again."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                        style={{ resize: 'vertical' }}
                      />
                      <span className={styles.charCounter}>{rejectionReason.length} characters</span>
                    </div>
                  </div>
                  <div className={styles.modalFooter}>
                    <button
                      type="button"
                      onClick={() => setRejectingId(null)}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-danger btn-sm"
                      disabled={rejectionReason.trim().length < 10 || rejectMutation.isPending}
                    >
                      {rejectMutation.isPending ? 'Rejecting...' : 'Reject Payment'}
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
