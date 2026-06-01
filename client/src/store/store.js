import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer   from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui:   uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable Date objects in booking state
        ignoredActionPaths: ['payload.appointmentDate'],
        ignoredPaths:       ['ui.selectedDate'],
      },
    }),
  devTools: import.meta.env.DEV,
});

export default store;
