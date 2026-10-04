import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './Icons';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../utils/auth';

export default function NavigationBar({ onOpenTeamModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const currentPath = location.pathname;

  const scrollToSection = (sectionId) => {
    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <button
          onClick={() => { navigate('/'); setMobileMenuOpen(false); }}
          className="flex items-center space-x-2.5 text-left group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center transition-colors group-hover:border-emerald-400">
            <Icons.Terminal />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-white tracking-tight leading-none">HackTrack</span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">MANAGEMENT SYSTEM</span>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6 text-sm">
          <button
            onClick={() => navigate('/hackathons')}
            className={`transition-colors ${currentPath.startsWith('/hackathons') ? 'text-emerald-400 font-semibold' : 'text-slate-300 hover:text-white'}`}
          >
            Browse Hackathons
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-slate-300 hover:text-white transition-colors"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('roles')}
            className="text-slate-300 hover:text-white transition-colors"
          >
            Roles
          </button>
        </nav>

        {/* Action CTAs */}
        <div className="hidden md:flex items-center space-x-3">
          <button
            onClick={onOpenTeamModal}
            className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white transition-colors"
          >
            <Icons.Key />
            <span>Enter Team Code</span>
          </button>

          {isAuthenticated && user ? (
            <>
              <button
                onClick={() => navigate(getRoleDashboardPath(user.role))}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5"
              >
                <span>Dashboard ({user.fullName?.split(' ')[0] || 'User'})</span>
                <Icons.ArrowRight />
              </button>
              <button
                onClick={logout}
                className="text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors"
                title="Log Out"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                  currentPath === '/login'
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'border-transparent text-slate-300 hover:text-white'
                }`}
              >
                Log In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm"
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={onOpenTeamModal}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs flex items-center gap-1"
          >
            <Icons.Key />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <Icons.Close /> : <Icons.Menu />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950 px-4 pt-3 pb-5 space-y-3">
          <button
            onClick={() => { navigate('/hackathons'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-slate-200 font-medium"
          >
            Browse Hackathons
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              scrollToSection('how-it-works');
            }}
            className="block w-full text-left py-2 text-sm text-slate-200 font-medium"
          >
            How It Works
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              scrollToSection('roles');
            }}
            className="block w-full text-left py-2 text-sm text-slate-200 font-medium"
          >
            Roles
          </button>
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            {isAuthenticated && user ? (
              <>
                <button
                  onClick={() => {
                    navigate(getRoleDashboardPath(user.role));
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold text-center"
                >
                  Go to {user.role?.toUpperCase()} Dashboard
                </button>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs text-center"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 text-center"
                >
                  Log In
                </button>
                <button
                  onClick={() => { navigate('/register'); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold text-center"
                >
                  Sign Up for HackTrack
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
