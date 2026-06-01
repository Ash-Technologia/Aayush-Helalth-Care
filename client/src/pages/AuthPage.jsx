import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { authService } from '@services';
import { getApiBaseUrl } from '@services/api';
import { setCredentials } from '@store/slices/authSlice';
import styles from './AuthPage.module.css';

const STEP = { IDENTIFIER: 'identifier', OTP: 'otp' };

export default function AuthPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [searchParams] = useSearchParams();
  const from      = location.state?.from || '/appointments';

  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [isSignUp,   setIsSignUp]   = useState(initialMode === 'signup');
  const [step,       setStep]       = useState(STEP.IDENTIFIER);
  const [identifier, setIdentifier] = useState('');   // email or phone
  const [fullName,   setFullName]   = useState('');
  const [otp,        setOtp]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [countdown,  setCountdown]  = useState(0);
  const [isNew,      setIsNew]      = useState(false);

  // Sync mode changes from query param if any
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setIsSignUp(true);
    } else if (mode === 'login') {
      setIsSignUp(false);
    }
  }, [searchParams]);

  // ── Countdown timer ──────────────────────────────────────────
  const startCountdown = (seconds = 60) => {
    setCountdown(seconds);
    const id = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; });
    }, 1000);
  };

  // ── Step 1: Request OTP ───────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return toast.error('Enter your email or phone number.');
    if (isSignUp && !fullName.trim()) return toast.error('Please enter your full name to sign up.');

    setLoading(true);
    try {
      const res = await authService.requestOtp({
        identifier: identifier.trim(),
        fullName: isSignUp ? fullName.trim() : undefined,
      });
      setIsNew(res.data.data?.isNewUser || false);
      setStep(STEP.OTP);
      startCountdown(60);
      toast.success(`OTP sent to ${identifier}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP.');

    setLoading(true);
    try {
      const res = await authService.verifyOtp({
        identifier: identifier.trim(),
        otp,
        fullName: isSignUp ? fullName.trim() : undefined,
      });
      const { user, accessToken, refreshToken } = res.data.data;
      dispatch(setCredentials({ user, accessToken, refreshToken }));
      toast.success(`Welcome${isNew ? '' : ' back'}, ${user.fullName.split(' ')[0]}! 🌿`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await authService.requestOtp({
        identifier: identifier.trim(),
        fullName: isSignUp ? fullName.trim() : undefined,
      });
      startCountdown(60);
      toast.success('OTP resent!');
    } catch {
      toast.error('Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────
  const handleGoogle = () => {
    window.location.href = `${getApiBaseUrl()}/auth/google`;
  };

  const slideVariants = {
    hidden:  { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -32 },
  };

  return (
    <>
      <Helmet>
        <title>{isSignUp ? 'Sign Up' : 'Log In'} — Aayush Health Care</title>
        <meta name="description" content="Sign in or register to book Ayurvedic consultations with Amrut Singhavi." />
      </Helmet>

      <div className={styles.page}>
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Logo */}
          <div className={styles.logoWrap}>
            <div className={styles.logoIcon}>🌿</div>
            <div className={styles.logoText}>Aayush Health Care</div>
            <div className={styles.logoSub}>Amrut Singhavi — Ayurvedic Consultancy</div>
          </div>

          <AnimatePresence mode="wait">
            {step === STEP.IDENTIFIER ? (
              <motion.div key="id" variants={slideVariants} initial="hidden" animate="visible" exit="exit">
                <h1 className={styles.heading}>{isSignUp ? 'Create Account 🌿' : 'Welcome Back 👋'}</h1>
                <p className={styles.subheading}>
                  {isSignUp ? 'Sign up to start booking consultations.' : 'Sign in to access your bookings.'}
                </p>

                <form onSubmit={handleRequestOtp} className={styles.form}>
                  {isSignUp && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="fullName">Full Name *</label>
                      <input
                        id="fullName"
                        className="form-input"
                        type="text"
                        placeholder="e.g. Ravi Sharma"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        required={isSignUp}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="identifier">Email or Mobile Number *</label>
                    <input
                      id="identifier"
                      className="form-input"
                      type="text"
                      placeholder="email@example.com or 9876543210"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      required
                    />
                    <span className="form-hint">We'll send a 6-digit OTP to verify.</span>
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                    {loading ? <><div className="spinner" style={{ width:18,height:18,borderWidth:2 }} /> Sending…</> : 'Send OTP →'}
                  </button>

                  <div className={styles.toggleModeRow} style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem' }}>
                    {isSignUp ? (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(false)}
                          style={{ background: 'none', border: 'none', color: 'var(--clr-blue-600)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                        >
                          Log In
                        </button>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(true)}
                          style={{ background: 'none', border: 'none', color: 'var(--clr-blue-600)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                        >
                          Sign Up
                        </button>
                      </span>
                    )}
                  </div>
                </form>

                <div className={styles.dividerRow}>
                  <span />or continue with<span />
                </div>

                <button className={`btn btn-secondary ${styles.googleBtn}`} onClick={handleGoogle} type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </motion.div>
            ) : (
              <motion.div key="otp" variants={slideVariants} initial="hidden" animate="visible" exit="exit">
                <button
                  className={styles.backBtn}
                  onClick={() => { setStep(STEP.IDENTIFIER); setOtp(''); }}
                  type="button"
                >
                  ← Back
                </button>

                <h1 className={styles.heading}>Check your {identifier.includes('@') ? 'email' : 'phone'}</h1>
                <p className={styles.subheading}>
                  We sent a 6-digit OTP to <strong className={styles.identifierHighlight}>{identifier}</strong>
                </p>

                <form onSubmit={handleVerifyOtp} className={styles.form}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="otp">One-Time Password</label>
                    <input
                      id="otp"
                      className={`form-input ${styles.otpInput}`}
                      type="tel"
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={loading || otp.length !== 6} style={{ width: '100%' }}>
                    {loading
                      ? <><div className="spinner" style={{ width:18,height:18,borderWidth:2 }} /> Verifying…</>
                      : 'Verify & Sign In ✓'}
                  </button>
                </form>

                <div className={styles.resendRow}>
                  {countdown > 0
                    ? <span className={styles.countdownText}>Resend OTP in {countdown}s</span>
                    : <button className="btn btn-ghost btn-sm" onClick={handleResend} disabled={loading}>
                        Resend OTP
                      </button>
                  }
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}
