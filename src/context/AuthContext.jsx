/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
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
  const [backendOnline, setBackendOnline] = useState(false);

  // Probe backend connectivity on mount
  useEffect(() => {
    api.checkHealth().then((result) => {
      setBackendOnline(result.online);
      if (result.online) {
        console.log('🟢 Backend API connected. Using live server.');
      } else {
        console.log('🟡 Backend offline. Using localStorage fallback.');
      }
    });
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (email, password) => {
    if (backendOnline) {
      try {
        const data = await api.login({ email, password });
        // Sync to localStorage for session persistence
        const safeUser = data.user;
        localStorage.setItem('hacktrack_current_user', JSON.stringify(safeUser));
        setUser(safeUser);
        return { success: true, user: safeUser, redirectPath: data.redirectPath };
      } catch (err) {
        if (err.isNetworkError) {
          // Fall through to localStorage mode
          setBackendOnline(false);
        } else {
          return { success: false, error: err.message || 'Login failed.' };
        }
      }
    }
    // Fallback to localStorage-based auth
    const res = authenticateUser(email, password);
    if (res.success) {
      setUser(res.user);
    }
    return res;
  };

  const register = async (userData) => {
    if (backendOnline) {
      try {
        const data = await api.register(userData);
        const safeUser = data.user;
        localStorage.setItem('hacktrack_current_user', JSON.stringify(safeUser));
        setUser(safeUser);
        return { success: true, user: safeUser, redirectPath: data.redirectPath };
      } catch (err) {
        if (err.isNetworkError) {
          setBackendOnline(false);
        } else {
          return { success: false, error: err.message || 'Registration failed.' };
        }
      }
    }
    // Fallback
    const res = registerUser(userData);
    if (res.success) {
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    api.logout();
    logoutUser();
    setUser(null);
  };

  const switchDemoRole = async (roleKey) => {
    const targetDemo = DEMO_USERS.find((u) => u.role === roleKey) || DEMO_USERS[0];
    if (backendOnline) {
      try {
        const data = await api.login({ email: targetDemo.email, password: targetDemo.password });
        const safeUser = data.user;
        localStorage.setItem('hacktrack_current_user', JSON.stringify(safeUser));
        setUser(safeUser);
        return safeUser;
      } catch (err) {
        console.warn('Backend login for demo role fallback:', err.message);
      }
    }
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
        backendOnline,
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
      backendOnline: false,
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
