import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { DEMO_USERS, getRoleDashboardPath } from '../utils/auth';
import { registerForHackathon } from '../utils/registrationService';

const ROLE_PREVIEWS = [
  {
    role: "organizer",
    title: "Organizer",
    tagline: "Create & Run Hackathons",
    email: "organizer@hacktrack.io",
    highlight: true,
  },
  {
    role: "leader",
    title: "Team Leader",
    tagline: "Form Squad & Submit",
    email: "alex@university.edu",
  },
  {
    role: "student",
    title: "Participant",
    tagline: "Join Squad & Compete",
    email: "priya@university.edu",
  },
  {
    role: "judge",
    title: "Judge",
    tagline: "Score Rubrics",
    email: "judge@hacktrack.io",
  },
  {
    role: "admin",
    title: "Administrator",
    tagline: "Platform HQ",
    email: "admin@hacktrack.io",
  },
  {
    role: "screening",
    title: "Screening",
    tagline: "Verify Repos",
    email: "screening@hacktrack.io",
  },
];

export default function Login({ navigate: propNavigate }) {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const location = useLocation();
  const { login, switchDemoRole } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const initialRole = searchParams.get('role') || "organizer";
  const initialDemo = DEMO_USERS.find((u) => u.role === initialRole) || DEMO_USERS.find((u) => u.role === "organizer");

  const [selectedRolePreview, setSelectedRolePreview] = useState(initialRole);
  const [email, setEmail] = useState(initialDemo ? initialDemo.email : "organizer@hacktrack.io");
  const [password, setPassword] = useState(initialDemo ? initialDemo.password : "password123");
  const [statusMessage, setStatusMessage] = useState(null);

  const handlePersonaSelect = (roleKey) => {
    setSelectedRolePreview(roleKey);
    const demo = DEMO_USERS.find((u) => u.role === roleKey);
    if (demo) {
      setEmail(demo.email);
      setPassword(demo.password);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setStatusMessage({ type: "error", text: "Please enter both your email and password." });
      return;
    }

    const res = await login(email, password);
    if (!res.success) {
      setStatusMessage({
        type: "error",
        text: `${res.error} (Demo accounts: organizer@hacktrack.io, alex@university.edu, admin@hacktrack.io / password123)`
      });
      return;
    }

    // Check if user came from a hackathon registration attempt
    if (location.state?.registerHackathonId) {
      registerForHackathon(res.user.email, location.state.registerHackathonId);
      const targetHackathonId = location.state.registerHackathonId;
      setStatusMessage({
        type: "success",
        text: `✓ Authenticated as ${res.user.fullName}! Registering for sprint and returning to specifications...`
      });
      setTimeout(() => {
        navigate(`/hackathons/${targetHackathonId}`, { replace: true });
      }, 400);
      return;
    }

    // Role-based destination
    const destination = location.state?.from?.pathname || getRoleDashboardPath(res.user.role);
    setStatusMessage({
      type: "success",
      text: `✓ Authenticated as ${res.user.fullName} (${res.user.roleCategory || res.user.role}). Redirecting to ${destination}...`
    });

    setTimeout(() => {
      navigate(destination, { replace: true });
    }, 400);
  };

  const handleQuickDemoLaunch = (roleKey) => {
    const user = switchDemoRole(roleKey);
    const destination = getRoleDashboardPath(user.role);
    navigate(destination, { replace: true });
  };

  return (
    <div className="py-14 max-w-xl mx-auto px-4">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        
        {/* Brand Heading */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
            <Icons.Terminal />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to HackTrack</h1>
          <p className="text-xs text-slate-400 mt-1">Select your role or enter credentials to launch your competition console</p>
        </div>

        {/* Quick Role Selection Grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300">
              Select Role / Account
            </label>
            <span className="text-[10px] font-mono text-emerald-400">Click to switch instantly</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ROLE_PREVIEWS.map((r) => {
              const isSelected = selectedRolePreview === r.role;
              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => handlePersonaSelect(r.role)}
                  className={`p-2.5 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? "bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500/50 shadow-sm"
                      : "bg-[#080e1a] border-[#202b3c] hover:border-slate-600 hover:bg-[#0c1424]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold block ${isSelected ? "text-emerald-300" : "text-white"}`}>
                      {r.title}
                    </span>
                    {r.highlight && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40">
                        HOST
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                    {r.tagline}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick 1-Click Action */}
          <div className="mt-3 p-2.5 rounded-lg bg-[#080e1a] border border-[#1a2536] flex items-center justify-between text-xs">
            <div className="truncate pr-2">
              <span className="text-[11px] text-slate-400 font-mono block">Selected account:</span>
              <span className="text-xs text-white font-mono font-medium truncate block">{email}</span>
            </div>
            <button
              type="button"
              onClick={() => handleQuickDemoLaunch(selectedRolePreview)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 text-xs font-semibold font-mono transition-all shrink-0 flex items-center gap-1"
            >
              <span>1-Click Launch →</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs mb-4 leading-relaxed ${
              statusMessage.type === "error"
                ? "bg-rose-950/40 border border-rose-800/50 text-rose-300"
                : "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Email Address</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="organizer@hacktrack.io"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => setStatusMessage({ type: "info", text: "Demo passwords for all accounts are: password123" })}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Forgot?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
          >
            Sign In & Launch Dashboard
          </button>
        </form>

        {/* Switch to Register */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          Want to organize a new competition?{" "}
          <button
            onClick={() => navigate('/register')}
            className="text-emerald-400 hover:underline font-semibold"
          >
            Register as an Organizer
          </button>
        </div>

      </div>
    </div>
  );
}
