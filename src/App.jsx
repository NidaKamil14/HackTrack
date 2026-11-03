import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AppRoutes } from './routes';
import AnalyticsTracker from './components/analytics/AnalyticsTracker';
import AnalyticsConsent from './components/analytics/AnalyticsConsent';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AnalyticsTracker />
          <AppRoutes />
          <AnalyticsConsent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
