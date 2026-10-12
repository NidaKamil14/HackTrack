import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../utils/auth';

export default function Register({ navigate: propNavigate }) {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: "",
    university: "",
    email: "",
    memberId: "",
    role: "student",
    password: "",
    confirmPassword: ""
  });
  const [statusMessage, setStatusMessage] = useState(null);

  const roles = [
    {
      id: "student",
      title: "Student / Team Leader",
      desc: "Join competitions, share invite codes & build repos",
      target: "/dashboard/student"
    },
    {
      id: "screening",
      title: "Screening Committee",
      desc: "Verify repos, inspect demo URLs & enforce rules",
      target: "/dashboard/screening"
    },
    {
      id: "judge",
      title: "Judge / Evaluator",
      desc: "Evaluate shortlisted teams with weighted rubrics",
      target: "/dashboard/judge"
    },
    {
      id: "admin",
      title: "Platform Admin",
      desc: "Govern lifecycles, monitor stages & manage users",
      target: "/dashboard/admin"
    }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.university || !formData.password) {
      setStatusMessage({ type: "error", text: "Please fill out all required fields to proceed." });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setStatusMessage({ type: "error", text: "Password confirmation does not match." });
      return;
    }

    const res = await register(formData);
    if (!res.success) {
      setStatusMessage({ type: "error", text: res.error });
      return;
    }

    const destination = getRoleDashboardPath(res.user.role);
    setStatusMessage({
      type: "success",
      text: `Account created successfully for ${res.user.fullName} (${res.user.role.toUpperCase()})! Redirecting to dashboard...`
    });

    setTimeout(() => {
      navigate(destination);
    }, 800);
  };

  return (
    <div className="py-12 max-w-xl mx-auto px-4">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        
        {/* Registration Header */}
        <div className="mb-6">
          <span className="text-[11px] font-mono text-emerald-400 uppercase">ACADEMIC & EVALUATOR ENROLLMENT</span>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">Create your HackTrack ID</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sign up to build teams, submit project repos, or participate in judging and screening.
          </p>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs mb-5 leading-relaxed ${
              statusMessage.type === "error"
                ? "bg-rose-950/40 border border-rose-800/50 text-rose-300"
                : "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* 4 Dedicated System Roles */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Select User Role *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {roles.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setFormData({ ...formData, role: r.id })}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    formData.role === r.id
                      ? "bg-emerald-950/40 border-emerald-500 text-white shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-white text-xs">{r.title}</span>
                    {formData.role === r.id && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Full Name & Student ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Full Legal Name *</label>
              <input
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Maya Lin"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Student / Member ID</label>
              <input
                type="text"
                name="memberId"
                value={formData.memberId}
                onChange={handleChange}
                placeholder="e.g. STU-88219"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* University & Academic Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">University / Organization *</label>
              <input
                type="text"
                name="university"
                required
                value={formData.university}
                onChange={handleChange}
                placeholder="e.g. Stanford University"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Institutional Email *</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="maya@stanford.edu"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Password *</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
          >
            Complete Registration & Launch Dashboard
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          Already registered?{" "}
          <button
            onClick={() => navigate('/login')}
            className="text-emerald-400 hover:underline font-semibold"
          >
            Sign in to your account
          </button>
        </div>

      </div>
    </div>
  );
}
