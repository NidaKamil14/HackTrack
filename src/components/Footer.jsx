import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="py-8 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-300">HackTrack</span>
          <span>—</span>
          <span>Hackathon Competition Management System</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button onClick={() => navigate('/hackathons')} className="hover:text-white transition-colors">
            Browse Sprints
          </button>
          <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">
            Log In
          </button>
          <button onClick={() => navigate('/register')} className="hover:text-white transition-colors">
            Register
          </button>
        </div>
      </div>
    </footer>
  );
}
