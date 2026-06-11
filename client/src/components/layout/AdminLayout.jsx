import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectAdmin, adminLogout } from '@store/slices/authSlice';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '@services';
import { resolveBackendAssetUrl } from '@services/api';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import styles from './AdminLayout.module.css';

const NAV = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: '📊' },
  { label: 'Payments', to: '/admin/payments', icon: '💳' },
  { label: 'Appointments', to: '/admin/appointments', icon: '📅' },
  { label: 'Slots', to: '/admin/slots', icon: '🕐' },
  { label: 'Profile', to: '/admin/profile', icon: '👤' },
  { label: 'Content', to: '/admin/content', icon: '📝' },
  { label: 'Users', to: '/admin/users', icon: '👥' },
];

export default function AdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectAdmin);

  const { data: profileData } = useQuery({
    queryKey: ['doctorProfile'],
    queryFn: () => profileService.getDoctorProfile().then((r) => r.data.data),
  });
  const profile = profileData?.profile || profileData;
  const logoUrl = profile?.imageUrl ? resolveBackendAssetUrl(profile.imageUrl) : '/logo.png';

  const handleLogout = async () => {
    dispatch(adminLogout());
    toast.success('Signed out.');
    navigate('/admin/login');
  };

  return (
    <div className={styles.root}>
      <Helmet>
        {profile?.imageUrl && (
          <link rel="icon" type="image/jpeg" href={logoUrl} />
        )}
      </Helmet>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <img
            src={logoUrl}
            alt="Aayush Health Care"
            className={styles.logoImage}
            onError={(e) => { e.target.style.display = 'none'; }}
          />

          <div>
            <div className={styles.logoText}>
              Aayush Health Care
            </div>
            <div className={styles.logoSub}>
              Admin Panel
            </div>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`${styles.navItem} ${
                  active ? styles.active : ''
                }`}
              >
                <span className={styles.navIcon}>
                  {item.icon}
                </span>

                <span>{item.label}</span>

                {active && (
                  <div className={styles.activeBar} />
                )}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.adminInfo}>
            <div className={styles.adminAvatar}>
              {user?.fullName?.charAt(0) || 'A'}
            </div>

            <div>
              <div className={styles.adminName}>
                {user?.fullName || 'Admin'}
              </div>

              <div className={styles.adminRole}>
                Administrator
              </div>
            </div>
          </div>

          <button
            className={`btn btn-ghost btn-sm ${styles.logoutBtn}`}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}