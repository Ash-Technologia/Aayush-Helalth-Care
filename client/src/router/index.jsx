import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuth, selectIsAdmin, selectIsAdminAuth } from '@store/slices/authSlice';

// ── Layouts ───────────────────────────────────────────────────────
import RootLayout  from '@components/layout/RootLayout';
import AdminLayout from '@components/layout/AdminLayout';

// ── Page-level lazy imports ───────────────────────────────────────
const HomePage             = lazy(() => import('@pages/HomePage'));
const AuthPage             = lazy(() => import('@pages/AuthPage'));
const AuthCallbackPage     = lazy(() => import('@pages/AuthCallbackPage'));
const BookingPage          = lazy(() => import('@pages/BookingPage'));
const MyAppointmentsPage   = lazy(() => import('@pages/MyAppointmentsPage'));
const AppointmentDetailPage= lazy(() => import('@pages/AppointmentDetailPage'));
const ReviewPage           = lazy(() => import('@pages/ReviewPage'));
const NotFoundPage         = lazy(() => import('@pages/NotFoundPage'));

// Admin pages
const AdminLoginPage       = lazy(() => import('@pages/admin/AdminLoginPage'));
const AdminDashboardPage   = lazy(() => import('@pages/admin/AdminDashboardPage'));
const AdminPaymentsPage    = lazy(() => import('@pages/admin/AdminPaymentsPage'));
const AdminAppointmentsPage= lazy(() => import('@pages/admin/AdminAppointmentsPage'));
const AdminSlotsPage       = lazy(() => import('@pages/admin/AdminSlotsPage'));
const AdminProfilePage     = lazy(() => import('@pages/admin/AdminProfilePage'));
const AdminContentPage     = lazy(() => import('@pages/admin/AdminContentPage'));
const AdminUsersPage       = lazy(() => import('@pages/admin/AdminUsersPage'));

// ── Route Guards ──────────────────────────────────────────────────
const RequireAuth = () => {
  const isAuth = useSelector(selectIsAuth);
  return isAuth ? <Outlet /> : <Navigate to="/auth" replace />;
};

const RequireAdmin = () => {
  const isAdmin = useSelector(selectIsAdmin);
  const isAuth  = useSelector(selectIsAdminAuth);
  if (!isAuth)  return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
};

const RedirectIfAuth = () => {
  const isAuth = useSelector(selectIsAuth);
  return isAuth ? <Navigate to="/appointments" replace /> : <Outlet />;
};

// ── Page fallback (shared skeleton) ──────────────────────────────
const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
  </div>
);

const withSuspense = (element) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

// ── Router definition ─────────────────────────────────────────────
const router = createBrowserRouter([
  // ─── Public root (with header/footer) ─────────────────────────
  {
    element: <RootLayout />,
    children: [
      { index: true,                 element: withSuspense(<HomePage />) },
      // Auth — redirect if already logged in
      {
        element: <RedirectIfAuth />,
        children: [
          { path: 'auth',            element: withSuspense(<AuthPage />) },
          { path: 'auth/callback',   element: withSuspense(<AuthCallbackPage />) },
        ],
      },
      // Protected user routes
      {
        element: <RequireAuth />,
        children: [
          { path: 'book',            element: withSuspense(<BookingPage />) },
          { path: 'appointments',    element: withSuspense(<MyAppointmentsPage />) },
          { path: 'appointments/:id',element: withSuspense(<AppointmentDetailPage />) },
          { path: 'review/:appointmentId', element: withSuspense(<ReviewPage />) },
        ],
      },
      { path: '*',                   element: withSuspense(<NotFoundPage />) },
    ],
  },

  // ─── Admin section (separate layout) ──────────────────────────
  {
    path: 'admin',
    children: [
      { path: 'login',              element: withSuspense(<AdminLoginPage />) },
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true,         element: <Navigate to="/admin/dashboard" replace /> },
              { path: 'dashboard',   element: withSuspense(<AdminDashboardPage />) },
              { path: 'payments',    element: withSuspense(<AdminPaymentsPage />) },
              { path: 'appointments',element: withSuspense(<AdminAppointmentsPage />) },
              { path: 'slots',       element: withSuspense(<AdminSlotsPage />) },
              { path: 'profile',     element: withSuspense(<AdminProfilePage />) },
              { path: 'content',     element: withSuspense(<AdminContentPage />) },
              { path: 'users',       element: withSuspense(<AdminUsersPage />) },
            ],
          },
        ],
      },
    ],
  },
]);

const AppRouter = () => <RouterProvider router={router} />;
export default AppRouter;
