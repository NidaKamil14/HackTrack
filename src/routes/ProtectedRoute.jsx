import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../utils/auth';

export default function ProtectedRoute({ allowedRole, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // If not authenticated, redirect to login while saving requested path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Normalize role matching (student / leader map to student dashboard)
  const userRole = user.role === 'leader' ? 'student' : user.role;
  const targetRole = allowedRole === 'leader' ? 'student' : allowedRole;

  if (targetRole && userRole !== targetRole) {
    // Redirect to the user's authorized role dashboard
    const authorizedPath = getRoleDashboardPath(user.role);
    return <Navigate to={authorizedPath} replace />;
  }

  return children;
}
