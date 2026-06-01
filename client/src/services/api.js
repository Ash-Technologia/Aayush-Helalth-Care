import axios from 'axios';
import { store } from '@store/store';
import { logout, adminLogout, setTokens } from '@store/slices/authSlice';

const DEFAULT_API_URL = import.meta.env.DEV ? 'http://localhost:5000/api/v1' : '';

const normalizeApiBaseUrl = (value) => {
  if (!value || value.startsWith('/')) {
    return DEFAULT_API_URL;
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname === '/' || parsed.pathname === '') {
      parsed.pathname = '/api/v1';
    } else if (!parsed.pathname.endsWith('/api/v1')) {
      parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/api/v1`;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return DEFAULT_API_URL;
  }
};

export const getApiBaseUrl = () => normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

export const getBackendOrigin = () => {
  try {
    return new URL(getApiBaseUrl()).origin;
  } catch {
    return 'http://localhost:5000';
  }
};

export const resolveBackendAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;

  const origin = getBackendOrigin();
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
};

// ── Base instance ─────────────────────────────────────────────────
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────────────
api.interceptors.request.use(
  (config) => {
    const isAdminRequest = config.url?.includes('/admin/');
    const token = isAdminRequest
      ? store.getState().auth.adminAccessToken
      : store.getState().auth.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor: auto-refresh on 401 ────────────────────
let _refreshing = false;
let _queue = [];

const processQueue = (err, token = null) => {
  _queue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token)
  );
  _queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only attempt refresh once per request
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    // Skip refresh for auth endpoints (login, register, refresh itself)
    const skipPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/admin/login'];
    if (skipPaths.some((p) => original.url?.includes(p))) {
      return Promise.reject(err);
    }

    if (_refreshing) {
      // Queue subsequent 401s while refresh is in-flight
      return new Promise((resolve, reject) => {
        _queue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    _refreshing = true;

    const isAdminRequest = original.url?.includes('/admin/');
    try {
      const refreshToken = isAdminRequest
        ? store.getState().auth.adminRefreshToken
        : store.getState().auth.refreshToken;
      if (!refreshToken) throw new Error('No refresh token');

      const refreshURL = `${getApiBaseUrl()}/auth/refresh`;
      const { data } = await axios.post(refreshURL, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = data.data;

      store.dispatch(setTokens({
        accessToken,
        refreshToken: newRefresh,
        role: isAdminRequest ? 'admin' : 'user'
      }));
      processQueue(null, accessToken);

      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshErr) {
      processQueue(refreshErr);
      if (isAdminRequest) {
        store.dispatch(adminLogout());
      } else {
        store.dispatch(logout());
      }
      return Promise.reject(refreshErr);
    } finally {
      _refreshing = false;
    }
  }
);

export default api;
