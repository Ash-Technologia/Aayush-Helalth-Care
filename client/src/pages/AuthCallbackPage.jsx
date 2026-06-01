import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { setCredentials, setTokens } from '@store/slices/authSlice';
import { authService } from '@services';

export default function AuthCallbackPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const exchangeStarted = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      toast.error(decodeURIComponent(error));
      navigate('/auth', { replace: true });
      return;
    }

    if (!code) {
      toast.error('Google authentication failed. Missing verification code.');
      navigate('/auth', { replace: true });
      return;
    }

    // Prevents React 18 StrictMode double invocation in dev
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    const exchangeAndFetchMe = async () => {
      try {
        // Step 1: Exchange code for tokens securely
        const exchangeRes = await authService.googleExchange(code);
        const { accessToken, refreshToken } = exchangeRes.data.data;

        // Step 2: Temporarily store tokens so getMe() Axios interceptor can read them
        dispatch(setTokens({ accessToken, refreshToken }));

        // Step 3: Fetch current user profile details
        const res = await authService.getMe();
        const user = res.data.data.user;

        // Step 4: Complete login with full user profile details
        dispatch(setCredentials({ user, accessToken, refreshToken }));

        toast.success(`Logged in with Google! Welcome, ${user.fullName.split(' ')[0]}! 🌿`);
        navigate('/appointments', { replace: true });
      } catch (err) {
        console.error('Callback exchange error:', err);
        toast.error(err.response?.data?.message || 'Failed to exchange verification code. Please try again.');
        navigate('/auth', { replace: true });
      }
    };

    exchangeAndFetchMe();
  }, [dispatch, navigate, searchParams]);

  return (
    <>
      <Helmet>
        <title>Verifying... | Aayush Health Care</title>
      </Helmet>
      <div style={{ minHeight: 'calc(100dvh - var(--header-h))', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 16px' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🌿</div>
          <h2 className="heading-3" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Authenticating with Google...</h2>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '24px auto 0' }} />
        </motion.div>
      </div>
    </>
  );
}
