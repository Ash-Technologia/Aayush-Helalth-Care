import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminService } from '@services';
import { setCredentials } from '@store/slices/authSlice';
import styles from './AdminLoginPage.module.css';

export default function AdminLoginPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminService.login({ email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      dispatch(setCredentials({ user, accessToken, refreshToken }));
      toast.success('Welcome back, Admin!');
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Admin Login — Aayush Health Care</title></Helmet>
      <div className={styles.page}>
        <motion.div className={styles.card} initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}>
          <div className={styles.logo}>
            <div className={styles.logoMark} aria-hidden="true">
              <span className={styles.logoMarkInner}>AH</span>
            </div>
            <div className={styles.logoText}>Admin Panel</div>
            <div className={styles.logoSub}>Aayush Health Care</div>
          </div>
          <h1 className={styles.title}>Sign In</h1>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input id="email" className="form-input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="admin@clinic.in" required autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" className="form-input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width:'100%', marginTop:4 }}>
              {loading ? <><div className="spinner" style={{width:18,height:18,borderWidth:2}} /> Signing in…</> : 'Sign In →'}
            </button>
          </form>
        </motion.div>
      </div>
    </>
  );
}
