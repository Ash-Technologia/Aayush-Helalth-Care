import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { FiPlay, FiShield } from 'react-icons/fi';
import { profileService, reviewService } from '@services';
import { resolveBackendAssetUrl } from '@services/api';
import styles from './HomePage.module.css';

// ── Animation variants ────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.12 } } };

// ── Section: Emergency Banner ─────────────────────────────────────
function EmergencyBanner({ profile }) {
  if (!profile?.isEmergencyClosed) return null;
  return (
    <div className={styles.emergencyBanner}>
      ⚠️ {profile.emergencyMessage || 'Clinic temporarily closed. We will resume shortly.'}
    </div>
  );
}

// ── Section: Hero ─────────────────────────────────────────────────
function HeroSection({ profile, content }) {
  const [introPlaying, setIntroPlaying] = useState(false);

  const introVideo = useMemo(() => {
    const raw = content?.hero?.videoUrl || '';
    if (!raw) return '';

    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, '');
      let videoId = '';

      if (host.includes('youtube.com')) {
        videoId = url.searchParams.get('v') || '';
        if (!videoId && url.pathname.includes('/embed/')) {
          videoId = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
        }
      } else if (host === 'youtu.be') {
        videoId = url.pathname.replace(/^\//, '').split('/')[0];
      }

      return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : raw;
    } catch {
      return raw;
    }
  }, [content?.hero?.videoUrl]);

  const introPoster = resolveBackendAssetUrl(
    content?.hero?.videoPosterUrl || profile?.imageUrl
  );

  return (
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <motion.div
          className={styles.heroCopy}
          initial="hidden" animate="show" variants={stagger}
        >
          <motion.div variants={fadeUp} className={styles.heroEyebrow}>
            <span className={styles.dotLive} />
            Healing from Home
          </motion.div>

          <motion.h1 variants={fadeUp} className={`heading-display heading-1 ${styles.heroTitle}`}>
            {content?.hero?.headline ? (
              <span dangerouslySetInnerHTML={{ __html: content.hero.headline }} />
            ) : (
              <>
                Aayush Health Care,<br />
                <span className="text-gradient"></span>
              </>
            )}
          </motion.h1>

          <motion.p variants={fadeUp} className={styles.heroSub}>
            {content?.hero?.subheadline || (
              <>
                {profile?.tagline || 'Healing with Ayurveda, guided by science.'}
                <br />Expert consultations — online &amp; in-clinic.
              </>
            )}
          </motion.p>

          <motion.div variants={fadeUp} className={styles.heroCtas}>
            <Link to="/book" className="btn btn-primary btn-lg">
              {content?.hero?.ctaPrimary || '📅 Book Appointment'}
            </Link>
            <a href="#about" className="btn btn-secondary btn-lg">
              {content?.hero?.ctaSecondary || 'About Singhavi'}
            </a>
          </motion.div>

          <motion.div variants={fadeUp} className={styles.heroBadgeRow}>
            <span className={`${styles.heroBadge} ${styles.green}`}>Certified Diabetes Educator</span>
            <span className={`${styles.heroBadge} ${styles.blue}`}>🎥 Virtual OPD + In-Clinic</span>
          </motion.div>
        </motion.div>

        {/* Doctor image card */}
        <motion.div
          className={styles.heroCardWrap}
          initial={{ opacity: 0, scale: 0.92, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className={styles.heroCard}>
            <div className={styles.heroMediaWrap}>
              {introPlaying && introVideo ? (
                <iframe
                  className={styles.heroVideo}
                  src={introVideo}
                  title={content?.hero?.videoTitle || 'Aayush Health Care introduction video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : introVideo ? (
                <button
                  type="button"
                  className={styles.heroVideoPoster}
                  onClick={() => setIntroPlaying(true)}
                  aria-label={content?.hero?.videoTitle || 'Play introduction video'}
                >
                  {introPoster ? (
                    <img src={introPoster} alt="Doctor introduction thumbnail" className={styles.heroVideoPosterImage} />
                  ) : (
                    <div className={styles.heroImagePlaceholder}>
                      <div className={styles.placeholderCrest}>
                        <FiShield size={36} />
                      </div>
                    </div>
                  )}
                  <div className={styles.heroVideoOverlay}>
                    <span className={styles.heroVideoPlay}><FiPlay /></span>
                    <span className={styles.heroVideoLabel}>Play Introduction</span>
                  </div>
                </button>
              ) : (
                <div className={styles.heroImageWrap}>
                  {profile?.imageUrl
                    ? <img src={resolveBackendAssetUrl(profile.imageUrl)} alt="" className={styles.heroImage} />
                    : <div className={styles.heroImagePlaceholder}>
                      <div className={styles.placeholderCrest}>
                        <FiShield size={36} />
                      </div>
                      <p></p>
                    </div>
                  }
                </div>
              )}
            </div>
            <div className={styles.heroCardInfo}>
              <div className={styles.heroCardName}>Amrut Singhavi</div>
              <div className={styles.heroCardDegContainer}>
                <span className={styles.heroCardBubble}>❇️ Acupressure MD</span>
                <span className={styles.heroCardBubble}>❇️ Neurotherapy</span>
                <span className={styles.heroCardBubble}>❇️ Pain Management</span>
                <span className={styles.heroCardBubble}>❇️ Reiki Healing</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Section: Stats ────────────────────────────────────────────────
function StatsSection({ profile }) {
  const stats = [
    { num: `${profile?.stats?.yearsExperience || 7}+`, label: 'Years of Practice', colorClass: styles.colorGreen },
    { num: `${profile?.stats?.patientsTreated?.toLocaleString() || 'Many'}`, label: 'Patients Treated Across India', colorClass: styles.colorTerracotta },
    { num: `${profile?.stats?.satisfactionRate || 95}%`, label: 'Satisfaction Rate', colorClass: styles.colorGold },
    { num: `₹${profile?.consultationFee || 500}`, label: 'For Each Consultancy Fee', colorClass: styles.colorBlue },
  ];

  return (
    <section className={styles.statsBar}>
      <div className="container">
        <div className={styles.statsGrid}>
          {stats.map((s) => (
            <div key={s.label} className={styles.statItem}>
              <div className={`${styles.statNum} ${s.colorClass}`}>{s.num}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section: Testimonials ─────────────────────────────────────────
function TestimonialsSection() {
  const testimonials = [
    {
      id: 1,
      title: 'Patient Recovery Story',
      videoUrl: 'https://www.youtube.com/embed/TLOlvf4DIOY',
    },
    {
      id: 2,
      title: 'Diabetes Improvement',
      videoUrl: 'https://www.youtube.com/embed/FaxX9m1N-pk',
    },
    {
      id: 3,
      title: 'Sciatica Treatment Result',
      videoUrl: 'https://www.youtube.com/embed/yniY7orkFXI',
    },
    {
      id: 4,
      title: 'Sciatica Treatment Result',
      videoUrl: 'https://www.youtube.com/embed/n7-kupIchac',
    },
    {
      id: 5,
      title: 'Sciatica Treatment Result',
      videoUrl: 'https://www.youtube.com/embed/WvpddvuOoJo',
    },
    {
      id: 6,
      title: 'Sciatica Treatment Result',
      videoUrl: 'https://www.youtube.com/embed/hbAD17GYkAY',
    },
  ];

  return (
    <section className={`section ${styles.testimonials}`}>
      <div className="container">
        <div className="section-header">
          <div className="section-eyebrow">
            Patient Video Stories
          </div>

          <h2 className="heading-display heading-2 section-title">
            Hear From Our Patients
          </h2>

          <p className="section-subtitle">
            Real healing experiences shared by our patients.
          </p>
        </div>

        <motion.div
          className={styles.testimonialGrid}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
        >
          {testimonials.map((video) => (
            <motion.div
              key={video.id}
              variants={fadeUp}
              className={styles.testimonialCard}
            >
              <div className={styles.videoWrapper}>
                <iframe
                  src={video.videoUrl}
                  title={video.title}
                  width="100%"
                  height="250"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Section: About ────────────────────────────────────────────────
function AboutSection({ profile, content }) {
  const defaultDegrees = [
    { title: 'Advance Certification On Diabetes Mellitus', institution: 'Licensed By Ministry Of Science & Technology, Vietnam Gov.' },
    { title: 'Diabetes Educator', institution: 'Indo Vietnam Medical Board' },
    { title: 'Emergency & Pain Management Specialist', institution: 'Shirdhar University' },
    { title: 'Code Blue', institution: 'Lincoln University College, Malaysia' },
    { title: 'I.L.I Paramedic', institution: 'Chandigarh' }
  ];

  const defaultSpecializations = [
    'Network Of Influenza Care Experts', 'Wellness & Inflammatory Syndrome Expert', 'M.D.Acupressure',
    'Ayurvedic Acupressure', 'Nuerotherapy', 'Diploma in Panchkarma',
    'B.L.S', 'Dite & Nutrition Coach', 'Auricular Therapy', 'Reiki Teacher', 'Face Diagnosis & Treatment', 'Reflexology'
  ];

  const defaultAchievements = [
    { icon: '✨', text: '7+ Years of Clinical Expertise in Drugless & Non-Invasive Medicine' },
    { icon: '👥', text: 'Many Successful Consultations & Patient Therapies Across India' },
    { icon: '🏆', text: 'Pioneer in Integrated Acupressure & Advanced Neurotherapy Protocols' },
    { icon: '🌟', text: 'Renowned for Spondylitis, Sciatica & Lifestyle Diseases' }
  ];

  const defaultClinicTimings = [
    { day: 'Monday – Saturday', startTime: '02:00 PM', endTime: '08:00 PM' },
    { day: 'Sunday', startTime: 'Closed', endTime: 'Closed' }
  ];

  const degrees = profile?.degrees?.length ? profile.degrees : defaultDegrees;
  const specializations = profile?.specializations?.length ? profile.specializations : defaultSpecializations;
  const achievements = profile?.achievements?.length ? profile.achievements : defaultAchievements;
  const clinicTimings = profile?.clinicTimings?.length ? profile.clinicTimings : defaultClinicTimings;

  return (
    <section id="about" className={`section ${styles.about}`}>
      <div className="container">
        <motion.div
          className={styles.aboutGrid}
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
        >
          {/* Left: credentials */}
          <motion.div variants={fadeUp} className={styles.aboutLeft}>
            <div className="section-eyebrow">About the Specialist</div>
            <h2 className="heading-display heading-2 section-title">
              {content?.about?.sectionTitle || profile?.name || 'Amrut Singhavi'}
            </h2>
            <p className={styles.aboutBio}>
              {content?.about?.bodyText || profile?.about || (
                <>
                  Amrut Singhavi is a distinguished expert in non-invasive, drugless medicine, combining ancient Vedic wisdom with modern physiological insights. As a certified Acupressure and advanced Neurotherapy specialist, he has spent over a decade developing highly effective therapies for chronic pain management, spinal disorders, and systemic health conditions.
                  <br /><br />
                  His clinical approach focuses on activating the body's natural healing force through targeted acupoints, neural stimulation, and energy harmonization. Singhavi is dedicated to treating the root causes of ailments rather than just managing symptoms, providing personalized care that restores vitality, balance, and lifelong wellness.
                </>
              )}
            </p>

            {/* Degrees */}
            <div className={styles.degreeList}>
              {degrees.map((d, i) => (
                <div key={i} className={styles.degreeItem}>
                  <span className={styles.degreeIcon}>🎓</span>
                  {d.title} — {d.institution}, {d.year}
                </div>
              ))}
            </div>

            {/* Specializations */}
            <div className={styles.specializationRow}>
              {specializations.map((s) => (
                <span key={s} className="badge badge-primary">{s}</span>
              ))}
            </div>

            <Link to="/book" className="btn btn-primary" style={{ marginTop: 24 }}>
              Book a Consultation →
            </Link>
          </motion.div>

          {/* Right: achievement cards */}
          <motion.div variants={fadeUp} className={styles.aboutRight}>
            {achievements.map((a, i) => (
              <div key={i} className={styles.achieveCard}>
                <div className={styles.achieveIconWrap}>{a.icon || '✨'}</div>
                <p className={styles.achieveText}>{a.text}</p>
              </div>
            ))}

            {/* Timings card */}
            <div className={styles.timingsCard}>
              <div className={styles.timingsHead}>🕐 Clinic Timings</div>
              {clinicTimings.map((t, i) => (
                <div key={i} className={styles.timingRow}>
                  <span className={styles.timingDay}>{t.day}</span>
                  <span className={styles.timingTime}>{t.startTime} – {t.endTime}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Section: Services ─────────────────────────────────────────────
function ServicesSection({ content }) {
  const defaultServices = [
    { icon: '🌿', title: 'Panchakarma Therapy', description: 'Traditional detoxification & rejuvenation therapy.' },
    { icon: '💊', title: 'GRAD Therapy', description: 'For lifestyle disease & chronic conditions.' },
    { icon: '🧘', title: 'Lifestyle Counselling', description: 'Ayurvedic diet, yoga, and daily routine guidance.' },
    { icon: '🔥', title: 'Pain Management', description: 'Natural therapies for joint pain, arthritis, and back pain.' },
    { icon: '🌸', title: 'Skin & Hair Care', description: 'Ayurvedic solutions for skin disorders and hair fall.' },
    { icon: '🩺', title: 'Chronic Disease Management', description: 'Diabetes, BP, thyroid — managed holistically.' },
  ];

  const services = content?.services?.length ? content.services : defaultServices;

  return (
    <section className={`section ${styles.services}`}>
      <div className="container">
        <div className="section-header">
          <div className="section-eyebrow">What We Treat</div>
          <h2 className="heading-display heading-2 section-title">Our Services</h2>
        </div>

        <motion.div
          className={styles.servicesGrid}
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
        >
          {services.map((s, i) => (
            <motion.div key={i} variants={fadeUp} className={styles.serviceCard}>
              <div className={styles.serviceIconWrap}>{s.icon}</div>
              <h3 className={styles.serviceTitle}>{s.title}</h3>
              <p className={styles.serviceDesc}>{s.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Section: How It Works ─────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    { num: '1', icon: '📅', title: 'Book Your Slot', desc: 'Choose a date, time & consultation type (online or in-clinic).' },
    { num: '2', icon: '💳', title: 'Pay via UPI', desc: 'Pay the consultation fee via QR code — quick & secure.' },
    { num: '3', icon: '📸', title: 'Share Screenshot', desc: 'Upload your payment screenshot directly on the site.' },
    { num: '4', icon: '✅', title: 'Get Confirmed', desc: 'Admin verifies & sends your appointment confirmation instantly.' },
  ];

  return (
    <section className={`section ${styles.howItWorks}`}>
      <div className="container">
        <div className="section-header">
          <div className={`section-eyebrow ${styles.howEyebrow}`}>Simple Process</div>
          <h2 className={`heading-display heading-2 section-title ${styles.howTitle}`}>How It Works</h2>
          <p className={`section-subtitle ${styles.howSub}`}>Book your appointment in 4 simple steps.</p>
        </div>

        <motion.div
          className={styles.stepsGrid}
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
        >
          {steps.map((s, i) => (
            <motion.div key={i} variants={fadeUp} className={styles.stepCard}>
              <div className={styles.stepNum}>{s.num}</div>
              <div className={styles.stepIcon}>{s.icon}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Section: Reviews ──────────────────────────────────────────────
function ReviewsSection({ reviews }) {
  if (!reviews?.length) return null;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <section className={`section ${styles.reviews}`}>
      <div className="container">
        <div className="section-header">
          <div className="section-eyebrow">Patient Stories</div>
          <h2 className="heading-display heading-2 section-title">What Our Patients Say</h2>
        </div>

        <motion.div
          className={styles.reviewsGrid}
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
        >
          {reviews.slice(0, 6).map((r, i) => {
            const avatarClasses = [styles.avatarGreen, styles.avatarTerracotta, styles.avatarGold, styles.avatarBlue];
            const avatarClass = avatarClasses[i % avatarClasses.length];
            return (
              <motion.div key={r._id} variants={fadeUp} className={styles.reviewCard}>
                <div className={styles.reviewStars}>{stars(r.rating)}</div>
                <p className={styles.reviewText}>{r.comment}</p>
                <div className={styles.reviewAuthor}>
                  <div className={`${styles.reviewAvatar} ${avatarClass}`}>{r.user?.fullName?.charAt(0) || 'P'}</div>
                  <div>
                    <div className={styles.reviewName}>{r.user?.fullName || 'Patient'}</div>
                    <div className={styles.reviewType}>{r.consultationType === 'online' ? 'Online' : 'In-Clinic'} Consultation</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

// ── Section: FAQ ──────────────────────────────────────────────────
function FaqSection({ faqs }) {
  const defaultFaqs = [
    { question: 'How do I book an appointment?', answer: 'Click "Book Appointment", choose your preferred date & time slot, then pay via UPI and upload your payment screenshot.' },
    { question: 'Is online consultation available?', answer: 'Yes! We offer both online (via WhatsApp video) and in-clinic consultations.' },
    { question: 'What is the consultation fee?', answer: 'The fee is displayed during booking. Pay exactly the amount shown via UPI.' },
    { question: 'How do I get the WhatsApp link for online consultation?', answer: 'Once your payment is verified, you will receive the WhatsApp link via email and SMS.' },
  ];

  const items = faqs?.length ? faqs : defaultFaqs;

  return (
    <section className={`section ${styles.faq}`}>
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="section-header">
          <div className="section-eyebrow">FAQs</div>
          <h2 className="heading-display heading-2 section-title">Frequently Asked Questions</h2>
        </div>
        <div className={styles.faqList}>
          {items.map((f, i) => (
            <details key={i} className={styles.faqItem}>
              <summary className={styles.faqQ}>{f.question} <span className={styles.faqArrow}>›</span></summary>
              <p className={styles.faqA}>{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section: CTA ──────────────────────────────────────────────────
function CtaSection({ profile }) {
  return (
    <section className={`section ${styles.cta}`}>
      <div className={`container ${styles.ctaInner}`}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className={`heading-display heading-2 ${styles.ctaTitle}`}>
            Ready to Begin Your<br /><span>Healing Journey?</span>
          </h2>
          <p className={styles.ctaDesc}>
            Book a consultation with Specialist {profile?.name?.split(' ').slice(-1)[0] || 'Singhavi'} today.<br />
            Online &amp; in-clinic slots available Mon–Sat.
          </p>
          <div className={styles.ctaActions}>
            <Link to="/book" className={`btn btn-lg ${styles.ctaBtnWhite}`}>📅 Book Now — ₹{profile?.consultationFee || 500}</Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── HomePage (root) ───────────────────────────────────────────────
export default function HomePage() {
  const { data: profileData } = useQuery({
    queryKey: ['doctorProfile'],
    queryFn: () => profileService.getDoctorProfile().then((r) => r.data.data),
  });
  const { data: contentData } = useQuery({
    queryKey: ['websiteContent'],
    queryFn: () => profileService.getWebsiteContent().then((r) => r.data.data),
  });
  const { data: reviewsData } = useQuery({
    queryKey: ['publicReviews', 1],
    queryFn: () => reviewService.getPublic({ page: 1, limit: 6 }).then((r) => r.data.data),
  });

  const profile = profileData?.profile || profileData;
  const content = contentData?.content || contentData;
  const reviews = reviewsData?.reviews || [];

  return (
    <>
      <Helmet>
        <title>{content?.seo?.metaTitle || 'Aayush Health Care — Ayurvedic Consultancy, Amravati'}</title>
        <meta name="description" content={content?.seo?.metaDescription || 'Book an Ayurvedic consultation with Amrut Singhavi. Online & in-clinic sessions. Trusted Ayurvedic care in Amravati.'} />
        <meta name="keywords" content={content?.seo?.keywords?.join(', ') || 'ayurveda, Amravati, singhavi, acupressure specialist, neurotherapy specialist'} />
      </Helmet>

      <EmergencyBanner profile={profile} />
      <HeroSection profile={profile} content={content} />
      <StatsSection profile={profile} />
      <TestimonialsSection />
      <AboutSection profile={profile} content={content} />
      <ServicesSection content={content} />
      <HowItWorksSection />
      <ReviewsSection reviews={reviews} />
      <FaqSection faqs={content?.faqs} />
      <CtaSection profile={profile} />
    </>
  );
}
