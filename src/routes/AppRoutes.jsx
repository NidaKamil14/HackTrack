import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Layout from './Layout';
import ProtectedRoute from './ProtectedRoute';

// Public Pages
import Home from '../pages/Home';
import BrowseHackathons from '../pages/BrowseHackathons';
import HackathonDetail from '../pages/HackathonDetail';
import Login from '../pages/Login';
import Register from '../pages/Register';
import NotFound from '../pages/NotFound';

// Role Dashboards
import StudentDashboard from '../pages/dashboards/StudentDashboard';
import ScreeningDashboard from '../pages/dashboards/ScreeningDashboard';
import JudgeDashboard from '../pages/dashboards/JudgeDashboard';
import AdminDashboard from '../pages/dashboards/AdminDashboard';

export default function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Pages Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/hackathons" element={<BrowseHackathons />} />
          <Route path="/hackathons/:id" element={<HackathonDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Role-Protected Dashboard Routes */}
        <Route
          path="/dashboard/student"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/screening"
          element={
            <ProtectedRoute allowedRole="screening">
              <ScreeningDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/judge"
          element={
            <ProtectedRoute allowedRole="judge">
              <JudgeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
