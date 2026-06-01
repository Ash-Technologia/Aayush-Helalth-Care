import api from './api';

// ── Auth ──────────────────────────────────────────────────────────
export const authService = {
  // Step 1: request OTP
  requestOtp: (data) => api.post('/auth/request-otp', data),
  // Step 2: verify OTP → tokens
  verifyOtp:  (data) => api.post('/auth/verify-otp', data),
  // Refresh tokens
  refresh:    (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  // Logout (revoke refresh token server-side)
  logout:     (refreshToken) => api.post('/auth/logout', { refreshToken }),
  // Get current user (me)
  getMe:      () => api.get('/auth/me'),
  // Exchange short-lived code for tokens
  googleExchange: (code) => api.post('/auth/google/exchange', { code }),
};

// ── Profile (public) ──────────────────────────────────────────────
export const profileService = {
  getDoctorProfile: () => api.get('/profile/doctor'),
  getWebsiteContent:() => api.get('/profile/content'),
};

// ── Slots ─────────────────────────────────────────────────────────
export const slotsService = {
  getAvailability: (date, type) =>
    api.get('/slots/available', { params: { date, type } }),
};

// ── Appointments ──────────────────────────────────────────────────
export const appointmentService = {
  lockSlot:    (data) => api.post('/appointments/lock', data),
  getMyList:   (params) => api.get('/appointments/my', { params }),
  getById:     (id)    => api.get(`/appointments/${id}`),
  cancel:      (id, reason) => api.post(`/appointments/${id}/cancel`, { reason }),
  reschedule:  (id, data) => api.post(`/appointments/${id}/reschedule`, data),
};

// ── Payments ──────────────────────────────────────────────────────
export const paymentService = {
  submit: (formData) =>
    api.post('/payments/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getStatus: (appointmentId) => api.get(`/payments/status/${appointmentId}`),
};

// ── Reviews ───────────────────────────────────────────────────────
export const reviewService = {
  getPublic:  (params) => api.get('/reviews', { params }),
  getEligible:() => api.get('/reviews/eligible'),
  create:     (data)   => api.post('/reviews', data),
};

// ── Admin ─────────────────────────────────────────────────────────
export const adminService = {
  // Auth
  login: (data) => api.post('/admin/login', data),

  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'),

  // Payments
  listPayments:   (params) => api.get('/admin/payments', { params }),
  getPayment:     (id)     => api.get(`/admin/payments/${id}`),
  approvePayment: (id)     => api.post(`/admin/payments/${id}/approve`),
  rejectPayment:  (id, reason) => api.post(`/admin/payments/${id}/reject`, { reason }),

  // Appointments
  listAppointments: (params) => api.get('/admin/appointments', { params }),
  getAppointment:   (id)     => api.get(`/admin/appointments/${id}`),
  completeAppt:     (id)     => api.patch(`/admin/appointments/${id}/complete`),
  noShowAppt:       (id)     => api.patch(`/admin/appointments/${id}/no-show`),
  cancelAppt:       (id, reason) => api.patch(`/admin/appointments/${id}/cancel`, { reason }),

  // Slot templates
  listTemplates:  (params) => api.get('/admin/slots/templates', { params }),
  createTemplate: (data)   => api.post('/admin/slots/templates', data),
  updateTemplate: (id, data) => api.put(`/admin/slots/templates/${id}`, data),
  deleteTemplate: (id, hard) => api.delete(`/admin/slots/templates/${id}${hard ? '?hard=true' : ''}`),
  listHolidays:   () => api.get('/admin/slots/holidays'),
  createHoliday:  (data) => api.post('/admin/slots/holidays', data),
  deleteHoliday:  (id)   => api.delete(`/admin/slots/holidays/${id}`),
  previewSlots:   (date, type) => api.get('/admin/slots/preview', { params: { date, type } }),
  blockSlot:      (data) => api.post('/admin/slots/block', data),
  unblockSlot:    (appointmentId) => api.post('/admin/slots/unblock', { appointmentId }),

  // Profile
  getAdminProfile:  () => api.get('/admin/profile'),
  updateProfile:    (data) => api.put('/admin/profile', data),
  uploadQr:         (formData) => api.post('/admin/profile/qr', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadPhoto:      (formData) => api.post('/admin/profile/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleEmergency:  (data) => api.patch('/admin/profile/emergency', data),

  // Content (CMS)
  getContent:    () => api.get('/admin/content'),
  updateHero:    (data) => api.put('/admin/content/hero', data),
  updateAbout:   (data) => api.put('/admin/content/about', data),
  updateSeo:     (data) => api.put('/admin/content/seo', data),
  addService:    (data) => api.post('/admin/content/services', data),
  updateService: (id, data) => api.put(`/admin/content/services/${id}`, data),
  deleteService: (id)   => api.delete(`/admin/content/services/${id}`),
  addFaq:        (data) => api.post('/admin/content/faqs', data),
  updateFaq:     (id, data) => api.put(`/admin/content/faqs/${id}`, data),
  deleteFaq:     (id)   => api.delete(`/admin/content/faqs/${id}`),

  // Users
  listUsers:      (params) => api.get('/admin/users', { params }),
  getUser:        (id)     => api.get(`/admin/users/${id}`),
  deactivateUser: (id)     => api.patch(`/admin/users/${id}/deactivate`),
  activateUser:   (id)     => api.patch(`/admin/users/${id}/activate`),
};
