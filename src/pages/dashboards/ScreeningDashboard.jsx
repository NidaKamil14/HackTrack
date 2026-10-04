import React, { useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { Icons } from '../../components/Icons';
import { MOCK_SCREENING_SUBMISSIONS } from '../../data/mockDashboardData';
import { useAuth } from '../../context/AuthContext';

export default function ScreeningDashboard() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState(MOCK_SCREENING_SUBMISSIONS);
  const [filterHackathon, setFilterHackathon] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const updateStatus = (id, newStatus) => {
    setSubmissions((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, status: newStatus } : sub))
    );
  };

  const toggleCheck = (id, checkKey) => {
    setSubmissions((prev) =>
      prev.map((sub) => {
        if (sub.id === id) {
          const nextChecks = { ...sub.checks, [checkKey]: !sub.checks[checkKey] };
          return { ...sub, checks: nextChecks };
        }
        return sub;
      })
    );
  };

  // Metrics
  const total = submissions.length;
  const shortlistedCount = submissions.filter((s) => s.status === "Shortlisted").length;
  const rejectedCount = submissions.filter((s) => s.status === "Rejected").length;
  const pendingCount = submissions.filter((s) => s.status === "Pending Review" || s.status === "Under Review").length;

  const filtered = submissions.filter((sub) => {
    const matchHack = filterHackathon === "all" || sub.hackathonId === filterHackathon;
    const matchStat = filterStatus === "all" || sub.status === filterStatus;
    return matchHack && matchStat;
  });

  return (
    <DashboardLayout
      portalTitle="Screening Committee Review Portal"
      roleBadgeText="SCREENING COMMITTEE"
    >
      <div className="space-y-6">
        
        {/* 1. OVERVIEW & METRICS */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  SCREENING GATEWAY
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {user?.university || "Review Board"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Screening Review Queue
              </h1>
            </div>

            <span className="text-xs text-slate-400">
              Verify compliance rules before forwarding submissions to judges.
            </span>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">TOTAL SUBMISSIONS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{total}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-amber-400 font-mono uppercase block">PENDING REVIEW</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">{pendingCount}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-emerald-400 font-mono uppercase block">SHORTLISTED</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{shortlistedCount}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-rose-400 font-mono uppercase block">REJECTED</span>
              <span className="text-lg font-bold text-rose-400 mt-0.5 block">{rejectedCount}</span>
            </div>
          </div>
        </section>

        {/* 2. FILTER & QUEUE HEADER */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Hackathon:</span>
              <select
                value={filterHackathon}
                onChange={(e) => setFilterHackathon(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700"
              >
                <option value="all">All Hackathons</option>
                <option value="devpulse-2026">DevPulse National Sprint</option>
                <option value="ai-catalyst-2026">AI Catalyst Challenge</option>
                <option value="smart-campus-2026">Smart Campus Hack</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Under Review">Under Review</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <span className="text-slate-500 font-mono text-[11px]">
            Showing {filtered.length} of {total} submissions
          </span>
        </section>

        {/* 3. SUBMISSIONS REVIEW LIST */}
        <div className="space-y-4">
          {filtered.map((sub) => {
            const isShortlisted = sub.status === "Shortlisted";
            const isRejected = sub.status === "Rejected";

            return (
              <section
                key={sub.id}
                className={`bg-slate-900/70 border rounded-xl overflow-hidden shadow-sm transition-colors ${
                  isShortlisted
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : isRejected
                    ? "border-rose-900/40 bg-rose-950/10"
                    : "border-slate-800"
                }`}
              >
                {/* Card Header: Project Details & Current Status */}
                <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">{sub.teamName}</h2>
                      <span className="text-xs text-slate-400 font-mono">• Lead: {sub.lead}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sprint: <span className="text-slate-300 font-medium">{sub.hackathonTitle}</span> • Track: <span className="text-slate-300">{sub.track}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isShortlisted
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                        : isRejected
                        ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                        : "bg-amber-950/70 text-amber-300 border border-amber-500/40"
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                </div>

                {/* Card Body: Links & Compliance Checklist */}
                <div className="p-5 space-y-4">
                  {/* Links Row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <a
                      href={sub.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Icons.ExternalLink />
                      <span>Inspect Repository</span>
                    </a>
                    <a
                      href={sub.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-emerald-400 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Icons.ExternalLink />
                      <span>Live Deployment</span>
                    </a>
                  </div>

                  {/* 4 Compliance Gate Toggles */}
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">
                      COMPLIANCE CHECKLIST (CLICK TO TOGGLE GATE)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleCheck(sub.id, "gitFreshness")}
                        className={`p-2 rounded border text-left flex items-center justify-between transition-colors ${
                          sub.checks.gitFreshness
                            ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-950/30 border-rose-800/40 text-rose-300"
                        }`}
                      >
                        <span>Git Freshness</span>
                        <span className="font-mono text-[10px]">{sub.checks.gitFreshness ? "PASS ✓" : "FAIL ✕"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCheck(sub.id, "endpointsLive")}
                        className={`p-2 rounded border text-left flex items-center justify-between transition-colors ${
                          sub.checks.endpointsLive
                            ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-950/30 border-rose-800/40 text-rose-300"
                        }`}
                      >
                        <span>HTTPS Live</span>
                        <span className="font-mono text-[10px]">{sub.checks.endpointsLive ? "PASS ✓" : "FAIL ✕"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCheck(sub.id, "envConfigured")}
                        className={`p-2 rounded border text-left flex items-center justify-between transition-colors ${
                          sub.checks.envConfigured
                            ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-950/30 border-rose-800/40 text-rose-300"
                        }`}
                      >
                        <span>.env.example</span>
                        <span className="font-mono text-[10px]">{sub.checks.envConfigured ? "PASS ✓" : "FAIL ✕"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCheck(sub.id, "licenseMIT")}
                        className={`p-2 rounded border text-left flex items-center justify-between transition-colors ${
                          sub.checks.licenseMIT
                            ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-950/30 border-rose-800/40 text-rose-300"
                        }`}
                      >
                        <span>Open License</span>
                        <span className="font-mono text-[10px]">{sub.checks.licenseMIT ? "PASS ✓" : "FAIL ✕"}</span>
                      </button>
                    </div>

                    {sub.flags.length > 0 && (
                      <div className="pt-2 text-[11px] text-rose-300 space-y-0.5">
                        {sub.flags.map((flag, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span>⚠</span>
                            <span>{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. DECISION ACTION ROW */}
                  <div className="pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Committee Decision:
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateStatus(sub.id, "Shortlisted")}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
                      >
                        ✓ Shortlist Team
                      </button>

                      <button
                        onClick={() => updateStatus(sub.id, "Rejected")}
                        className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-semibold rounded-lg transition-colors"
                      >
                        ✕ Reject Entry
                      </button>

                      <button
                        onClick={() => updateStatus(sub.id, "Under Review")}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                      >
                        Under Review
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

      </div>
    </DashboardLayout>
  );
}
