import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { selectIsAuth, selectUser, logout } from '@store/slices/authSlice';
import { toggleMobileMenu, closeMobileMenu, selectMobileMenuOpen } from '@store/slices/uiSlice';
import { authService } from '@services';
import toast from 'react-hot-toast';
import styles from './RootLayout.module.css';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Book Appointment', to: '/book' },
  { label: 'My Bookings', to: '/appointments', auth: true },
];

export default function RootLayout() {
  const dispatch = useDispatch();
  const location = useLocation();
  const isAuth = useSelector(selectIsAuth);
  const user = useSelector(selectUser);
  const menuOpen = useSelector(selectMobileMenuOpen);

  useEffect(() => { dispatch(closeMobileMenu()); }, [location.pathname, dispatch]);

  const handleLogout = async () => {
    try {
      const token = user?.refreshToken;
      if (token) await authService.logout(token).catch(() => { });
    } finally {
      dispatch(logout());
      toast.success('Signed out successfully.');
    }
  };

  let displayName = 'User';
  let initials = 'U';

  if (user) {
    if (user.role === 'admin') {
      displayName = 'Amrut Singhavi';
      initials = 'AS';
    } else {
      const nameParts = user.fullName ? user.fullName.split(' ') : [];
      if (nameParts.length > 0) {
        if (['Dr', 'Dr.', 'Mr', 'Mr.', 'Mrs', 'Mrs.', 'Ms', 'Ms.'].includes(nameParts[0]) && nameParts.length > 1) {
          displayName = nameParts[1];
          initials = nameParts.slice(0, 2).map(n => n[0]).join('').toUpperCase();
        } else {
          displayName = nameParts[0];
          initials = nameParts.map(n => n[0]).join('').slice(0, 2).toUpperCase();
        }
      }
    }
  }

  return (
    <div className={styles.root}>
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={`container ${styles.nav}`}>

          <Link to="/" className={styles.logo}>
            <span className={styles.logoMark} aria-hidden="true">
              <span className={styles.logoMarkInner}>AH</span>
            </span>
            <span className={styles.logoTextWrap}>
              <span className={styles.logoName}>Aayush Health Care</span>
              <span className={styles.logoTagline}>Ayurveda • Acupressure • Neurotherapy</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className={styles.desktopNav}>
            {NAV_LINKS.filter((l) => !l.auth || isAuth).map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`${styles.navLink} ${location.pathname === l.to ? styles.active : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className={styles.navActions}>
            {isAuth ? (
              <>
                <div className={styles.userChip}>
                  <div className={styles.userAvatar}>{initials}</div>
                  {displayName}
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleLogout}>Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/auth?mode=login" className="btn btn-outline btn-sm">Log In</Link>
                <Link to="/auth?mode=signup" className="btn btn-primary btn-sm">Sign Up</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={styles.hamburger}
            onClick={() => dispatch(toggleMobileMenu())}
            aria-label="Toggle menu"
          >
            <span className={menuOpen ? styles.open : ''} />
            <span className={menuOpen ? styles.open : ''} />
            <span className={menuOpen ? styles.open : ''} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className={styles.mobileMenu}>
            {NAV_LINKS.filter((l) => !l.auth || isAuth).map((l) => (
              <Link key={l.to} to={l.to} className={styles.mobileNavLink}>{l.label}</Link>
            ))}
            <div className={styles.mobileDivider} />
            {isAuth ? (
              <button onClick={handleLogout} className={styles.mobileNavLink}>Sign Out</button>
            ) : (
              <div className={styles.mobileAuthRow} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px', marginTop: '6px' }}>
                <Link to="/auth?mode=login" className="btn btn-outline" style={{ justifyContent: 'center' }}>Log In</Link>
                <Link to="/auth?mode=signup" className="btn btn-primary" style={{ justifyContent: 'center' }}>Sign Up</Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ─── Main ──────────────────────────────────────────── */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerGrid}>

            <div className={styles.footerBrand}>
              <div className={styles.footerLogoRow}>
                    <span className={styles.footerLogoMark} aria-hidden="true">
                      <span className={styles.footerLogoMarkInner}>AH</span>
                    </span>
                    <span className={styles.footerLogoText}>Aayush Health Care</span>
              </div>
              <p className={styles.footerTagline}>
                Amrut Singhavi — Acupressure & Neurotherapy Specialist.<br />
                Healing naturally, guided by science.
              </p>
              <div className={styles.footerContact}>
                <div className={styles.footerContactItem}>
                  <span className={styles.footerContactIcon}>📞</span>
                  +91 98228 43015
                </div>
                <div className={styles.footerContactItem}>
                  <span className={styles.footerContactIcon}>📧</span>
                  amrutsinghavi@gmail.com
                </div>
                <div className={styles.footerContactItem}>
                  <span className={styles.footerContactIcon}>📍</span>
                  Matoshri Arcade, Near khatri compund, Amravati
                </div>
              </div>
            </div>

            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Navigation</div>
              <Link to="/" className={styles.footerLink}>Home</Link>
              <Link to="/book" className={styles.footerLink}>Book Appointment</Link>
              {isAuth && <Link to="/appointments" className={styles.footerLink}>My Appointments</Link>}
              {!isAuth && (
                <>
                  <Link to="/auth?mode=login" className={styles.footerLink}>Log In</Link>
                  <Link to="/auth?mode=signup" className={styles.footerLink}>Sign Up</Link>
                </>
              )}
            </div>

            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Services</div>
              <span className={styles.footerLink}>Online Consultation</span>
              <span className={styles.footerLink}>In-Clinic Visit</span>
              <span className={styles.footerLink}>Panchakarma</span>
              <span className={styles.footerLink}>Chronic Care</span>
            </div>

          </div>

          <div className={styles.footerBottom}>
            <span className={styles.footerCopyright}>
              © {new Date().getFullYear()} Aayush Health Care. All rights reserved.
            </span>
            <span className={styles.footerBadge}>
              <span className={styles.footerBadgeDot} />
              Accepting new patients
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
