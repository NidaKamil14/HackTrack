import React, { useState, useMemo } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getStoredHackathons,
  createNewHackathon,
  advanceHackathonStage,
  updateHackathon
} from '../../utils/hackathonService';
import { getAllTeams } from '../../utils/teamService';
import { getSubmissions } from '../../utils/submissionService';
import { addNotification } from '../../utils/notificationService';
import api from '../../utils/api';

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter view: "my" (only hackathons organized by current user) or "all"
  const [scopeFilter, setScopeFilter] = useState("my");

  // Fetch hackathons
  const allHackathons = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getStoredHackathons();
  }, [refreshKey]);

  // Filter based on organizer email / organization
  const displayedHackathons = useMemo(() => {
    if (scopeFilter === "all") return allHackathons;
    const userEmail = user?.email?.toLowerCase() || "organizer@hacktrack.io";
    return allHackathons.filter((h) => {
      if (h.organizerEmail && h.organizerEmail.toLowerCase() === userEmail) return true;
      if (h.organizers && h.organizers.some((o) => typeof o === 'string' && o.toLowerCase().includes(userEmail))) return true;
      // Default sample hackathon for demo organizer
      if (userEmail === "organizer@hacktrack.io" && h.id === "devpulse-2026") return true;
      return false;
    });
  }, [allHackathons, scopeFilter, user]);

  const teams = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getAllTeams();
  }, [refreshKey]);

  const submissions = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getSubmissions();
  }, [refreshKey]);

  const teamsList = Object.entries(teams).map(([code, t]) => ({ ...t, code }));

  // Modal State: Create New Hackathon
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newHackathon, setNewHackathon] = useState({
    title: "",
    headline: "",
    track: "Full-Stack & Cloud Systems",
    category: "Full-Stack",
    deadline: "Nov 30, 2026",
    registrationDeadline: "Nov 25, 2026",
    submissionDeadline: "Nov 30, 2026",
    prize: "$10,000 USD",
    minTeamSize: 1,
    maxTeamSize: 4,
    summary: "",
    overview: "",
    enabledModules: {
      screeningGate: true,
      rubricJudging: true,
      mentorship: true,
      certificates: true
    }
  });

  // Modal State: Configure Rubric / Settings
  const [configTarget, setConfigTarget] = useState(null);

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("all");
  const [notice, setNotice] = useState(null);

  const handleCreateHackathon = async (e) => {
    e.preventDefault();
    if (!newHackathon.title.trim()) return;

    const organizerEmail = user?.email || "organizer@hacktrack.io";
    const organizerName = user?.fullName || "Hackathon Organizer";
    const organizerUniversity = user?.university || "Host Institution";

    // 1. Create in local persistent store
    const res = createNewHackathon({
      title: newHackathon.title.trim(),
      headline: newHackathon.headline.trim() || `${newHackathon.track} Innovation Sprint`,
      track: newHackathon.track,
      category: newHackathon.category,
      stage: "Registration Open",
      prizePool: newHackathon.prize,
      deadline: newHackathon.submissionDeadline || newHackathon.deadline,
      dates: `${newHackathon.registrationDeadline} - ${newHackathon.submissionDeadline}`,
      teamSize: `${newHackathon.minTeamSize} - ${newHackathon.maxTeamSize} Members`,
      summary: newHackathon.summary.trim() || `Official ${newHackathon.title} hosted by ${organizerName}.`,
      overview: newHackathon.overview.trim() || `Join the ${newHackathon.title} to develop novel solutions in ${newHackathon.track}.`,
      enabledModules: newHackathon.enabledModules,
      organizerEmail,
      organizerName,
      organizerUniversity,
      organizers: [organizerName, organizerUniversity]
    });

    // 2. Also try creating on backend API if available
    try {
      await api.createHackathon({
        title: newHackathon.title.trim(),
        tagLine: newHackathon.headline.trim() || `${newHackathon.track} Innovation Sprint`,
        description: newHackathon.summary.trim(),
        registrationDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        submissionDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        minTeamSize: newHackathon.minTeamSize,
        maxTeamSize: newHackathon.maxTeamSize,
        hasScreeningRound: newHackathon.enabledModules.screeningGate,
        hasMentorship: newHackathon.enabledModules.mentorship,
      });
    } catch {
      // Local store handles fallback seamlessly
    }

    if (res.success) {
      setShowCreateModal(false);
      setNewHackathon({
        title: "",
        headline: "",
        track: "Full-Stack & Cloud Systems",
        category: "Full-Stack",
        deadline: "Nov 30, 2026",
        registrationDeadline: "Nov 25, 2026",
        submissionDeadline: "Nov 30, 2026",
        prize: "$10,000 USD",
        minTeamSize: 1,
        maxTeamSize: 4,
        summary: "",
        overview: "",
        enabledModules: {
          screeningGate: true,
          rubricJudging: true,
          mentorship: true,
          certificates: true
        }
      });
      setNotice(`✓ Successfully published new hackathon: "${res.hackathon.title}"!`);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleAdvance = (id) => {
    const res = advanceHackathonStage(id);
    if (res.success) {
      setRefreshKey((k) => k + 1);
      setNotice(`Stage updated to "${res.hackathon.stage}" for ${res.hackathon.title}`);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    if (!configTarget) return;

    updateHackathon(configTarget.id, {
      enabledModules: configTarget.enabledModules,
      prizePool: configTarget.prizePool,
      teamSize: configTarget.teamSize,
    });

    setConfigTarget(null);
    setRefreshKey((k) => k + 1);
    setNotice(`✓ Settings updated for "${configTarget.title}".`);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleBroadcastAnnouncement = (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    addNotification({
      userEmail: "all",
      title: `Announcement: ${user?.fullName || "Organizer"}`,
      message: announcementText.trim(),
      type: "info",
      link: "/dashboard/student"
    });

    setNotice(`✓ Announcement broadcast to participants.`);
    setAnnouncementText("");
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <DashboardLayout
      portalTitle="Organizer Operations Console"
      roleBadgeText="HACKATHON ORGANIZER"
    >
      <div className="space-y-6">

        {/* Header Banner */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  EVENT OPERATIONS & GOVERNANCE
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {user?.university || "DevPulse Operations Committee"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Welcome, {user?.fullName || "Organizer"}
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Create new hackathons, manage track configurations, monitor participant squad formation, and broadcast real-time updates.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/20 shrink-0"
              >
                <span className="text-sm">+</span>
                <span>Create New Hackathon</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-4 border-t border-[#253247]">
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">MY HACKATHONS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{displayedHackathons.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">ALL PLATFORM SPRINTS</span>
              <span className="text-lg font-bold text-slate-300 mt-0.5 block">{allHackathons.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">REGISTERED SQUADS</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{teamsList.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">SUBMISSIONS LOGGED</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">
                {submissions.length}
              </span>
            </div>
          </div>
        </section>

        {notice && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* 2-Column: Hackathons Management & Announcements */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Hackathons Management (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-[#253247] bg-[#121c32] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    COMPETITIONS DIRECTORY
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Manage lifecycle stages & team allowances</p>
                </div>

                {/* Filter toggle: My Hackathons vs All */}
                <div className="flex items-center gap-1 bg-[#080e1a] border border-[#202b3c] p-0.5 rounded-lg text-[11px] font-mono">
                  <button
                    onClick={() => setScopeFilter("my")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      scopeFilter === "my"
                        ? "bg-emerald-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    My Events ({displayedHackathons.length})
                  </button>
                  <button
                    onClick={() => setScopeFilter("all")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      scopeFilter === "all"
                        ? "bg-emerald-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All ({allHackathons.length})
                  </button>
                </div>
              </div>

              {displayedHackathons.length === 0 ? (
                <div className="p-8 text-center bg-[#080e1a]/60">
                  <p className="text-xs text-slate-400 mb-3">You haven't created any hackathons yet.</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg"
                  >
                    + Create Your First Hackathon
                  </button>
                </div>
              ) : (
                <div className="p-5 divide-y divide-[#1c283c]">
                  {displayedHackathons.map((h) => {
                    const sprintTeams = teamsList.filter((t) => t.hackathonId === h.id);
                    const sprintSubs = submissions.filter((s) => s.hackathonId === h.id);

                    const isMine = (h.organizerEmail && h.organizerEmail.toLowerCase() === user?.email?.toLowerCase()) ||
                                   (user?.email === "organizer@hacktrack.io" && h.id === "devpulse-2026");

                    return (
                      <div key={h.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
                              {h.stage}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#101b2e] border border-[#223044] text-slate-300 font-mono text-[10px]">
                              {h.category || h.track}
                            </span>
                            {isMine && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] border border-amber-500/30">
                                MANAGED BY YOU
                              </span>
                            )}
                          </div>
                          
                          <h3 className="text-sm font-bold text-white">{h.title}</h3>

                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Deadline: <strong className="text-slate-300">{h.deadline}</strong></span>
                            <span>•</span>
                            <span>Organizer: <strong className="text-slate-300">{h.organizerName || "Central Committee"}</strong></span>
                            <span>•</span>
                            <span>Allowance: <strong className="text-slate-300">{h.teamSize || "2 - 4"}</strong></span>
                          </div>

                          <div className="text-slate-400 mt-1 text-[11px]">
                            {sprintTeams.length} Squads Enrolled • {sprintSubs.length} Deliverable(s)
                          </div>

                          <div className="w-full max-w-xs h-1.5 bg-[#111E31] rounded-full overflow-hidden mt-2 border border-[#253247]/50">
                            <div
                              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                              style={{
                                width: `${
                                  h.stage === "Results Published" || h.stage === "Leaderboard Published" ? 100 :
                                  h.stage === "Rubric Judging" ? 85 :
                                  h.stage === "Screening Gate" ? 70 :
                                  h.stage === "Hacking Phase" ? 50 :
                                  h.stage === "Team Formation" ? 35 : 20
                                }%`
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setConfigTarget(h)}
                            className="px-2.5 py-1.5 bg-[#080e1a] hover:bg-[#121c32] border border-[#253247] text-slate-300 hover:text-white rounded text-xs transition-colors"
                          >
                            Settings
                          </button>
                          <button
                            onClick={() => handleAdvance(h.id)}
                            className="px-2.5 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-emerald-400 hover:text-emerald-300 rounded text-xs transition-colors font-medium"
                          >
                            Advance Stage →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Announcements Broadcast & Squads (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">BROADCAST ANNOUNCEMENT</span>
                <span className="text-[10px] text-slate-400 font-mono">Real-time push</span>
              </div>

              <form onSubmit={handleBroadcastAnnouncement} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Target Competition</label>
                  <select
                    value={announcementTarget}
                    onChange={(e) => setAnnouncementTarget(e.target.value)}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Managed Competitions</option>
                    {displayedHackathons.map((h) => (
                      <option key={h.id} value={h.id}>{h.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Announcement Message *</label>
                  <textarea
                    rows={4}
                    required
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="e.g. Submissions deadline has been extended by 2 hours. Screening starts promptly at 22:00 UTC."
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
                >
                  Send Announcement to Participants 📢
                </button>
              </form>
            </section>

            {/* Registered Squads Snippet */}
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-4 text-xs space-y-2 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#253247] pb-2">
                <span className="text-[10px] font-mono text-slate-300 uppercase block font-semibold">PARTICIPANT SQUADS</span>
                <span className="text-[10px] font-mono text-slate-500">{teamsList.length} Total</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {teamsList.map((t) => (
                  <div key={t.code} className="p-2.5 rounded bg-[#080e1a] border border-[#1c283c] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{t.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Code: <span className="text-emerald-400">{t.code}</span> • {t.capacity}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{t.hackathon?.substring(0, 16)}...</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

        </div>

        {/* Modal: Create New Hackathon */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#0d1526] border border-[#253247] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Create New Hackathon</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Organizer: <span className="text-emerald-400 font-mono">{user?.fullName || "Kavita Rao"} ({user?.university || "DevPulse Operations"})</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateHackathon} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hackathon Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NextGen FinTech Challenge 2026"
                    value={newHackathon.title}
                    onChange={(e) => setNewHackathon({ ...newHackathon, title: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Headline / Tagline</label>
                  <input
                    type="text"
                    placeholder="e.g. Autonomous Agents, Open Banking & Zero-Knowledge Verification"
                    value={newHackathon.headline}
                    onChange={(e) => setNewHackathon({ ...newHackathon, headline: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Domain / Track *</label>
                    <select
                      value={newHackathon.track}
                      onChange={(e) => setNewHackathon({ ...newHackathon, track: e.target.value })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Full-Stack & Cloud Systems">Full-Stack & Cloud Systems</option>
                      <option value="Applied Machine Learning & Agents">Applied Machine Learning & Agents</option>
                      <option value="IoT & Campus Optimization">IoT & Campus Optimization</option>
                      <option value="Cybersecurity & Zero Trust">Cybersecurity & Zero Trust</option>
                      <option value="FinTech & Decentralized Systems">FinTech & Decentralized Systems</option>
                      <option value="Open Innovation">Open Innovation</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Category</label>
                    <select
                      value={newHackathon.category}
                      onChange={(e) => setNewHackathon({ ...newHackathon, category: e.target.value })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Full-Stack">Full-Stack</option>
                      <option value="AI & ML">AI & ML</option>
                      <option value="IoT">IoT</option>
                      <option value="FinTech">FinTech</option>
                      <option value="Cybersecurity">Cybersecurity</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Registration Deadline</label>
                    <input
                      type="text"
                      placeholder="e.g. Nov 25, 2026"
                      value={newHackathon.registrationDeadline}
                      onChange={(e) => setNewHackathon({ ...newHackathon, registrationDeadline: e.target.value })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Submission Deadline *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nov 30, 2026"
                      value={newHackathon.submissionDeadline}
                      onChange={(e) => setNewHackathon({ ...newHackathon, submissionDeadline: e.target.value })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Prize Pool</label>
                    <input
                      type="text"
                      placeholder="$15,000 USD"
                      value={newHackathon.prize}
                      onChange={(e) => setNewHackathon({ ...newHackathon, prize: e.target.value })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Min Team Size</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={newHackathon.minTeamSize}
                      onChange={(e) => setNewHackathon({ ...newHackathon, minTeamSize: Number(e.target.value) })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Max Team Size</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={newHackathon.maxTeamSize}
                      onChange={(e) => setNewHackathon({ ...newHackathon, maxTeamSize: Number(e.target.value) })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Summary / Problem Statement</label>
                  <textarea
                    rows={3}
                    placeholder="Describe the challenge goals, problem statements, and target deliverables..."
                    value={newHackathon.summary}
                    onChange={(e) => setNewHackathon({ ...newHackathon, summary: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Modules Toggle */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Enabled Lifecycle Modules (BR-5)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 bg-[#080e1a] rounded border border-[#1c283c] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.screeningGate}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, screeningGate: e.target.checked }
                        })}
                        className="rounded border-[#253247] text-emerald-500"
                      />
                      <span>Screening Committee Gate</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-[#080e1a] rounded border border-[#1c283c] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.rubricJudging}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, rubricJudging: e.target.checked }
                        })}
                        className="rounded border-[#253247] text-emerald-500"
                      />
                      <span>Rubric Judging</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-[#080e1a] rounded border border-[#1c283c] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.mentorship}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, mentorship: e.target.checked }
                        })}
                        className="rounded border-[#253247] text-emerald-500"
                      />
                      <span>Mentor Consultations</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-[#080e1a] rounded border border-[#1c283c] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.certificates}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, certificates: e.target.checked }
                        })}
                        className="rounded border-[#253247] text-emerald-500"
                      />
                      <span>Automated Certificates</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#253247]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-[#121c32] hover:bg-[#1a2744] text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
                  >
                    Publish Hackathon
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Settings / Modules */}
        {configTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0d1526] border border-[#253247] rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <h3 className="text-sm font-bold text-white">Settings: {configTarget.title}</h3>
                <button onClick={() => setConfigTarget(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Prize Pool</label>
                  <input
                    type="text"
                    value={configTarget.prizePool || ""}
                    onChange={(e) => setConfigTarget({ ...configTarget, prizePool: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Team Size Allowance</label>
                  <input
                    type="text"
                    value={configTarget.teamSize || ""}
                    onChange={(e) => setConfigTarget({ ...configTarget, teamSize: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#253247]">
                  <button
                    type="button"
                    onClick={() => setConfigTarget(null)}
                    className="px-3 py-1.5 bg-[#121c32] text-slate-300 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
