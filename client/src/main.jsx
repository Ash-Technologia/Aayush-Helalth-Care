import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { store } from '@store/store';
import AppRouter from '@/router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          60_000,    // 1 min before refetch
      retry:              1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <AppRouter />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '0.9rem',
                boxShadow: '0 8px 24px rgba(15,23,42,0.1)',
              },
              success: { iconTheme: { primary: '#2563eb', secondary: '#eff6ff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fef2f2' } },
            }}
          />
        </Provider>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
