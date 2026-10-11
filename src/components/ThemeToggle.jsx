import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Icons } from './Icons';

export default function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={`relative inline-flex items-center justify-center p-2 rounded-lg border transition-all duration-200 focus:outline-none ${
        isDark
          ? "bg-[#0F1B2D] hover:bg-[#111E31] border-[#253247] text-[#35C8E8] focus:ring-2 focus:ring-[#35C8E8]/40"
          : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500/40"
      } ${className}`}
    >
      {isDark ? (
        <Icons.Sun className="w-4 h-4 text-[#35C8E8]" />
      ) : (
        <Icons.Moon className="w-4 h-4 text-slate-700" />
      )}
    </button>
  );
}
