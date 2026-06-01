import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { reviewService, appointmentService } from '@services';
import styles from './ReviewPage.module.css';

const STAR_LABELS = ['','Poor','Fair','Good','Very Good','Excellent'];

export default function ReviewPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [rating,  setRating]  = useState(0);
  const [hover,   setHover]   = useState(0);
  const [comment, setComment] = useState('');
  const [isAnon,  setIsAnon]  = useState(false);

  const { data: appt } = useQuery({
    queryKey: ['appointmentForReview', appointmentId],
    queryFn:  () => appointmentService.getById(appointmentId).then((r) => r.data.data.appointment),
    enabled:  !!appointmentId,
  });

  const submit = useMutation({
    mutationFn: (data) => reviewService.create(data),
    onSuccess: () => {
      toast.success('Thank you for your review! 🌿');
      navigate('/appointments');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to submit review.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (rating === 0) return toast.error('Please select a star rating.');
    if (comment.trim().length < 10) return toast.error('Comment must be at least 10 characters.');
    submit.mutate({ appointmentId, rating, comment: comment.trim(), isAnonymous: isAnon });
  };

  const active = hover || rating;

  return (
    <>
      <Helmet><title>Leave a Review — Aayush Health Care</title></Helmet>

      <div className={`section ${styles.page}`}>
        <div className="container" style={{ maxWidth: 560 }}>
          <div className={styles.header}>
            <div className={styles.headerIcon}>🌿</div>
            <h1 className={styles.title}>Share Your Experience</h1>
            <p className={styles.subtitle}>
              Your feedback helps us improve and helps other patients make informed decisions.
            </p>
          </div>

          {appt && (
            <div className={`card ${styles.apptRef}`}>
              <span>📅 {new Date(appt.appointmentDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}</span>
              <span>·</span>
              <span>{appt.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic'}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={`card ${styles.form}`}>
            {/* Star rating */}
            <div className={styles.starsSection}>
              <label className={styles.label}>Your Rating *</label>
              <div className={styles.stars}>
                {[1,2,3,4,5].map((n) => (
                  <button key={n} type="button"
                    className={`${styles.star} ${n <= active ? styles.starActive : ''}`}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    aria-label={`${n} star${n>1?'s':''}`}
                  >★</button>
                ))}
              </div>
              {active > 0 && <p className={styles.starLabel}>{STAR_LABELS[active]}</p>}
            </div>

            {/* Comment */}
            <div className="form-group">
              <label className="form-label" htmlFor="comment">Your Review *</label>
              <textarea
                id="comment"
                className={`form-input ${styles.textarea}`}
                placeholder="Share how the consultation helped you, our approach, your results…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                maxLength={1000}
                required
              />
              <span className="form-hint" style={{ textAlign:'right' }}>{comment.length}/1000</span>
            </div>

            {/* Anonymous toggle */}
            <label htmlFor="anon-check" className={styles.anonRow}>
              <input id="anon-check" type="checkbox" checked={isAnon} onChange={(e) => setIsAnon(e.target.checked)} />
              <span>Post anonymously (your name won't be shown)</span>
            </label>

            <button type="submit" className="btn btn-primary" disabled={submit.isPending} style={{ width:'100%' }}>
              {submit.isPending
                ? <><div className="spinner" style={{width:18,height:18,borderWidth:2}} /> Submitting…</>
                : '⭐ Submit Review'
              }
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
