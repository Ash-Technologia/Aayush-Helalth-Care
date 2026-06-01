import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminService } from '@services';
import styles from './AdminUsersPage.module.css';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' (all), 'true' (active), 'false' (inactive)
  const [page, setPage] = useState(1);

  // User History detail states
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Fetch Users List
  const { data: usersData, isLoading: isUsersLoading, error: usersError, refetch } = useQuery({
    queryKey: ['adminUsers', searchTerm, statusFilter, page],
    queryFn: async () => {
      const res = await adminService.listUsers({
        search: searchTerm || undefined,
        isActive: statusFilter !== '' ? statusFilter : undefined,
        page,
        limit: 10,
      });
      return res.data.data;
    },
  });

  // Fetch Single User History
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['adminUserHistory', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      const res = await adminService.getUser(selectedUserId);
      return res.data.data;
    },
    enabled: !!selectedUserId,
  });

  // Toggle activation mutation
  const deactivateMutation = useMutation({
    mutationFn: (id) => adminService.deactivateUser(id),
    onSuccess: (res) => {
      toast.success(res.data.message || 'User deactivated.');
      queryClient.invalidateQueries(['adminUsers']);
      queryClient.invalidateQueries(['adminUserHistory', selectedUserId]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to deactivate.');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id) => adminService.activateUser(id),
    onSuccess: (res) => {
      toast.success(res.data.message || 'User reactivated.');
      queryClient.invalidateQueries(['adminUsers']);
      queryClient.invalidateQueries(['adminUserHistory', selectedUserId]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to activate.');
    },
  });

  const handleDeactivate = (id, name) => {
    if (window.confirm(`Deactivate patient account: ${name}? All active login sessions will be terminated.`)) {
      deactivateMutation.mutate(id);
    }
  };

  const handleActivate = (id) => {
    activateMutation.mutate(id);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <Helmet>
        <title>Manage Patients Directory — Aayush Health Care</title>
      </Helmet>

      <div className="page-enter">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Patient Directory</h1>
            <p className={styles.subtitle}>Browse through patients records, activate/deactivate accounts, and review appointment histories.</p>
          </div>
        </div>

        {/* Filters Panel */}
        <div className={styles.filterGrid}>
          <div className="form-group">
            <label className="form-label" htmlFor="search">Search Patients</label>
            <input
              id="search"
              type="text"
              className="form-input"
              placeholder="Name, email, phone number..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="status">Account Status</label>
            <select
              id="status"
              className="form-input"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ background: 'var(--bg-elevated)' }}
            >
              <option value="">All Statuses</option>
              <option value="true">Active Accounts</option>
              <option value="false">Deactivated Accounts</option>
            </select>
          </div>
        </div>

        {/* Content Section */}
        {isUsersLoading ? (
          <div className={styles.loadingState}>
            <div className="spinner" />
            <p>Retrieving directory ledger...</p>
          </div>
        ) : usersError ? (
          <div className={styles.errorState}>
            <p>Failed to load patient profiles.</p>
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm">Try Again</button>
          </div>
        ) : usersData?.users.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>👥</div>
            <p>No patients match the search criteria.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient Details</th>
                  <th>Registered At</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersData.users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className={styles.patientCell}>
                        <div className={styles.avatar}>{u.fullName?.charAt(0) || 'P'}</div>
                        <div className={styles.info}>
                          <div className={styles.name}>{u.fullName}</div>
                          <div className={styles.contact}>
                            <span>📞 {u.phone}</span>
                            {u.email && <span style={{ marginLeft: 12 }}>✉️ {u.email}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.dateText}>
                        {formatDate(u.createdAt)}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actionButtons}>
                        <button
                          onClick={() => setSelectedUserId(u._id)}
                          className="btn btn-secondary btn-sm"
                        >
                          View History
                        </button>
                        {u.isActive ? (
                          <button
                            onClick={() => handleDeactivate(u._id, u.fullName)}
                            className="btn btn-danger btn-sm"
                            disabled={deactivateMutation.isPending || activateMutation.isPending}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(u._id)}
                            className="btn btn-primary btn-sm"
                            disabled={deactivateMutation.isPending || activateMutation.isPending}
                          >
                            Reactivate
                          </button>
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
        {usersData?.pagination && usersData.pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
            >
              &larr; Prev
            </button>
            <span className={styles.pageIndicator}>
              Page {usersData.pagination.page} of {usersData.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(usersData.pagination.totalPages, p + 1))}
              disabled={page === usersData.pagination.totalPages}
              className="btn btn-secondary btn-sm"
            >
              Next &rarr;
            </button>
          </div>
        )}

        {/* History Modal Lightbox */}
        <AnimatePresence>
          {selectedUserId && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUserId(null)}
            >
              <motion.div
                className={styles.modalContent}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                {isHistoryLoading ? (
                  <div className={styles.modalLoading}>
                    <div className="spinner" />
                    <p>Loading patient history...</p>
                  </div>
                ) : historyData ? (
                  <>
                    <div className={styles.modalHeader}>
                      <div>
                        <h3>Appointment History: {historyData.user?.fullName}</h3>
                        <p className={styles.modalHeaderMeta}>Registered on {formatDate(historyData.user?.createdAt)}</p>
                      </div>
                      <button className={styles.closeBtn} onClick={() => setSelectedUserId(null)}>&times;</button>
                    </div>

                    <div className={styles.modalBody}>
                      {historyData.appointments?.length === 0 ? (
                        <div className={styles.modalEmpty}>
                          <p>No appointments booked yet by this user account.</p>
                        </div>
                      ) : (
                        <div className={styles.historyTableWrapper}>
                          <table className={styles.historyTable}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Slot Time</th>
                                <th>Type</th>
                                <th>Fee</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historyData.appointments.map((a) => (
                                <tr key={a._id}>
                                  <td><strong>{formatDate(a.appointmentDate)}</strong></td>
                                  <td>{a.slotStart}</td>
                                  <td style={{ textTransform: 'capitalize' }}>{a.consultationType}</td>
                                  <td>₹{a.feeSnapshot}</td>
                                  <td>
                                    <span className={`badge ${
                                      a.status === 'confirmed' ? 'badge-success' :
                                      a.status === 'completed' ? 'badge-info' :
                                      a.status === 'cancelled' ? 'badge-neutral' :
                                      'badge-danger'
                                    }`} style={{ fontSize: '0.7rem' }}>
                                      {a.status.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className={styles.modalFooter}>
                      <button onClick={() => setSelectedUserId(null)} className="btn btn-primary btn-sm">
                        Close Summary
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={styles.modalLoading}><p>Failed to retrieve records.</p></div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
