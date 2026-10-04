import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { Icons } from '../../components/Icons';
import { HACKATHONS } from '../../data/hackathons';
import { useAuth } from '../../context/AuthContext';
import { getUserRegistrations } from '../../utils/registrationService';
import {
  getUserTeamForHackathon,
  createTeam,
  joinTeamWithCode
} from '../../utils/teamService';

export default function StudentDashboard() {
  const { user } = useAuth();
  const userEmail = user?.email || "";

  // Team invite code copy feedback
  const [copied, setCopied] = useState(false);

  // Registrations & state refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);
  const registrations = useMemo(() => {
    if (refreshKey) {
      /* force re-eval on update */
    }
    return getUserRegistrations(userEmail);
  }, [userEmail, refreshKey]);
  const [selectedHackathonId, setSelectedHackathonId] = useState(null);

  // New team formation state
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamActionFeedback, setTeamActionFeedback] = useState(null);

  // Join team state
  const [joinCode, setJoinCode] = useState("");

  // Submission state
  const [submission, setSubmission] = useState({
    repoUrl: "https://github.com/alexchen/devpulse-resilient-queue",
    demoUrl: "https://devpulse-queue.vercel.app",
    pitch: "Distributed event-driven queue with automated circuit breakers and real-time telemetry dashboard.",
    status: "Draft (Unlocked)",
    isLocked: false
  });
  const [submissionNotice, setSubmissionNotice] = useState(null);

  // Combine user registration records with HACKATHONS static meta
  const registeredHackathons = registrations.map((reg) => {
    const meta = HACKATHONS.find((h) => h.id === reg.hackathonId) || {
      id: reg.hackathonId,
      title: reg.hackathonId,
      track: "General Track",
      dates: "Dates Announced Soon",
      deadline: "TBD"
    };
    const team = getUserTeamForHackathon(userEmail, reg.hackathonId);
    return {
      ...meta,
      registrationStatus: reg.status,
      registrationDate: reg.registrationDate,
      team
    };
  });

  const activeSprint =
    registeredHackathons.find((h) => h.id === selectedHackathonId) ||
    registeredHackathons[0] ||
    null;

  const currentTeam = activeSprint
    ? getUserTeamForHackathon(userEmail, activeSprint.id)
    : null;

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateTeamSubmit = (e) => {
    e.preventDefault();
    if (!newTeamName.trim() || !activeSprint) return;

    const res = createTeam({
      name: newTeamName.trim(),
      hackathonId: activeSprint.id,
      hackathonTitle: activeSprint.title,
      track: activeSprint.track,
      leadName: user?.fullName || "Team Lead",
      leadEmail: userEmail
    });

    if (res.success) {
      setTeamActionFeedback({
        type: "success",
        text: `✓ Created team "${res.team.name}"! Invite code: ${res.team.code}`
      });
      setIsCreatingTeam(false);
      setNewTeamName("");
      setRefreshKey(k => k + 1);
    } else {
      setTeamActionFeedback({
        type: "error",
        text: res.error
      });
    }
    setTimeout(() => setTeamActionFeedback(null), 5000);
  };

  const handleJoinTeam = (e) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (!clean || !user) return;

    const res = joinTeamWithCode(clean, user);
    if (res.success) {
      setTeamActionFeedback({
        type: "success",
        text: `✓ Joined team "${res.team.name}" (${res.team.hackathon})!`
      });
      setJoinCode("");
      setSelectedHackathonId(res.team.hackathonId);
      setRefreshKey(k => k + 1);
    } else {
      setTeamActionFeedback({
        type: "error",
        text: res.error
      });
    }
    setTimeout(() => setTeamActionFeedback(null), 5000);
  };

  const handleSaveSubmission = (e) => {
    e.preventDefault();
    setSubmissionNotice({
      type: "success",
      text: "Submission draft saved. You can continue editing before final freeze."
    });
    setTimeout(() => setSubmissionNotice(null), 3500);
  };

  const handleToggleLock = () => {
    const nextLocked = !submission.isLocked;
    setSubmission({
      ...submission,
      isLocked: nextLocked,
      status: nextLocked ? "Submitted (Locked)" : "Draft (Unlocked)"
    });
    setSubmissionNotice({
      type: "info",
      text: nextLocked
        ? "Submission locked for screening review."
        : "Submission unlocked for editing."
    });
    setTimeout(() => setSubmissionNotice(null), 3500);
  };

  return (
    <DashboardLayout
      portalTitle="Student / Team Leader Portal"
      roleBadgeText="STUDENT / TEAM LEADER"
    >
      <div className="space-y-6">
        
        {/* 1. OVERVIEW (Compact Header) */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  STUDENT PORTAL
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {user?.university || userEmail || "Active Participant"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Welcome back, {user?.fullName || "Developer"}
              </h1>
            </div>

            {/* Quick Status Bar */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-slate-500 mr-1.5">Registered Sprints:</span>
                <span className="text-white font-medium">{registeredHackathons.length}</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-slate-500 mr-1.5">Current Team:</span>
                <span className="text-emerald-400 font-medium">
                  {currentTeam ? currentTeam.name : "No Team Yet"}
                </span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-slate-500 mr-1.5">Submission:</span>
                <span className={`font-mono font-semibold ${submission.isLocked ? "text-rose-400" : "text-amber-400"}`}>
                  {submission.status}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-Hackathon View Switcher (if registered for > 1 competition) */}
        {registeredHackathons.length > 1 && (
          <div className="flex items-center gap-2 p-2 bg-slate-900/60 border border-slate-800 rounded-xl overflow-x-auto text-xs">
            <span className="text-slate-400 font-mono text-[11px] px-2 shrink-0">Active Sprint View:</span>
            {registeredHackathons.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHackathonId(h.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                  activeSprint?.id === h.id
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800"
                }`}
              >
                {h.title}
              </button>
            ))}
          </div>
        )}

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (7 cols): My Hackathons & Project Submission */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 2. MY HACKATHONS CARD */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    MY HACKATHONS
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Your authenticated competition enrollments ({registeredHackathons.length})
                  </p>
                </div>
                <Link
                  to="/hackathons"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300"
                >
                  <span>+ Browse More</span>
                  <Icons.ArrowRight />
                </Link>
              </div>

              <div className="p-5 space-y-3">
                {registeredHackathons.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl space-y-2.5">
                    <p className="text-xs text-slate-400">
                      You are not currently registered for any hackathons.
                    </p>
                    <Link
                      to="/hackathons"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
                    >
                      <span>Browse Hackathons</span>
                      <Icons.ArrowRight />
                    </Link>
                  </div>
                ) : (
                  registeredHackathons.map((h) => {
                    const isSelected = activeSprint?.id === h.id;
                    const teamForH = getUserTeamForHackathon(userEmail, h.id);

                    return (
                      <div
                        key={h.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-slate-950 border-emerald-500/50 shadow-sm"
                            : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-semibold">
                                {h.registrationStatus || "Registration Verified"}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">{h.dates}</span>
                            </div>
                            <h3 className="text-base font-bold text-white">{h.title}</h3>
                            <div className="text-xs text-slate-400">
                              Track: <span className="text-slate-200">{h.track}</span>
                              <span className="text-slate-600 mx-1.5">•</span>
                              Team:{" "}
                              <span className={teamForH ? "text-emerald-400 font-medium" : "text-amber-400"}>
                                {teamForH ? teamForH.name : "No team formed yet"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {registeredHackathons.length > 1 && !isSelected && (
                              <button
                                onClick={() => setSelectedHackathonId(h.id)}
                                className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-white rounded"
                              >
                                View Squad
                              </button>
                            )}
                            <Link
                              to={`/hackathons/${h.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
                            >
                              <span>Specifications</span>
                              <Icons.ArrowRight />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* 4. PROJECT SUBMISSION CARD */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    PROJECT SUBMISSION
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeSprint ? `Deliverables for ${activeSprint.title}` : "Select a sprint above to submit"}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                  submission.isLocked
                    ? "bg-rose-950 border border-rose-500/40 text-rose-300"
                    : "bg-amber-950/70 border border-amber-500/40 text-amber-300"
                }`}>
                  {submission.status}
                </span>
              </div>

              <div className="p-5 space-y-4">
                {submissionNotice && (
                  <div className={`p-2.5 rounded-lg text-xs ${
                    submissionNotice.type === "success"
                      ? "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
                      : "bg-amber-950/40 border border-amber-800/50 text-amber-300"
                  }`}>
                    {submissionNotice.text}
                  </div>
                )}

                <form onSubmit={handleSaveSubmission} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      Repository URL (GitHub / GitLab) *
                    </label>
                    <input
                      type="url"
                      disabled={submission.isLocked}
                      value={submission.repoUrl}
                      onChange={(e) => setSubmission({ ...submission, repoUrl: e.target.value })}
                      placeholder="https://github.com/team/project"
                      className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-lg px-3 py-2 font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      Live Deployment Demo URL *
                    </label>
                    <input
                      type="url"
                      disabled={submission.isLocked}
                      value={submission.demoUrl}
                      onChange={(e) => setSubmission({ ...submission, demoUrl: e.target.value })}
                      placeholder="https://project.vercel.app"
                      className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-lg px-3 py-2 font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      Architecture & System Overview
                    </label>
                    <textarea
                      rows={3}
                      disabled={submission.isLocked}
                      value={submission.pitch}
                      onChange={(e) => setSubmission({ ...submission, pitch: e.target.value })}
                      placeholder="Brief summary of architecture, APIs, and key features..."
                      className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/70">
                    <button
                      type="submit"
                      disabled={submission.isLocked}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg transition-colors text-xs shadow-sm"
                    >
                      Save Draft
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleLock}
                      className={`w-full sm:w-auto px-4 py-2 rounded-lg font-semibold border transition-colors text-xs ${
                        submission.isLocked
                          ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                          : "bg-rose-950/60 hover:bg-rose-900/60 border-rose-800/60 text-rose-300"
                      }`}
                    >
                      {submission.isLocked ? "Unlock for Editing" : "Freeze & Finalize for Screening"}
                    </button>
                  </div>
                </form>
              </div>
            </section>

          </div>

          {/* Right Column (5 cols): My Team & Milestones */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 3. MY TEAM CARD */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    MY TEAM
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeSprint ? `Roster for ${activeSprint.title}` : "Team management"}
                  </p>
                </div>
                {currentTeam && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                    {currentTeam.capacity}
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4 text-xs">
                {teamActionFeedback && (
                  <div className={`p-2.5 rounded text-xs ${
                    teamActionFeedback.type === "success"
                      ? "bg-emerald-950/50 border border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/50 border border-rose-800/50 text-rose-300"
                  }`}>
                    {teamActionFeedback.text}
                  </div>
                )}

                {currentTeam ? (
                  <>
                    {/* Team Info & Invite Code */}
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-sm font-bold text-white">{currentTeam.name}</span>
                        <span className="text-[11px] text-slate-400">Leader: {currentTeam.lead}</span>
                      </div>

                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono block">INVITE CODE</span>
                          <span className="text-sm font-mono font-bold text-emerald-400 tracking-wider">
                            {currentTeam.code}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyCode(currentTeam.code)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200 transition-colors"
                        >
                          {copied ? "✓ Copied" : "Copy Code"}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Share this code to invite teammates.
                      </span>
                    </div>

                    {/* Roster List */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/70">
                      <span className="text-[11px] font-mono text-slate-400 block font-semibold">ROSTER</span>
                      <div className="space-y-1.5">
                        {currentTeam.members?.map((m, idx) => {
                          const mName = typeof m === 'string' ? m : m.name;
                          const mRole = typeof m === 'object' && m.role ? m.role : "Member";
                          const mStatus = typeof m === 'object' && m.status ? m.status : "Active";

                          return (
                            <div
                              key={idx}
                              className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="text-slate-200 font-medium block">{mName}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{mRole}</span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/20 text-emerald-400">
                                {mStatus}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  /* User is registered for this hackathon but hasn't formed/joined a team yet */
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <span className="text-xs font-semibold text-white block">
                      No Team Formed Yet for {activeSprint?.title}
                    </span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      You are registered for this hackathon! Create a squad to become team leader, or enter a teammate's invite code.
                    </p>

                    {isCreatingTeam ? (
                      <form onSubmit={handleCreateTeamSubmit} className="space-y-2 pt-2 border-t border-slate-800">
                        <input
                          type="text"
                          required
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="e.g. ApexInnovators"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs"
                          >
                            Create Squad
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCreatingTeam(false)}
                            className="px-2.5 py-1.5 bg-slate-800 text-slate-400 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setIsCreatingTeam(true)}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                      >
                        + Create a New Squad
                      </button>
                    )}
                  </div>
                )}

                {/* Join via Invite Code */}
                <div className="pt-3 border-t border-slate-800/70 space-y-2">
                  <span className="text-[11px] font-mono text-slate-400 block font-semibold">
                    JOIN VIA INVITE CODE
                  </span>
                  <form onSubmit={handleJoinTeam} className="flex gap-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HT-DEV-42"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 text-xs transition-colors"
                    >
                      Join
                    </button>
                  </form>
                  <span className="text-[10px] text-slate-500 block">
                    You can only join teams for hackathons you have registered for.
                  </span>
                </div>
              </div>
            </section>

            {/* 5. MILESTONES CARD */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90">
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  UPCOMING MILESTONES
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Important competition deadlines
                </p>
              </div>

              <div className="p-5 space-y-3">
                {[
                  { label: "Team Roster Lock Window", time: "Oct 18, 2026 • 18:00 UTC", urgency: "high" },
                  { label: "Sprint Kickoff & Repo Push", time: "Oct 18, 2026 • 20:00 UTC", urgency: "normal" },
                  { label: "Final Code Freeze & Demo Link", time: "Oct 20, 2026 • 20:00 UTC", urgency: "critical" },
                  { label: "Screening Gate Clearance", time: "Oct 21, 2026 • 12:00 UTC", urgency: "normal" }
                ].map((dl, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      dl.urgency === "critical"
                        ? "bg-rose-400 animate-pulse"
                        : dl.urgency === "high"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`} />
                    <div className="flex-1">
                      <span className="text-slate-200 font-medium block leading-tight">{dl.label}</span>
                      <span className="text-[11px] font-mono text-slate-500">{dl.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
