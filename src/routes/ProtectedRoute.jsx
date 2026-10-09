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

  const allowed = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
  const userRole = user.role || 'student';

  // Leaders can view student dashboard and vice versa
  const isStudentOrLeader = (userRole === 'student' || userRole === 'leader') && (allowed.includes('student') || allowed.includes('leader'));
  const isMatch = allowed.includes(userRole) || isStudentOrLeader;

  if (!isMatch) {
    // Redirect to the user's authorized role dashboard
    const authorizedPath = getRoleDashboardPath(user.role);
    return <Navigate to={authorizedPath} replace />;
  }

  return children;
}
