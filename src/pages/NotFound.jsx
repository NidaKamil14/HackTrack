import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="py-24 text-center max-w-md mx-auto px-4">
      <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
      <p className="text-xs text-slate-400 mb-6">The page you requested does not exist or has been relocated.</p>
      <button
        onClick={() => navigate('/')}
        className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs"
      >
        Return to HackTrack Home
      </button>
    </div>
  );
}
