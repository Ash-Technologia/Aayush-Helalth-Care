import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { adminService } from '@services';
import styles from './AdminDashboardPage.module.css';

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      const res = await adminService.getDashboard();
      return res.data.data;
    },
    refetchInterval: 15000, // Auto refresh every 15s for live dashboard feel
  });

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
        <p>Loading real-time dashboard analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <h3>Failed to load dashboard data</h3>
        <p>{error.response?.data?.message || error.message}</p>
        <button onClick={() => refetch()} className="btn btn-primary btn-sm">Try Again</button>
      </div>
    );
  }

  const {
    appointments,
    revenue,
    pendingReviewCount,
    totalUsers,
    totalReviews,
    recentPending,
    todayAppointments,
  } = data;

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
        <title>Admin Dashboard — Aayush Health Care</title>
      </Helmet>

      <div className="page-enter">
        {/* Header Section */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard Analytics</h1>
            <p className={styles.subtitle}>Welcome back, Amrut Singhavi. Here is today's overview.</p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
              Refresh Data
            </button>
            <Link to="/admin/slots" className="btn btn-primary btn-sm">
              Quick Slot Planner
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>💳</div>
            <div>
              <div className={styles.statLabel}>Pending Approvals</div>
              <div className={styles.statValue}>{appointments.pendingApproval}</div>
              <div className={styles.statDesc}>Awaiting verification</div>
            </div>
            {appointments.pendingApproval > 0 && <span className={styles.badgeAlert} />}
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(20,184,166,0.1)', color: '#2dd4bf' }}>📅</div>
            <div>
              <div className={styles.statLabel}>Today's Appointments</div>
              <div className={styles.statValue}>{appointments.today}</div>
              <div className={styles.statDesc}>Confirmed + pending</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>₹</div>
            <div>
              <div className={styles.statLabel}>Monthly Revenue</div>
              <div className={styles.statValue}>₹{revenue.thisMonth.toLocaleString('en-IN')}</div>
              <div className={styles.statDesc}>Confirmed / Completed</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>👥</div>
            <div>
              <div className={styles.statLabel}>Total Patients</div>
              <div className={styles.statValue}>{totalUsers}</div>
              <div className={styles.statDesc}>Registered on platform</div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className={styles.detailsGrid}>
          {/* Recent Pending Payments */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Pending Payments ({pendingReviewCount})</h2>
              <Link to="/admin/payments" className={styles.panelLink}>View All &rarr;</Link>
            </div>
            <div className={styles.panelBody}>
              {recentPending.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🎉</div>
                  <p>All payments cleared. No pending submissions.</p>
                </div>
              ) : (
                <div className={styles.pendingList}>
                  {recentPending.map((p) => (
                    <div key={p._id} className={styles.pendingItem} onClick={() => navigate('/admin/payments')}>
                      <div className={styles.pendingAvatar}>{p.user?.fullName?.charAt(0) || 'P'}</div>
                      <div className={styles.pendingInfo}>
                        <div className={styles.pendingName}>{p.user?.fullName || 'Patient'}</div>
                        <div className={styles.pendingMeta}>
                          {p.appointment ? (
                            <>
                              {formatDate(p.appointment.appointmentDate)} &bull; {p.appointment.slotStart} &bull; {p.appointment.consultationType}
                            </>
                          ) : (
                            'Custom submission'
                          )}
                        </div>
                      </div>
                      <div className={styles.pendingAmt}>
                        <div>₹{p.appointment?.feeSnapshot || 500}</div>
                        <span className="badge badge-warning btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>Review</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Today's Schedule */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Today's Schedule ({appointments.today})</h2>
              <Link to="/admin/appointments" className={styles.panelLink}>View All &rarr;</Link>
            </div>
            <div className={styles.panelBody}>
              {todayAppointments.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>☕</div>
                  <p>No appointments scheduled for today.</p>
                </div>
              ) : (
                <div className={styles.scheduleList}>
                  {todayAppointments.map((a) => (
                    <div key={a._id} className={styles.scheduleItem} onClick={() => navigate('/admin/appointments')}>
                      <div className={styles.scheduleTime}>
                        <strong>{a.slotStart}</strong>
                        <span>{a.consultationType}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <div className={styles.scheduleName}>{a.patientName}</div>
                        <div className={styles.schedulePhone}>{a.patientPhone}</div>
                      </div>
                      <div>
                        <span className={`badge ${a.status === 'confirmed' ? 'status-confirmed' : 'status-pending'}`}>
                          {a.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Appointment Status Breakdown */}
        <div className={styles.statusBreakdownPanel}>
          <h2>Overall Bookings Breakdown</h2>
          <div className={styles.statusStats}>
            <div className={styles.statusStatItem}>
              <span className={styles.statusDot} style={{ background: '#34d399' }} />
              <div className={styles.statusStatLabel}>Confirmed</div>
              <div className={styles.statusStatVal}>{appointments.confirmed}</div>
            </div>
            <div className={styles.statusStatItem}>
              <span className={styles.statusDot} style={{ background: '#fbbf24' }} />
              <div className={styles.statusStatLabel}>Pending Approval</div>
              <div className={styles.statusStatVal}>{appointments.pendingApproval}</div>
            </div>
            <div className={styles.statusStatItem}>
              <span className={styles.statusDot} style={{ background: '#60a5fa' }} />
              <div className={styles.statusStatLabel}>Completed</div>
              <div className={styles.statusStatVal}>{appointments.completed}</div>
            </div>
            <div className={styles.statusStatItem}>
              <span className={styles.statusDot} style={{ background: '#9ca3af' }} />
              <div className={styles.statusStatLabel}>Awaiting Payment</div>
              <div className={styles.statusStatVal}>{appointments.awaitingPayment}</div>
            </div>
            <div className={styles.statusStatItem}>
              <span className={styles.statusDot} style={{ background: '#f87171' }} />
              <div className={styles.statusStatLabel}>Rejected/Cancelled</div>
              <div className={styles.statusStatVal}>{appointments.paymentRejected + appointments.cancelled}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
