import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { adminService } from '@services';
import styles from './AdminProfilePage.module.css';

export default function AdminProfilePage() {
  const queryClient = useQueryClient();

  // File Upload states
  const [photoFile, setPhotoFile] = useState(null);
  const [qrFile, setQrFile] = useState(null);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isQrUploading, setIsQrUploading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    about: '',
    experience: 0,
    consultationFee: 500,
    contactEmail: '',
    contactPhone: '',
    whatsappNumber: '',
    specializationsRaw: '',
    isEmergencyClosed: false,
    emergencyMessage: '',
    payment: {
      upiId: '',
      accountName: '',
      instructions: '',
    },
    stats: {
      yearsExperience: 0,
      totalPatients: 0,
      totalTreatments: 0,
      satisfactionRate: 100,
    },
    degrees: [],
    achievements: [],
  });

  // Degree/Achievement Add States
  const [newDegree, setNewDegree] = useState({ title: '', institution: '', year: new Date().getFullYear() });
  const [newAchievement, setNewAchievement] = useState({ title: '', description: '', year: new Date().getFullYear() });

  // Query: Get Profile
  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['adminProfile'],
    queryFn: async () => {
      const res = await adminService.getAdminProfile();
      return res.data.data.profile;
    },
  });

  // Populate form once data loads
  useEffect(() => {
    if (profileData) {
      setFormData({
        name: profileData.name || '',
        tagline: profileData.tagline || '',
        about: profileData.about || '',
        experience: profileData.experience || 0,
        consultationFee: profileData.consultationFee || 500,
        contactEmail: profileData.contactEmail || '',
        contactPhone: profileData.contactPhone || '',
        whatsappNumber: profileData.whatsappNumber || '',
        specializationsRaw: profileData.specializations ? profileData.specializations.join(', ') : '',
        isEmergencyClosed: profileData.isEmergencyClosed || false,
        emergencyMessage: profileData.emergencyMessage || '',
        payment: {
          upiId: profileData.payment?.upiId || '',
          accountName: profileData.payment?.accountName || '',
          instructions: profileData.payment?.instructions || '',
        },
        stats: {
          yearsExperience: profileData.stats?.yearsExperience || 0,
          totalPatients: profileData.stats?.totalPatients || 0,
          totalTreatments: profileData.stats?.totalTreatments || 0,
          satisfactionRate: profileData.stats?.satisfactionRate || 100,
        },
        degrees: profileData.degrees || [],
        achievements: profileData.achievements || [],
      });
    }
  }, [profileData]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data) => adminService.updateProfile(data),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Profile changes saved!');
      queryClient.invalidateQueries(['adminProfile']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    },
  });

  const toggleEmergencyMutation = useMutation({
    mutationFn: (data) => adminService.toggleEmergency(data),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Emergency status updated.');
      queryClient.invalidateQueries(['adminProfile']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to toggle emergency status.');
    },
  });

  // Handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      payment: {
        ...prev.payment,
        [name]: value,
      },
    }));
  };

  const handleStatsChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        [name]: Number(value),
      },
    }));
  };

  // Submit Profile Changes
  const handleSubmitProfile = (e) => {
    e.preventDefault();
    const parsedSpecializations = formData.specializationsRaw
      ? formData.specializationsRaw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      : [];

    updateProfileMutation.mutate({
      name: formData.name,
      tagline: formData.tagline,
      about: formData.about,
      experience: Number(formData.experience),
      consultationFee: Number(formData.consultationFee),
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      whatsappNumber: formData.whatsappNumber,
      specializations: parsedSpecializations,
      payment: formData.payment,
      stats: formData.stats,
      degrees: formData.degrees,
      achievements: formData.achievements,
    });
  };

  // Submit Emergency Toggle
  const handleToggleEmergency = () => {
    toggleEmergencyMutation.mutate({
      isEmergencyClosed: !formData.isEmergencyClosed,
      emergencyMessage: formData.emergencyMessage,
    });
  };

  // Upload Photo
  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    if (!photoFile) {
      toast.error('Choose a photo file first.');
      return;
    }
    const form = new FormData();
    form.append('photo', photoFile);

    setIsPhotoUploading(true);
    try {
      const res = await adminService.uploadPhoto(form);
      toast.success(res.data.message || 'Photo updated successfully.');
      setPhotoFile(null);
      queryClient.invalidateQueries(['adminProfile']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Photo upload failed.');
    } finally {
      setIsPhotoUploading(false);
    }
  };

  // Upload QR code
  const handleQrUpload = async (e) => {
    e.preventDefault();
    if (!qrFile) {
      toast.error('Choose a QR image file first.');
      return;
    }
    const form = new FormData();
    form.append('qr', qrFile);

    setIsQrUploading(true);
    try {
      const res = await adminService.uploadQr(form);
      toast.success(res.data.message || 'UPI QR Code updated successfully.');
      setQrFile(null);
      queryClient.invalidateQueries(['adminProfile']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'QR upload failed.');
    } finally {
      setIsQrUploading(false);
    }
  };

  // Degrees Management
  const addDegree = () => {
    if (!newDegree.title || !newDegree.institution) {
      toast.error('Please fill Degree Title and Institution.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      degrees: [...prev.degrees, { ...newDegree, order: prev.degrees.length }],
    }));
    setNewDegree({ title: '', institution: '', year: new Date().getFullYear() });
  };

  const removeDegree = (index) => {
    setFormData((prev) => ({
      ...prev,
      degrees: prev.degrees.filter((_, i) => i !== index),
    }));
  };

  // Achievements Management
  const addAchievement = () => {
    if (!newAchievement.title) {
      toast.error('Achievement title is required.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      achievements: [...prev.achievements, { ...newAchievement, order: prev.achievements.length }],
    }));
    setNewAchievement({ title: '', description: '', year: new Date().getFullYear() });
  };

  const removeAchievement = (index) => {
    setFormData((prev) => ({
      ...prev,
      achievements: prev.achievements.filter((_, i) => i !== index),
    }));
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
        <p>Loading clinic profile details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>Failed to load profile settings.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Manage Doctor Profile — Aayush Health Care</title>
      </Helmet>

      <div className="page-enter">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Clinic & Doctor Profile</h1>
            <p className={styles.subtitle}>Customize consult fees, doctor bios, UPI configurations, and emergency settings.</p>
          </div>
        </div>

        {/* 🚨 Emergency Closure panel */}
        <div className={styles.emergencyPanel} style={{ borderColor: formData.isEmergencyClosed ? 'var(--clr-danger)' : 'var(--border-subtle)' }}>
          <div className={styles.emergencyLeft}>
            <span className={styles.emergencyIcon}>🚨</span>
            <div>
              <h3>Emergency Closure Settings</h3>
              <p>Instantly shut down bookings and show an alert banner to patients when the doctor is out or clinic is closed due to emergencies.</p>
            </div>
          </div>
          <div className={styles.emergencyRight}>
            <input
              type="text"
              name="emergencyMessage"
              className="form-input"
              style={{ minWidth: 320, background: 'var(--bg-elevated)' }}
              placeholder="Display warning banner text..."
              value={formData.emergencyMessage}
              onChange={handleInputChange}
            />
            <button
              onClick={handleToggleEmergency}
              className={`btn ${formData.isEmergencyClosed ? 'btn-secondary' : 'btn-danger'}`}
              disabled={toggleEmergencyMutation.isPending}
            >
              {formData.isEmergencyClosed ? 'Reopen Bookings' : 'Close Clinic Booking'}
            </button>
          </div>
        </div>

        {/* Form Sections Layout */}
        <div className={styles.layoutTwoCol}>
          {/* Main Info */}
          <div className={styles.mainCol}>
            <form onSubmit={handleSubmitProfile} className={styles.formPanel}>
              <h2>Consultation Fees & Bios</h2>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label" htmlFor="name">Consultant Full Name</label>
                  <input id="name" name="name" className="form-input" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="tagline">Sub-tagline</label>
                  <input id="tagline" name="tagline" className="form-input" value={formData.tagline} onChange={handleInputChange} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="about">Professional Bio / About Me</label>
                  <textarea id="about" name="about" className="form-input" rows="5" value={formData.about} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="experience">Years Experience</label>
                  <input id="experience" type="number" name="experience" className="form-input" value={formData.experience} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="fee">Consultation Fee (₹)</label>
                  <input id="fee" type="number" name="consultationFee" className="form-input" value={formData.consultationFee} onChange={handleInputChange} required />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="specs">Specializations (Comma-separated)</label>
                  <input id="specs" name="specializationsRaw" className="form-input" placeholder="e.g. Panchakarma, Nadi Pariksha, General Wellness" value={formData.specializationsRaw} onChange={handleInputChange} />
                </div>
              </div>

              <h2 style={{ marginTop: 32 }}>Trust statistics (Homepage indicators)</h2>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label" htmlFor="sExp">Experience Count (Stat block)</label>
                  <input id="sExp" type="number" name="yearsExperience" className="form-input" value={formData.stats.yearsExperience} onChange={handleStatsChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="sPatients">Total Happy Patients</label>
                  <input id="sPatients" type="number" name="totalPatients" className="form-input" value={formData.stats.totalPatients} onChange={handleStatsChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="sTreats">Ayurvedic Treatments Conducted</label>
                  <input id="sTreats" type="number" name="totalTreatments" className="form-input" value={formData.stats.totalTreatments} onChange={handleStatsChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="sSat">Satisfaction Rate (%)</label>
                  <input id="sSat" type="number" min="0" max="100" name="satisfactionRate" className="form-input" value={formData.stats.satisfactionRate} onChange={handleStatsChange} />
                </div>
              </div>

              <h2 style={{ marginTop: 32 }}>Contact Details</h2>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email address</label>
                  <input id="email" name="contactEmail" className="form-input" type="email" value={formData.contactEmail} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Contact phone number</label>
                  <input id="phone" name="contactPhone" className="form-input" value={formData.contactPhone} onChange={handleInputChange} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="waNum">WhatsApp Alert/Notification Number</label>
                  <input id="waNum" name="whatsappNumber" className="form-input" value={formData.whatsappNumber} onChange={handleInputChange} />
                </div>
              </div>

              {/* Degrees & Qualifications array sub-form */}
              <h2 style={{ marginTop: 32 }}>Degrees & Credentials</h2>
              <div className={styles.credentialsSection}>
                <div className={styles.credentialForm}>
                  <input
                    type="text"
                    placeholder="Degree Title (e.g. BAMS)"
                    className="form-input"
                    value={newDegree.title}
                    onChange={(e) => setNewDegree((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Institution (e.g. Pune Ayurvedic College)"
                    className="form-input"
                    value={newDegree.institution}
                    onChange={(e) => setNewDegree((prev) => ({ ...prev, institution: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="Year"
                    className="form-input"
                    value={newDegree.year}
                    onChange={(e) => setNewDegree((prev) => ({ ...prev, year: Number(e.target.value) }))}
                  />
                  <button type="button" onClick={addDegree} className="btn btn-secondary btn-sm">Add</button>
                </div>
                <ul className={styles.credentialList}>
                  {formData.degrees.map((d, index) => (
                    <li key={index} className={styles.credentialItem}>
                      <div>
                        <strong>{d.title}</strong> &mdash; {d.institution} ({d.year})
                      </div>
                      <button type="button" onClick={() => removeDegree(index)} className={styles.removeBtn}>&times;</button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Achievements array sub-form */}
              <h2 style={{ marginTop: 32 }}>Achievements & Awards</h2>
              <div className={styles.credentialsSection}>
                <div className={styles.credentialForm}>
                  <input
                    type="text"
                    placeholder="Award/Achievement Title"
                    className="form-input"
                    value={newAchievement.title}
                    onChange={(e) => setNewAchievement((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Brief description (Optional)"
                    className="form-input"
                    value={newAchievement.description}
                    onChange={(e) => setNewAchievement((prev) => ({ ...prev, description: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="Year"
                    className="form-input"
                    value={newAchievement.year}
                    onChange={(e) => setNewAchievement((prev) => ({ ...prev, year: Number(e.target.value) }))}
                  />
                  <button type="button" onClick={addAchievement} className="btn btn-secondary btn-sm">Add</button>
                </div>
                <ul className={styles.credentialList}>
                  {formData.achievements.map((a, index) => (
                    <li key={index} className={styles.credentialItem}>
                      <div>
                        <strong>{a.title}</strong> {a.description && `— ${a.description}`} ({a.year})
                      </div>
                      <button type="button" onClick={() => removeAchievement(index)} className={styles.removeBtn}>&times;</button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Submit changes button */}
              <div className={styles.submitRow}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minWidth: 200 }}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Payments Configuration & Photo Upload */}
          <div className={styles.sideCol}>
            {/* Image Uploads panel */}
            <div className={styles.formPanel}>
              <h2>Doctor Portrait Photo</h2>
              {profileData?.imageUrl && (
                <div className={styles.avatarPreview}>
                  <img src={profileData.imageUrl} alt="Doctor portrait" />
                </div>
              )}
              <form onSubmit={handlePhotoUpload} className={styles.uploadForm}>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={!photoFile || isPhotoUploading}
                  style={{ width: '100%' }}
                >
                  {isPhotoUploading ? 'Uploading...' : 'Upload Portrait'}
                </button>
              </form>
            </div>

            {/* UPI payment configurations */}
            <div className={styles.formPanel} style={{ marginTop: 24 }}>
              <h2>Manual UPI Payments Setup</h2>
              <form onSubmit={handleSubmitProfile} className={styles.form}>
                <div className="form-group">
                  <label className="form-label" htmlFor="accountName">UPI Registered Account Name</label>
                  <input
                    id="accountName"
                    name="accountName"
                    className="form-input"
                    value={formData.payment.accountName}
                    onChange={handlePaymentChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="upiId">UPI ID (e.g. doctor@ybl)</label>
                  <input
                    id="upiId"
                    name="upiId"
                    className="form-input"
                    value={formData.payment.upiId}
                    onChange={handlePaymentChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="instructions">Payment Instructions shown to users</label>
                  <textarea
                    id="instructions"
                    name="instructions"
                    className="form-input"
                    rows="4"
                    value={formData.payment.instructions}
                    onChange={handlePaymentChange}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Update UPI Details'}
                </button>
              </form>

              <hr className="divider" />

              <h2>UPI Payment QR Code</h2>
              {profileData?.payment?.qrImageUrl && (
                <div className={styles.qrPreview}>
                  <img src={profileData.payment.qrImageUrl} alt="UPI QR Code" />
                </div>
              )}
              <form onSubmit={handleQrUpload} className={styles.uploadForm}>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => setQrFile(e.target.files[0])}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={!qrFile || isQrUploading}
                  style={{ width: '100%' }}
                >
                  {isQrUploading ? 'Uploading...' : 'Upload QR Image'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
