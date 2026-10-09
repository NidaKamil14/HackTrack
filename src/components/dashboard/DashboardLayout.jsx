import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icons } from '../Icons';
import ThemeToggle from '../ThemeToggle';

export default function DashboardLayout({
  portalTitle,
  roleBadgeText,
  children
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 font-sans antialiased flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Top Dashboard Navigation Bar */}
      <div>
        <header className="sticky top-0 z-40 bg-[#0c1424]/95 backdrop-blur-md border-b border-[#253247]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            
            {/* Brand + Portal Label */}
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center space-x-2.5 text-left group">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center transition-colors group-hover:border-emerald-400">
                  <Icons.Terminal />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-white tracking-tight leading-none">HackTrack</span>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider">MANAGEMENT SYSTEM</span>
                </div>
              </Link>

              <span className="hidden sm:inline-block text-slate-700">|</span>

              <div className="hidden sm:flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium">
                  {roleBadgeText || portalTitle}
                </span>
              </div>
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center gap-3">
              <ThemeToggle />

              <Link
                to="/"
                className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-800 transition-colors"
              >
                <span>Public Website</span>
                <Icons.ExternalLink />
              </Link>

              {user && (
                <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                    {user.fullName ? user.fullName.charAt(0) : "U"}
                  </div>
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-semibold text-white leading-tight">{user.fullName}</span>
                    <span className="text-[10px] text-slate-400 font-mono leading-tight truncate max-w-[140px]">
                      {user.university || user.email}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-900/60 text-slate-300 hover:text-rose-400 transition-colors"
                title="Log Out of HackTrack"
              >
                Log Out
              </button>
            </div>

          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
      </div>

      {/* Dashboard Footer */}
      <footer className="py-6 bg-[#0c1424] border-t border-[#253247] text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">HackTrack Portal</span>
            <span>—</span>
            <span className="font-mono text-[11px] text-slate-500">Authenticated Session ({user?.role?.toUpperCase() || 'GUEST'})</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link to="/hackathons" className="hover:text-white transition-colors">Browse Hackathons</Link>
            <Link to="/" className="hover:text-white transition-colors">Platform Home</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
