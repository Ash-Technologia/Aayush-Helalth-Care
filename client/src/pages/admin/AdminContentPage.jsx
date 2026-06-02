import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { adminService } from '@services';
import styles from './AdminContentPage.module.css';

export default function AdminContentPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('hero'); // hero, about, seo, services, faqs

  // Forms states
  const [heroForm, setHeroForm] = useState({
    headline: '',
    subheadline: '',
    ctaPrimary: '',
    ctaSecondary: '',
    videoUrl: '',
    videoPosterUrl: '',
    videoTitle: '',
  });
  const [aboutForm, setAboutForm] = useState({ sectionTitle: '', bodyText: '' });
  const [seoForm, setSeoForm] = useState({ metaTitle: '', metaDescription: '', keywordsRaw: '' });

  // Service form states (For adding/editing)
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({ title: '', description: '', icon: 'leaf', order: 0, isVisible: true });

  // FAQ form states (For adding/editing)
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', order: 0, isVisible: true });

  // Query: Get WebsiteContent CMS
  const { data: contentData, isLoading, error } = useQuery({
    queryKey: ['adminContent'],
    queryFn: async () => {
      const res = await adminService.getContent();
      return res.data.data.content;
    },
  });

  // Populate forms when data loads
  useEffect(() => {
    if (contentData) {
      setHeroForm({
        headline: contentData.hero?.headline || '',
        subheadline: contentData.hero?.subheadline || '',
        ctaPrimary: contentData.hero?.ctaPrimary || '',
        ctaSecondary: contentData.hero?.ctaSecondary || '',
        videoUrl: contentData.hero?.videoUrl || '',
        videoPosterUrl: contentData.hero?.videoPosterUrl || '',
        videoTitle: contentData.hero?.videoTitle || '',
      });
      setAboutForm({
        sectionTitle: contentData.about?.sectionTitle || '',
        bodyText: contentData.about?.bodyText || '',
      });
      setSeoForm({
        metaTitle: contentData.seo?.metaTitle || '',
        metaDescription: contentData.seo?.metaDescription || '',
        keywordsRaw: contentData.seo?.keywords ? contentData.seo.keywords.join(', ') : '',
      });
    }
  }, [contentData]);

  // Mutations
  const updateHeroMutation = useMutation({
    mutationFn: (data) => adminService.updateHero(data),
    onSuccess: () => {
      toast.success('Hero section updated.');
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update.'),
  });

  const updateAboutMutation = useMutation({
    mutationFn: (data) => adminService.updateAbout(data),
    onSuccess: () => {
      toast.success('About section updated.');
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update.'),
  });

  const updateSeoMutation = useMutation({
    mutationFn: (data) => adminService.updateSeo(data),
    onSuccess: () => {
      toast.success('SEO metadata updated.');
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update.'),
  });

  // Services mutations
  const addServiceMutation = useMutation({
    mutationFn: (data) => adminService.addService(data),
    onSuccess: () => {
      toast.success('Service added.');
      resetServiceForm();
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add.'),
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }) => adminService.updateService(id, data),
    onSuccess: () => {
      toast.success('Service updated.');
      resetServiceForm();
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update.'),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id) => adminService.deleteService(id),
    onSuccess: () => {
      toast.success('Service removed.');
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to remove.'),
  });

  // FAQ mutations
  const addFaqMutation = useMutation({
    mutationFn: (data) => adminService.addFaq(data),
    onSuccess: () => {
      toast.success('FAQ item added.');
      resetFaqForm();
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add.'),
  });

  const updateFaqMutation = useMutation({
    mutationFn: ({ id, data }) => adminService.updateFaq(id, data),
    onSuccess: () => {
      toast.success('FAQ item updated.');
      resetFaqForm();
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update.'),
  });

  const deleteFaqMutation = useMutation({
    mutationFn: (id) => adminService.deleteFaq(id),
    onSuccess: () => {
      toast.success('FAQ item removed.');
      queryClient.invalidateQueries(['adminContent']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to remove.'),
  });

  // Handlers
  const handleHeroSubmit = (e) => {
    e.preventDefault();
    updateHeroMutation.mutate(heroForm);
  };

  const handleAboutSubmit = (e) => {
    e.preventDefault();
    updateAboutMutation.mutate(aboutForm);
  };

  const handleSeoSubmit = (e) => {
    e.preventDefault();
    const keywords = seoForm.keywordsRaw
      ? seoForm.keywordsRaw.split(',').map((k) => k.trim()).filter((k) => k.length > 0)
      : [];
    updateSeoMutation.mutate({
      metaTitle: seoForm.metaTitle,
      metaDescription: seoForm.metaDescription,
      keywords,
    });
  };

  // Service form handlers
  const resetServiceForm = () => {
    setEditingServiceId(null);
    setServiceForm({ title: '', description: '', icon: 'leaf', order: 0, isVisible: true });
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    if (editingServiceId) {
      updateServiceMutation.mutate({ id: editingServiceId, data: serviceForm });
    } else {
      addServiceMutation.mutate(serviceForm);
    }
  };

  const handleEditServiceClick = (s) => {
    setEditingServiceId(s._id);
    setServiceForm({
      title: s.title,
      description: s.description,
      icon: s.icon,
      order: s.order,
      isVisible: s.isVisible,
    });
  };

  // FAQ form handlers
  const resetFaqForm = () => {
    setEditingFaqId(null);
    setFaqForm({ question: '', answer: '', order: 0, isVisible: true });
  };

  const handleFaqSubmit = (e) => {
    e.preventDefault();
    if (editingFaqId) {
      updateFaqMutation.mutate({ id: editingFaqId, data: faqForm });
    } else {
      addFaqMutation.mutate(faqForm);
    }
  };

  const handleEditFaqClick = (f) => {
    setEditingFaqId(f._id);
    setFaqForm({
      question: f.question,
      answer: f.answer,
      order: f.order,
      isVisible: f.isVisible,
    });
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
        <p>Loading CMS content settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>Failed to load CMS content.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Manage Website Content — Aayush Health Care</title>
      </Helmet>

      <div className="page-enter">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>CMS Website Builder</h1>
            <p className={styles.subtitle}>Modify static website content, headers, keywords, and accordion FAQs.</p>
          </div>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeTab === 'hero' ? styles.tabActive : ''}`} onClick={() => setActiveTab('hero')}>Hero Banner</button>
            <button className={`${styles.tab} ${activeTab === 'about' ? styles.tabActive : ''}`} onClick={() => setActiveTab('about')}>About Clinic</button>
            <button className={`${styles.tab} ${activeTab === 'seo' ? styles.tabActive : ''}`} onClick={() => setActiveTab('seo')}>SEO Configuration</button>
            <button className={`${styles.tab} ${activeTab === 'services' ? styles.tabActive : ''}`} onClick={() => setActiveTab('services')}>Services Ledger</button>
            <button className={`${styles.tab} ${activeTab === 'faqs' ? styles.tabActive : ''}`} onClick={() => setActiveTab('faqs')}>FAQ Accordions</button>
          </div>
        </div>

        {/* ─── HERO TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'hero' && (
          <form onSubmit={handleHeroSubmit} className={styles.formPanel}>
            <h2>Hero Landing Configuration</h2>
            <div className={styles.formStack}>
              <div className="form-group">
                <label className="form-label" htmlFor="headline">Main Hero Headline</label>
                <input
                  id="headline"
                  className="form-input"
                  value={heroForm.headline}
                  onChange={(e) => setHeroForm((p) => ({ ...p, headline: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="subheadline">Hero Subheadline / Caption</label>
                <textarea
                  id="subheadline"
                  className="form-input"
                  rows="3"
                  value={heroForm.subheadline}
                  onChange={(e) => setHeroForm((p) => ({ ...p, subheadline: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.formRow}>
                <div className="form-group">
                  <label className="form-label" htmlFor="ctaPrimary">Primary Button Text</label>
                  <input
                    id="ctaPrimary"
                    className="form-input"
                    value={heroForm.ctaPrimary}
                    onChange={(e) => setHeroForm((p) => ({ ...p, ctaPrimary: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ctaSecondary">Secondary Button Text</label>
                  <input
                    id="ctaSecondary"
                    className="form-input"
                    value={heroForm.ctaSecondary}
                    onChange={(e) => setHeroForm((p) => ({ ...p, ctaSecondary: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className="form-group">
                  <label className="form-label" htmlFor="videoUrl">Intro YouTube URL</label>
                  <input
                    id="videoUrl"
                    className="form-input"
                    value={heroForm.videoUrl}
                    onChange={(e) => setHeroForm((p) => ({ ...p, videoUrl: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="videoTitle">Intro Video Title</label>
                  <input
                    id="videoTitle"
                    className="form-input"
                    value={heroForm.videoTitle}
                    onChange={(e) => setHeroForm((p) => ({ ...p, videoTitle: e.target.value }))}
                    placeholder="Aayush Health Care introduction"
                  />
                </div>
              </div>

              <div className={styles.submitRow}>
                <button type="submit" className="btn btn-primary" disabled={updateHeroMutation.isPending}>
                  {updateHeroMutation.isPending ? 'Saving...' : 'Update Landing Banner'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ─── ABOUT TAB ────────────────────────────────────────────────── */}
        {activeTab === 'about' && (
          <form onSubmit={handleAboutSubmit} className={styles.formPanel}>
            <h2>About Clinic Section</h2>
            <div className={styles.formStack}>
              <div className="form-group">
                <label className="form-label" htmlFor="secTitle">Section Title Text</label>
                <input
                  id="secTitle"
                  className="form-input"
                  value={aboutForm.sectionTitle}
                  onChange={(e) => setAboutForm((p) => ({ ...p, sectionTitle: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bodyText">Section Narrative / Body Text</label>
                <textarea
                  id="bodyText"
                  className="form-input"
                  rows="8"
                  value={aboutForm.bodyText}
                  onChange={(e) => setAboutForm((p) => ({ ...p, bodyText: e.target.value }))}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className={styles.submitRow}>
                <button type="submit" className="btn btn-primary" disabled={updateAboutMutation.isPending}>
                  {updateAboutMutation.isPending ? 'Saving...' : 'Update Section Content'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ─── SEO TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'seo' && (
          <form onSubmit={handleSeoSubmit} className={styles.formPanel}>
            <h2>SEO & Metadata Settings</h2>
            <div className={styles.formStack}>
              <div className="form-group">
                <label className="form-label" htmlFor="metaTitle">Browser Window Title (metaTitle)</label>
                <input
                  id="metaTitle"
                  className="form-input"
                  value={seoForm.metaTitle}
                  onChange={(e) => setSeoForm((p) => ({ ...p, metaTitle: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="metaDesc">Search Snippet Description (metaDescription)</label>
                <textarea
                  id="metaDesc"
                  className="form-input"
                  rows="4"
                  value={seoForm.metaDescription}
                  onChange={(e) => setSeoForm((p) => ({ ...p, metaDescription: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="keywords">Search Keywords (Comma-separated)</label>
                <input
                  id="keywords"
                  className="form-input"
                  placeholder="e.g. Ayurveda, Pune Clinic, Dr Singhavi, Panchakarma"
                  value={seoForm.keywordsRaw}
                  onChange={(e) => setSeoForm((p) => ({ ...p, keywordsRaw: e.target.value }))}
                />
              </div>

              <div className={styles.submitRow}>
                <button type="submit" className="btn btn-primary" disabled={updateSeoMutation.isPending}>
                  {updateSeoMutation.isPending ? 'Saving...' : 'Update Meta Configuration'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ─── SERVICES TAB ──────────────────────────────────────────────── */}
        {activeTab === 'services' && (
          <div className={styles.layoutTwoCol}>
            {/* Form */}
            <div className={styles.formPanel}>
              <h2>{editingServiceId ? 'Edit Medical Service' : 'Add Medical Service'}</h2>
              <form onSubmit={handleServiceSubmit} className={styles.formStack}>
                <div className="form-group">
                  <label className="form-label" htmlFor="sName">Service Name</label>
                  <input
                    id="sName"
                    className="form-input"
                    value={serviceForm.title}
                    onChange={(e) => setServiceForm((p) => ({ ...p, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="sDesc">Brief Description</label>
                  <textarea
                    id="sDesc"
                    className="form-input"
                    rows="3"
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="sIcon">Icon Keyword</label>
                    <select
                      id="sIcon"
                      className="form-input"
                      value={serviceForm.icon}
                      onChange={(e) => setServiceForm((p) => ({ ...p, icon: e.target.value }))}
                    >
                      <option value="leaf">🌿 Herb Leaf</option>
                      <option value="heart">❤️ Healing Heart</option>
                      <option value="spa">🌸 Lotus Spa</option>
                      <option value="activity">⚡ Pulse Activity</option>
                      <option value="shield">🛡️ Shield Cover</option>
                      <option value="clock">🕒 Timing Clock</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="sOrder">Display Order</label>
                    <input
                      id="sOrder"
                      type="number"
                      className="form-input"
                      value={serviceForm.order}
                      onChange={(e) => setServiceForm((p) => ({ ...p, order: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className={styles.checkboxGroup}>
                  <input
                    id="sVisible"
                    type="checkbox"
                    checked={serviceForm.isVisible}
                    onChange={(e) => setServiceForm((p) => ({ ...p, isVisible: e.target.checked }))}
                  />
                  <label htmlFor="sVisible">Visible on Public Homepage</label>
                </div>

                <div className={styles.formActions}>
                  {editingServiceId && (
                    <button type="button" onClick={resetServiceForm} className="btn btn-secondary btn-sm">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addServiceMutation.isPending || updateServiceMutation.isPending}>
                    {editingServiceId ? 'Update Service' : 'Add Service'}
                  </button>
                </div>
              </form>
            </div>

            {/* List */}
            <div className={styles.listPanel}>
              <h2>Website Services</h2>
              <div className={styles.cardList}>
                {contentData.services?.length === 0 ? (
                  <p className={styles.mutedText}>No services configured.</p>
                ) : (
                  contentData.services?.map((s) => (
                    <div key={s._id} className={styles.contentItemCard}>
                      <div>
                        <h3>{s.title} <span className={styles.orderLabel}>[Order: {s.order}]</span></h3>
                        <p>{s.description}</p>
                        <div style={{ marginTop: 6 }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Icon: {s.icon}</span>
                          {!s.isVisible && <span className="badge badge-danger" style={{ fontSize: '0.7rem', marginLeft: 8 }}>Hidden</span>}
                        </div>
                      </div>
                      <div className={styles.itemActions}>
                        <button onClick={() => handleEditServiceClick(s)} className={styles.editBtn}>Edit</button>
                        <button onClick={() => {
                          if (window.confirm('Delete this service permanently?')) {
                            deleteServiceMutation.mutate(s._id);
                          }
                        }} className={styles.deleteBtn}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── FAQS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'faqs' && (
          <div className={styles.layoutTwoCol}>
            {/* Form */}
            <div className={styles.formPanel}>
              <h2>{editingFaqId ? 'Edit FAQ Accordion' : 'Add FAQ Accordion'}</h2>
              <form onSubmit={handleFaqSubmit} className={styles.formStack}>
                <div className="form-group">
                  <label className="form-label" htmlFor="fQuest">Question Text</label>
                  <input
                    id="fQuest"
                    className="form-input"
                    value={faqForm.question}
                    onChange={(e) => setFaqForm((p) => ({ ...p, question: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="fAns">Answer Text</label>
                  <textarea
                    id="fAns"
                    className="form-input"
                    rows="4"
                    value={faqForm.answer}
                    onChange={(e) => setFaqForm((p) => ({ ...p, answer: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="fOrder">Display Order</label>
                  <input
                    id="fOrder"
                    type="number"
                    className="form-input"
                    value={faqForm.order}
                    onChange={(e) => setFaqForm((p) => ({ ...p, order: Number(e.target.value) }))}
                  />
                </div>

                <div className={styles.checkboxGroup}>
                  <input
                    id="fVisible"
                    type="checkbox"
                    checked={faqForm.isVisible}
                    onChange={(e) => setFaqForm((p) => ({ ...p, isVisible: e.target.checked }))}
                  />
                  <label htmlFor="fVisible">Visible on Public Homepage</label>
                </div>

                <div className={styles.formActions}>
                  {editingFaqId && (
                    <button type="button" onClick={resetFaqForm} className="btn btn-secondary btn-sm">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addFaqMutation.isPending || updateFaqMutation.isPending}>
                    {editingFaqId ? 'Update FAQ' : 'Add FAQ'}
                  </button>
                </div>
              </form>
            </div>

            {/* List */}
            <div className={styles.listPanel}>
              <h2>Accordion FAQs</h2>
              <div className={styles.cardList}>
                {contentData.faqs?.length === 0 ? (
                  <p className={styles.mutedText}>No FAQs configured.</p>
                ) : (
                  contentData.faqs?.map((f) => (
                    <div key={f._id} className={styles.contentItemCard}>
                      <div>
                        <h3>Q: {f.question} <span className={styles.orderLabel}>[Order: {f.order}]</span></h3>
                        <p>A: {f.answer}</p>
                        {!f.isVisible && <span className="badge badge-danger" style={{ fontSize: '0.7rem', marginTop: 6 }}>Hidden</span>}
                      </div>
                      <div className={styles.itemActions}>
                        <button onClick={() => handleEditFaqClick(f)} className={styles.editBtn}>Edit</button>
                        <button onClick={() => {
                          if (window.confirm('Delete this FAQ permanently?')) {
                            deleteFaqMutation.mutate(f._id);
                          }
                        }} className={styles.deleteBtn}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
