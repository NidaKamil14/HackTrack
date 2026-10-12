import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { DEMO_USERS, getRoleDashboardPath } from '../utils/auth';
import { registerForHackathon } from '../utils/registrationService';

export default function Login({ navigate: propNavigate }) {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const location = useLocation();
  const { login, switchDemoRole } = useAuth();

  const [email, setEmail] = useState("alex@university.edu");
  const [password, setPassword] = useState("password123");
  const [selectedRolePreview, setSelectedRolePreview] = useState("student");
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
        text: `${res.error} (Demo accounts: alex@university.edu, screening@hacktrack.io, judge@hacktrack.io, admin@hacktrack.io / password123)`
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
    <div className="py-14 max-w-md mx-auto px-4">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        
        {/* Brand Heading */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
            <Icons.Terminal />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to HackTrack</h1>
          <p className="text-xs text-slate-400 mt-1">Access your competition portal, rosters, or review queues</p>
        </div>

        {/* Select Demo Role Dropdown */}
        <div className="mb-5 space-y-1.5">
          <label htmlFor="demo-role-select" className="text-xs font-semibold text-slate-300 block">
            Select Demo Role
          </label>
          <div className="relative">
            <select
              id="demo-role-select"
              value={selectedRolePreview}
              onChange={(e) => handlePersonaSelect(e.target.value)}
              className="w-full bg-[#080e1a] border border-[#223044] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none pr-9 font-medium"
            >
              <option value="leader">Team Leader (alex@university.edu)</option>
              <option value="student">Student / Participant (priya@university.edu)</option>
              <option value="screening">Screening Committee (screening@hacktrack.io)</option>
              <option value="judge">Judge (judge@hacktrack.io)</option>
              <option value="admin">Administrator (admin@hacktrack.io)</option>
              <option value="organizer">Organizer (organizer@hacktrack.io)</option>
              <option value="mentor">Mentor (mentor@hacktrack.io)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-mono text-[10px]">Autofills credentials</span>
            <button
              type="button"
              onClick={() => handleQuickDemoLaunch(selectedRolePreview)}
              className="text-emerald-400 hover:text-emerald-300 font-mono underline inline-flex items-center gap-1 transition-colors"
            >
              <span>⚡ Instant 1-Click Sign In as {
                selectedRolePreview === "leader" ? "TEAM LEADER" :
                selectedRolePreview === "student" ? "STUDENT" :
                selectedRolePreview === "screening" ? "SCREENING COMMITTEE" :
                selectedRolePreview === "judge" ? "JUDGE" :
                selectedRolePreview === "admin" ? "ADMINISTRATOR" :
                selectedRolePreview === "organizer" ? "ORGANIZER" : "MENTOR"
              } →</span>
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
            <label className="text-xs font-medium text-slate-300 block mb-1">Email or Student ID</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@university.edu"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
          Don't have a HackTrack account yet?{" "}
          <button
            onClick={() => navigate('/register')}
            className="text-emerald-400 hover:underline font-semibold"
          >
            Register Here
          </button>
        </div>

      </div>
    </div>
  );
}
