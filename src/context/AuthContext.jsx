/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getCurrentUser,
  authenticateUser,
  registerUser,
  logoutUser,
  DEMO_USERS,
  getRoleDashboardPath
} from '../utils/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());

  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (email, password) => {
    const res = authenticateUser(email, password);
    if (res.success) {
      setUser(res.user);
    }
    return res;
  };

  const register = (userData) => {
    const res = registerUser(userData);
    if (res.success) {
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    logoutUser();
    setUser(null);
  };

  const switchDemoRole = (roleKey) => {
    const targetDemo = DEMO_USERS.find((u) => u.role === roleKey) || DEMO_USERS[0];
    const res = authenticateUser(targetDemo.email, targetDemo.password);
    if (res.success) {
      setUser(res.user);
    }
    return targetDemo;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchDemoRole,
        getRoleDashboardPath
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Graceful fallback reading directly from persistent store
    const currentUser = getCurrentUser();
    return {
      user: currentUser,
      isAuthenticated: !!currentUser,
      login: authenticateUser,
      register: registerUser,
      logout: logoutUser,
      switchDemoRole: () => null,
      getRoleDashboardPath
    };
  }
  return context;
}

export default AuthContext;
