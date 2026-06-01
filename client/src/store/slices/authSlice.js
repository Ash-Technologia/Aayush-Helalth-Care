import { createSlice } from '@reduxjs/toolkit';

// Persist tokens in localStorage — only the non-sensitive pieces
const STORAGE_KEY = 'ahc_auth';
const ADMIN_STORAGE_KEY = 'ahc_admin_auth';

const loadFromStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage full or private mode */ }
};

const clearStorage = (key) => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

const persisted = loadFromStorage(STORAGE_KEY);
const persistedAdmin = loadFromStorage(ADMIN_STORAGE_KEY);

const initialState = {
  user:              persisted?.user              || null,
  accessToken:       persisted?.accessToken       || null,
  refreshToken:      persisted?.refreshToken      || null,
  admin:             persistedAdmin?.user         || null,
  adminAccessToken:  persistedAdmin?.accessToken  || null,
  adminRefreshToken: persistedAdmin?.refreshToken || null,
  isLoading:         false,
  error:             null,
};


const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Called by login / google callback
    setCredentials: (state, action) => {
      const { user, accessToken, refreshToken } = action.payload;
      if (user?.role === 'admin') {
        state.admin             = user;
        state.adminAccessToken  = accessToken;
        state.adminRefreshToken = refreshToken;
        state.error             = null;
        saveToStorage(ADMIN_STORAGE_KEY, { user, accessToken, refreshToken });
      } else {
        state.user              = user;
        state.accessToken       = accessToken;
        state.refreshToken      = refreshToken;
        state.error             = null;
        saveToStorage(STORAGE_KEY, { user, accessToken, refreshToken });
      }
    },

    // Called by the Axios interceptor on token refresh
    setTokens: (state, action) => {
      const { accessToken, refreshToken, role } = action.payload;
      if (role === 'admin') {
        state.adminAccessToken  = accessToken;
        state.adminRefreshToken = refreshToken;
        saveToStorage(ADMIN_STORAGE_KEY, { user: state.admin, accessToken, refreshToken });
      } else {
        state.accessToken  = accessToken;
        state.refreshToken = refreshToken;
        saveToStorage(STORAGE_KEY, { user: state.user, accessToken, refreshToken });
      }
    },

    // Update user profile without touching tokens
    updateUser: (state, action) => {
      if (state.admin) {
        state.admin = { ...state.admin, ...action.payload };
        saveToStorage(ADMIN_STORAGE_KEY, { user: state.admin, accessToken: state.adminAccessToken, refreshToken: state.adminRefreshToken });
      }
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        saveToStorage(STORAGE_KEY, { user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken });
      }
    },

    // Logout: wipe standard user session
    logout: (state) => {
      state.user         = null;
      state.accessToken  = null;
      state.refreshToken = null;
      state.error        = null;
      clearStorage(STORAGE_KEY);
    },

    // Logout: wipe admin session
    adminLogout: (state) => {
      state.admin             = null;
      state.adminAccessToken  = null;
      state.adminRefreshToken = null;
      state.error             = null;
      clearStorage(ADMIN_STORAGE_KEY);
    },

    setLoading: (state, action) => { state.isLoading = action.payload; },
    setError:   (state, action) => { state.error     = action.payload; },
    clearError: (state)         => { state.error     = null; },
  },
});

export const {
  setCredentials, setTokens, updateUser,
  logout, adminLogout, setLoading, setError, clearError,
} = authSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────
export const selectUser         = (s) => s.auth.user;
export const selectAdmin        = (s) => s.auth.admin;
export const selectIsAuth       = (s) => Boolean(s.auth.accessToken);
export const selectIsAdminAuth  = (s) => Boolean(s.auth.adminAccessToken);
export const selectIsAdmin      = (s) => Boolean(s.auth.admin);
export const selectAccessToken  = (s) => s.auth.accessToken;
export const selectAuthLoading  = (s) => s.auth.isLoading;
export const selectAuthError    = (s) => s.auth.error;

export default authSlice.reducer;
