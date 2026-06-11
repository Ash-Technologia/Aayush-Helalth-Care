import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { adminService, profileService } from '@services';
import { resolveBackendAssetUrl } from '@services/api';
import toast from 'react-hot-toast';
import { setCredentials } from '@store/slices/authSlice';
import styles from './AdminLoginPage.module.css';

export default function AdminLoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { data: profileData } = useQuery({
    queryKey: ['doctorProfile'],
    queryFn: () => profileService.getDoctorProfile().then((r) => r.data.data),
  });
  const profile = profileData?.profile || profileData;
  const logoUrl = profile?.imageUrl ? resolveBackendAssetUrl(profile.imageUrl) : '/logo.png';

  const [email, setEmail] = useState('');
  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res =
        await adminService.login({
          email,
          password,
        });

      const {
        user,
        accessToken,
        refreshToken,
      } = res.data.data;

      dispatch(
        setCredentials({
          user,
          accessToken,
          refreshToken,
        })
      );

      toast.success(
        'Welcome back, Admin!'
      );

      navigate('/admin/dashboard', {
        replace: true,
      });
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Invalid credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Login — Aayush Health Care</title>
        {profile?.imageUrl && (
          <link rel="icon" type="image/jpeg" href={logoUrl} />
        )}
      </Helmet>

      <div className={styles.page}>
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.logo}>
            <img
              src={logoUrl}
              alt="Aayush Health Care"
              className={styles.logoImage}
              onError={(e) => { e.target.style.display = 'none'; }}
            />

            <div className={styles.logoText}>
              Admin Panel
            </div>

            <div className={styles.logoSub}>
              Aayush Health Care
            </div>
          </div>

          <h1 className={styles.title}>
            Sign In
          </h1>

          <form
            onSubmit={handleSubmit}
            className={styles.form}
          >
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="email"
              >
                Email Address
              </label>

              <input
                id="email"
                className="form-input"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="admin@clinic.in"
                required
              />
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="password"
              >
                Password
              </label>

              <input
                id="password"
                className="form-input"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 4,
              }}
            >
              {loading
                ? 'Signing in…'
                : 'Sign In →'}
            </button>
          </form>
        </motion.div>
      </div>
    </>
  );
}