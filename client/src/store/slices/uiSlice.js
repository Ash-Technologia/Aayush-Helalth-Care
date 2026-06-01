import { createSlice } from '@reduxjs/toolkit';

const SESSION_KEY = 'ahc_booking_flow';

const loadFromSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const saveToSession = (state) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      bookingStep:      state.bookingStep,
      selectedDate:     state.selectedDate,
      selectedSlot:     state.selectedSlot,
      selectedType:     state.selectedType,
    }));
  } catch { /* ignore */ }
};

const clearSession = () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};

const persisted = loadFromSession();

const initialState = {
  mobileMenuOpen:   false,
  bookingStep:      persisted?.bookingStep      || 1,
  selectedDate:     persisted?.selectedDate     || null,
  selectedSlot:     persisted?.selectedSlot     || null,
  selectedType:     persisted?.selectedType     || 'online',
  pageLoading:      false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleMobileMenu:   (s) => { s.mobileMenuOpen = !s.mobileMenuOpen; },
    closeMobileMenu:    (s) => { s.mobileMenuOpen = false; },
    setBookingStep:     (s, a) => { s.bookingStep = a.payload; saveToSession(s); },
    nextBookingStep:    (s) => { s.bookingStep = Math.min(s.bookingStep + 1, 6); saveToSession(s); },
    prevBookingStep:    (s) => { s.bookingStep = Math.max(s.bookingStep - 1, 1); saveToSession(s); },
    resetBookingFlow:   (s) => { s.bookingStep = 1; s.selectedDate = null; s.selectedSlot = null; s.selectedType = 'online'; clearSession(); },
    setSelectedDate:    (s, a) => { s.selectedDate = a.payload; s.selectedSlot = null; saveToSession(s); },
    setSelectedSlot:    (s, a) => { s.selectedSlot = a.payload; saveToSession(s); },
    setConsultationType:(s, a) => { s.selectedType = a.payload; s.selectedSlot = null; saveToSession(s); },
    setPageLoading:     (s, a) => { s.pageLoading = a.payload; },
  },
});

export const {
  toggleMobileMenu, closeMobileMenu,
  setBookingStep, nextBookingStep, prevBookingStep, resetBookingFlow,
  setSelectedDate, setSelectedSlot, setConsultationType, setPageLoading,
} = uiSlice.actions;

export const selectMobileMenuOpen  = (s) => s.ui.mobileMenuOpen;
export const selectBookingStep     = (s) => s.ui.bookingStep;
export const selectSelectedDate    = (s) => s.ui.selectedDate;
export const selectSelectedSlot    = (s) => s.ui.selectedSlot;
export const selectConsultationType= (s) => s.ui.selectedType;
export const selectPageLoading     = (s) => s.ui.pageLoading;

export default uiSlice.reducer;
