import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '../shared/theme/theme';
import CreateLandingPage from '../pages/create/CreateLandingPage';
import CreateDashboardPage from '../pages/create/CreateDashboardPage';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from '../shared/layout/AppLayout';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import '../shared/styles/main.css';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename="/app/create">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<CreateLandingPage />} />
          
          {/* Protected Routes (Dashboard) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <AppLayout />
                </ErrorBoundary>
              </ProtectedRoute>
            } 
          >
            <Route index element={<CreateDashboardPage />} />
            <Route path="*" element={<CreateDashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
