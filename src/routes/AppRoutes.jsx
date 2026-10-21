import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import ProtectedRoute from './ProtectedRoute';
import RouteFallback from '../components/RouteFallback';

// The landing page loads eagerly; every other route is split into its own
// chunk so visitors don't download all six role dashboards up front.
import Home from '../pages/Home';
const BrowseHackathons = lazy(() => import('../pages/BrowseHackathons'));
const HackathonDetail = lazy(() => import('../pages/HackathonDetail'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Role Dashboards
const StudentDashboard = lazy(() => import('../pages/dashboards/StudentDashboard'));
const ScreeningDashboard = lazy(() => import('../pages/dashboards/ScreeningDashboard'));
const JudgeDashboard = lazy(() => import('../pages/dashboards/JudgeDashboard'));
const AdminDashboard = lazy(() => import('../pages/dashboards/AdminDashboard'));
const OrganizerDashboard = lazy(() => import('../pages/dashboards/OrganizerDashboard'));
const MentorDashboard = lazy(() => import('../pages/dashboards/MentorDashboard'));

// Dashboards render their own shell, so each gets its own Suspense boundary.
const dashboard = (role, element) => (
  <ProtectedRoute allowedRole={role}>
    <Suspense fallback={<RouteFallback />}>{element}</Suspense>
  </ProtectedRoute>
);

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages Layout (its <Outlet> has a Suspense boundary) */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/hackathons" element={<BrowseHackathons />} />
        <Route path="/hackathons/:id" element={<HackathonDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Role-Protected Dashboard Routes */}
      <Route path="/dashboard/student" element={dashboard("student", <StudentDashboard initialTab="workspace" />)} />
      <Route path="/dashboard/leader" element={dashboard("leader", <StudentDashboard initialTab="workspace" />)} />
      <Route path="/dashboard/screening" element={dashboard("screening", <ScreeningDashboard />)} />
      <Route path="/dashboard/judge" element={dashboard("judge", <JudgeDashboard />)} />
      <Route path="/dashboard/admin" element={dashboard("admin", <AdminDashboard />)} />
      <Route path="/dashboard/organizer" element={dashboard("organizer", <OrganizerDashboard />)} />
      <Route path="/dashboard/mentor" element={dashboard("mentor", <MentorDashboard />)} />
    </Routes>
  );
}
