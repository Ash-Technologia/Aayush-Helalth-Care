import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminService } from '@services';
import styles from './AdminSlotsPage.module.css';

const DAYS = [
  { val: 0, label: 'Sunday' },
  { val: 1, label: 'Monday' },
  { val: 2, label: 'Tuesday' },
  { val: 3, label: 'Wednesday' },
  { val: 4, label: 'Thursday' },
  { val: 5, label: 'Friday' },
  { val: 6, label: 'Saturday' },
];

const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

export default function AdminSlotsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('templates'); // templates, holidays, preview

  // Template Form State
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [slotDurationMins, setSlotDurationMins] = useState(30);
  const [consultationType, setConsultationType] = useState('clinic');
  const [templateLabel, setTemplateLabel] = useState('');

  // Holiday Form State
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');
  const [holidayRecurring, setHolidayRecurring] = useState(false);

  // Preview Form State
  const [previewDate, setPreviewDate] = useState('');
  const [previewType, setPreviewType] = useState('clinic');
  const [previewResults, setPreviewResults] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Query: Templates
  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery({
    queryKey: ['adminTemplates'],
    queryFn: async () => {
      const res = await adminService.listTemplates();
      return res.data.data.templates;
    },
  });

  // Query: Holidays
  const { data: holidaysData, isLoading: isHolidaysLoading } = useQuery({
    queryKey: ['adminHolidays'],
    queryFn: async () => {
      const res = await adminService.listHolidays();
      return res.data.data.holidays;
    },
  });

  // Mutations: Templates
  const createTemplateMutation = useMutation({
    mutationFn: (data) => adminService.createTemplate(data),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Template created successfully.');
      setTemplateLabel('');
      queryClient.invalidateQueries(['adminTemplates']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Failed to create template.';
      toast.error(msg);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: ({ id, hard }) => adminService.deleteTemplate(id, hard),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Template removed.');
      queryClient.invalidateQueries(['adminTemplates']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Failed to remove template.';
      toast.error(msg);
    },
  });

  // Mutations: Holidays
  const createHolidayMutation = useMutation({
    mutationFn: (data) => adminService.createHoliday(data),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Holiday scheduled.');
      setHolidayDate('');
      setHolidayReason('');
      setHolidayRecurring(false);
      queryClient.invalidateQueries(['adminHolidays']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Failed to schedule holiday.';
      toast.error(msg);
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id) => adminService.deleteHoliday(id),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Holiday deleted.');
      queryClient.invalidateQueries(['adminHolidays']);
    },
    onError: (err) => {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Failed to remove holiday.';
      toast.error(msg);
    },
  });

  // Template Form Submit
  const handleTemplateSubmit = (e) => {
    e.preventDefault();
    createTemplateMutation.mutate({
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMins,
      consultationType,
      label: templateLabel,
    });
  };

  // Holiday Form Submit
  const handleHolidaySubmit = (e) => {
    e.preventDefault();
    if (!holidayDate) {
      toast.error('Please select a date.');
      return;
    }
    createHolidayMutation.mutate({
      date: holidayDate,
      reason: holidayReason,
      isRecurring: holidayRecurring,
    });
  };

  // Preview Submit
  const handlePreviewSubmit = async (e) => {
    e.preventDefault();
    if (!previewDate) {
      toast.error('Please choose a date to preview.');
      return;
    }
    setIsPreviewLoading(true);
    try {
      const res = await adminService.previewSlots(previewDate, previewType);
      setPreviewResults(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch slot preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleBlockSlot = async (slot) => {
    const confirm = window.confirm(`Are you sure you want to block the slot ${slot.slotStart} - ${slot.slotEnd} on ${previewDate}?`);
    if (!confirm) return;

    try {
      await adminService.blockSlot({
        date: previewDate,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        consultationType: previewType,
      });
      toast.success('Slot blocked successfully.');
      // Refresh preview results
      const res = await adminService.previewSlots(previewDate, previewType);
      setPreviewResults(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block slot.');
    }
  };

  const handleUnblockSlot = async (appointmentId) => {
    const confirm = window.confirm('Are you sure you want to unblock this slot?');
    if (!confirm) return;

    try {
      await adminService.unblockSlot(appointmentId);
      toast.success('Slot unblocked successfully.');
      // Refresh preview results
      const res = await adminService.previewSlots(previewDate, previewType);
      setPreviewResults(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unblock slot.');
    }
  };

  const getDayName = (dayNum) => DAYS.find((d) => d.val === dayNum)?.label || '';

  return (
    <>
      <Helmet>
        <title>Slot & Holiday Planner — Aayush Health Care</title>
      </Helmet>

      <div className="page-enter">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Schedule Planner</h1>
            <p className={styles.subtitle}>Configure weekly slot blocks, clinic holidays, and preview slots generation.</p>
          </div>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'templates' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              Weekly Templates
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'holidays' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('holidays')}
            >
              Clinic Holidays
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'preview' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              Generate Preview
            </button>
          </div>
        </div>

        {/* ─── WEEKLY TEMPLATES TAB ────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div className={styles.layoutTwoCol}>
            {/* Template Creator Form */}
            <div className={styles.formPanel}>
              <h2>Add Weekly Slot Block</h2>
              <form onSubmit={handleTemplateSubmit} className={styles.form}>
                <div className="form-group">
                  <label className="form-label" htmlFor="dayOfWeek">Day of Week</label>
                  <select
                    id="dayOfWeek"
                    className="form-input"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  >
                    {DAYS.map((d) => (
                      <option key={d.val} value={d.val}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="startTime">Start Time</label>
                    <input
                      id="startTime"
                      type="time"
                      className="form-input"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="endTime">End Time</label>
                    <input
                      id="endTime"
                      type="time"
                      className="form-input"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="duration">Slot Duration</label>
                    <select
                      id="duration"
                      className="form-input"
                      value={slotDurationMins}
                      onChange={(e) => setSlotDurationMins(Number(e.target.value))}
                    >
                      {DURATIONS.map((dur) => (
                        <option key={dur} value={dur}>{dur} Minutes</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="type">Consultation Type</label>
                    <select
                      id="type"
                      className="form-input"
                      value={consultationType}
                      onChange={(e) => setConsultationType(e.target.value)}
                    >
                      <option value="clinic">In-Clinic Only</option>
                      <option value="online">Online Only</option>
                      <option value="both">Both (Online + Clinic)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="label">Friendly Name / Label (Optional)</label>
                  <input
                    id="label"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Morning General Session"
                    value={templateLabel}
                    onChange={(e) => setTemplateLabel(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending ? 'Saving...' : 'Add Template Block &rarr;'}
                </button>
              </form>
            </div>

            {/* Templates List */}
            <div className={styles.listPanel}>
              <h2>Active Weekly Schedules</h2>
              {isTemplatesLoading ? (
                <div className={styles.listLoading}><div className="spinner" /></div>
              ) : !templatesData || templatesData.length === 0 ? (
                <div className={styles.listEmpty}>
                  <p>No slot templates configured. The calendar will appear fully booked.</p>
                </div>
              ) : (
                <div className={styles.cardList}>
                  {templatesData.map((t) => (
                    <div key={t._id} className={`${styles.scheduleCard} ${!t.isActive ? styles.deactivated : ''}`}>
                      <div className={styles.scheduleHeader}>
                        <div>
                          <span className={styles.dayBadge}>{getDayName(t.dayOfWeek)}</span>
                          {t.label && <span className={styles.labelBadge}>{t.label}</span>}
                        </div>
                        <div className={styles.cardActions}>
                          {t.isActive ? (
                            <button
                              onClick={() => deleteTemplateMutation.mutate({ id: t._id, hard: false })}
                              className={styles.deactivateBtn}
                              title="Deactivate Template"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <span className={styles.inactiveLabel}>Deactivated</span>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Permanently delete this weekly template? Historical bookings will not be impacted, but new slots will not generate.')) {
                                deleteTemplateMutation.mutate({ id: t._id, hard: true });
                              }
                            }}
                            className={styles.deleteBtn}
                            title="Hard Delete Template"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className={styles.scheduleDetails}>
                        <div>🕗 <strong>{t.startTime} - {t.endTime}</strong> ({t.slotDurationMins}m slots)</div>
                        <div style={{ textTransform: 'capitalize', marginTop: 4 }}>
                          Type: <span className="badge badge-neutral" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>{t.consultationType}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CLINIC HOLIDAYS TAB ─────────────────────────────────────────── */}
        {activeTab === 'holidays' && (
          <div className={styles.layoutTwoCol}>
            {/* Holiday Form */}
            <div className={styles.formPanel}>
              <h2>Schedule Clinic Holiday</h2>
              <form onSubmit={handleHolidaySubmit} className={styles.form}>
                <div className="form-group">
                  <label className="form-label" htmlFor="hDate">Holiday Date</label>
                  <input
                    id="hDate"
                    type="date"
                    className="form-input"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="hReason">Reason (Optional)</label>
                  <input
                    id="hReason"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Diwali Holiday, Personal Leave"
                    value={holidayReason}
                    onChange={(e) => setHolidayReason(e.target.value)}
                  />
                </div>

                <div className={styles.checkboxGroup}>
                  <input
                    id="hRecurring"
                    type="checkbox"
                    checked={holidayRecurring}
                    onChange={(e) => setHolidayRecurring(e.target.checked)}
                  />
                  <label htmlFor="hRecurring">Mark as Annual Recurring Holiday</label>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={createHolidayMutation.isPending}
                >
                  {createHolidayMutation.isPending ? 'Scheduling...' : 'Confirm Holiday Leave &rarr;'}
                </button>
              </form>
            </div>

            {/* Holidays List */}
            <div className={styles.listPanel}>
              <h2>Clinic Holidays List</h2>
              {isHolidaysLoading ? (
                <div className={styles.listLoading}><div className="spinner" /></div>
              ) : !holidaysData || holidaysData.length === 0 ? (
                <div className={styles.listEmpty}>
                  <p>No holiday leaves configured. Clinic is operational on all working days.</p>
                </div>
              ) : (
                <div className={styles.holidayGrid}>
                  {holidaysData.map((h) => (
                    <div key={h._id} className={styles.holidayCard}>
                      <div className={styles.holidayInfo}>
                        <div className={styles.holidayDate}>
                          📅 {new Date(h.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className={styles.holidayReason}>{h.reason || 'General Holiday'}</div>
                        {h.isRecurring && <span className={styles.recurringBadge}>Annual Recurring</span>}
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Remove this holiday date? Clinic schedule will resume.')) {
                            deleteHolidayMutation.mutate(h._id);
                          }
                        }}
                        className={styles.deleteBtnIcon}
                        title="Remove Holiday"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── GENERATE PREVIEW TAB ───────────────────────────────────────── */}
        {activeTab === 'preview' && (
          <div className={styles.previewPanel}>
            <h2>Slot Availability Preview Tool</h2>
            <p className={styles.panelSubtitle}>
              Select a date and consult type to test the availability generator.
              This checks active templates and displays the generated slots.
            </p>

            <form onSubmit={handlePreviewSubmit} className={styles.previewForm}>
              <div className="form-group">
                <label className="form-label" htmlFor="pDate">Target Date</label>
                <input
                  id="pDate"
                  type="date"
                  className="form-input"
                  value={previewDate}
                  onChange={(e) => setPreviewDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pType">Consultation Type</label>
                <select
                  id="pType"
                  className="form-input"
                  value={previewType}
                  onChange={(e) => setPreviewType(e.target.value)}
                >
                  <option value="clinic">In-Clinic Consultation</option>
                  <option value="online">Online Consultation</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPreviewLoading}
                style={{ alignSelf: 'flex-end', height: 46 }}
              >
                {isPreviewLoading ? 'Generating...' : 'Preview Slots'}
              </button>
            </form>

            <div className={styles.previewResultsWrapper}>
              {previewResults ? (
                <div>
                  <div className={styles.previewHeader}>
                    <h3>Generated Slots ({previewResults.totalSlots})</h3>
                    <span>For date: <strong>{previewResults.date}</strong> ({previewResults.type})</span>
                  </div>
                  {previewResults.slots.length === 0 ? (
                    <div className={styles.previewEmpty}>
                      No slots generated. Confirm if templates are set up for this day and if the date falls on a holiday.
                    </div>
                  ) : (
                    <div className={styles.slotsGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
                      {previewResults.slots.map((s, index) => {
                        const { isBooked, bookingDetails } = s;
                        return (
                          <div key={index} className={`${styles.slotPreviewItem} ${isBooked ? (bookingDetails?.isBlockedSlot ? styles.slotBlocked : styles.slotBooked) : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>🕒 {s.slotStart} - {s.slotEnd}</span>
                              {isBooked ? (
                                <span className={`badge ${bookingDetails?.isBlockedSlot ? 'badge-neutral' : 'badge-primary'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                                  {bookingDetails?.isBlockedSlot ? '🚫 Blocked' : '📅 Booked'}
                                </span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>✓ Free</span>
                              )}
                            </div>
                            
                            {isBooked && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '4px' }}>
                                <strong>Patient:</strong> {bookingDetails?.patientName}
                                <br />
                                <strong>Status:</strong> {bookingDetails?.status?.replace(/_/g, ' ')}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              {isBooked ? (
                                bookingDetails?.isBlockedSlot && (
                                  <button
                                    onClick={() => handleUnblockSlot(bookingDetails.appointmentId)}
                                    className="btn btn-outline btn-sm"
                                    style={{ color: 'var(--clr-danger)', borderColor: 'var(--clr-danger)', padding: '6px 8px', fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}
                                  >
                                    Unblock Slot
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={() => handleBlockSlot(s)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--clr-blue-600)', background: 'var(--clr-blue-50)', padding: '6px 8px', fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}
                                >
                                  Block Slot
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.previewPlaceholder}>
                  Select parameters above to calculate slot list.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
