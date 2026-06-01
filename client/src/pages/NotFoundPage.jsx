import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>404 — Page Not Found | Aayush Health Care</title>
      </Helmet>
      <div style={{ minHeight: 'calc(100dvh - var(--header-h))', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 16px' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontSize: '5rem', marginBottom: 16 }}>🌿</div>
          <h1 className="heading-display heading-2" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Page Not Found</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/" className="btn btn-primary">← Back to Home</Link>
        </motion.div>
      </div>
    </>
  );
}
