import React, { useState, useMemo } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getStoredHackathons,
  createNewHackathon,
  advanceHackathonStage,
  updateHackathon,
  generateHackathonCode,
  getHackathonCommittee
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

  // Modal State: Committee & Access Codes
  const [manageTarget, setManageTarget] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const openManageModal = (hackathon) => {
    setManageTarget(hackathon);
    setCopiedCode(null);
  };

  const handleRegenerateCode = (role) => {
    if (!manageTarget) return;
    const res = generateHackathonCode(manageTarget.id, role, user?.email || "organizer@hacktrack.io");
    if (res.success) {
      setRefreshKey((k) => k + 1);
      setNotice(`Generated new ${role.toUpperCase()} code: ${res.codeRecord.code}`);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Modal State: Rubric Editor
  const [rubricTarget, setRubricTarget] = useState(null);
  const [rubricDraft, setRubricDraft] = useState([]);
  const [rubricError, setRubricError] = useState("");

  const openRubricEditor = (hackathon) => {
    setRubricTarget(hackathon);
    setRubricDraft(
      (hackathon.rubrics || []).map((r, i) => ({
        _key: `existing-${i}`,
        name: r.name || "",
        weight: r.weight || "0%",
        desc: r.desc || r.description || "",
      }))
    );
    setRubricError("");
  };

  const addRubricRow = () => {
    setRubricDraft((prev) => [
      ...prev,
      { _key: `new-${Date.now()}`, name: "", weight: "0%", desc: "" },
    ]);
  };

  const removeRubricRow = (key) => {
    setRubricDraft((prev) => prev.filter((r) => r._key !== key));
  };

  const updateRubricRow = (key, field, value) => {
    setRubricDraft((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  };

  const moveRubricRow = (index, direction) => {
    const next = [...rubricDraft];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setRubricDraft(next);
  };

  const computeTotalWeight = () => {
    return rubricDraft.reduce((sum, r) => {
      const num = parseFloat(r.weight) || 0;
      return sum + num;
    }, 0);
  };

  const handleSaveRubrics = async (e) => {
    e.preventDefault();
    if (!rubricTarget) return;

    // Validate
    const nonEmpty = rubricDraft.filter((r) => r.name.trim());
    if (nonEmpty.length === 0) {
      setRubricError("Add at least one rubric criterion.");
      return;
    }

    const total = nonEmpty.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
    if (Math.abs(total - 100) > 1) {
      setRubricError(`Weights must add up to 100%. Currently: ${total.toFixed(0)}%`);
      return;
    }

    const cleanRubrics = nonEmpty.map((r) => ({
      name: r.name.trim(),
      weight: r.weight.includes("%") ? r.weight.trim() : `${r.weight.trim()}%`,
      desc: r.desc.trim(),
    }));

    // Save to localStorage
    updateHackathon(rubricTarget.id, { rubrics: cleanRubrics });

    // Also try saving to backend API
    try {
      const token = localStorage.getItem("hacktrack_token");
      if (token) {
        await fetch(`http://localhost:5050/api/v1/hackathons/${rubricTarget.id}/criteria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            criteria: cleanRubrics.map((r) => ({
              name: r.name,
              maxScore: parseFloat(r.weight) || 25,
              weightage: (parseFloat(r.weight) || 25) / 100,
              description: r.desc,
            })),
          }),
        });
      }
    } catch {
      // Fallback handled by localStorage
    }

    setRubricTarget(null);
    setRubricDraft([]);
    setRefreshKey((k) => k + 1);
    setNotice(`✓ Evaluation rubrics updated for "${rubricTarget.title}".`);
    setTimeout(() => setNotice(null), 4000);
  };

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
                            onClick={() => openManageModal(h)}
                            className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:text-blue-300 rounded text-xs transition-colors font-medium flex items-center gap-1.5"
                            title="Manage judge & screening access codes"
                          >
                            <span>🔑</span> Codes & Committee
                          </button>
                          <button
                            onClick={() => openRubricEditor(h)}
                            className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 rounded text-xs transition-colors font-medium"
                          >
                            ✦ Rubrics ({(h.rubrics || []).length})
                          </button>
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

        {/* Modal: Rubric Editor */}
        {rubricTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#0d1526] border border-[#253247] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400">✦</span> Evaluation Rubrics
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure scoring criteria for <span className="text-amber-400 font-mono">{rubricTarget.title}</span>
                  </p>
                </div>
                <button
                  onClick={() => { setRubricTarget(null); setRubricDraft([]); }}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Weight Summary Bar */}
              <div className="bg-[#080e1a] border border-[#1c283c] rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-400 font-mono">TOTAL WEIGHT</span>
                  <span className={`font-bold font-mono ${
                    Math.abs(computeTotalWeight() - 100) <= 1
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}>
                    {computeTotalWeight().toFixed(0)}% / 100%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#111E31] rounded-full overflow-hidden border border-[#253247]/50">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      Math.abs(computeTotalWeight() - 100) <= 1
                        ? "bg-emerald-400"
                        : computeTotalWeight() > 100
                          ? "bg-red-400"
                          : "bg-amber-400"
                    }`}
                    style={{ width: `${Math.min(computeTotalWeight(), 100)}%` }}
                  />
                </div>
              </div>

              {rubricError && (
                <div className="p-2.5 bg-red-950/40 border border-red-800/50 text-red-300 rounded-lg text-xs">
                  ⚠ {rubricError}
                </div>
              )}

              {/* Rubric Rows */}
              <form onSubmit={handleSaveRubrics} className="space-y-3">
                <div className="space-y-2">
                  {rubricDraft.map((r, idx) => (
                    <div
                      key={r._key}
                      className="bg-[#080e1a] border border-[#1c283c] rounded-lg p-3 space-y-2 group hover:border-amber-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          Criterion #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveRubricRow(idx, -1)}
                            disabled={idx === 0}
                            className="text-slate-500 hover:text-white text-xs px-1 disabled:opacity-30"
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRubricRow(idx, 1)}
                            disabled={idx === rubricDraft.length - 1}
                            className="text-slate-500 hover:text-white text-xs px-1 disabled:opacity-30"
                            title="Move down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRubricRow(r._key)}
                            className="text-red-400/60 hover:text-red-400 text-xs px-1.5 ml-1"
                            title="Delete criterion"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                          <label className="text-[10px] text-slate-500 font-mono block mb-0.5">NAME *</label>
                          <input
                            type="text"
                            required
                            value={r.name}
                            onChange={(e) => updateRubricRow(r._key, "name", e.target.value)}
                            placeholder="e.g. Technical Depth & Architecture"
                            className="w-full bg-[#0d1526] border border-[#223044] rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-500 font-mono block mb-0.5">WEIGHT *</label>
                          <input
                            type="text"
                            required
                            value={r.weight}
                            onChange={(e) => updateRubricRow(r._key, "weight", e.target.value)}
                            placeholder="30%"
                            className="w-full bg-[#0d1526] border border-[#223044] rounded p-2 text-xs text-amber-400 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 text-center"
                          />
                        </div>
                        <div className="col-span-5">
                          <label className="text-[10px] text-slate-500 font-mono block mb-0.5">DESCRIPTION</label>
                          <input
                            type="text"
                            value={r.desc}
                            onChange={(e) => updateRubricRow(r._key, "desc", e.target.value)}
                            placeholder="What judges should evaluate..."
                            className="w-full bg-[#0d1526] border border-[#223044] rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Criterion Button */}
                <button
                  type="button"
                  onClick={addRubricRow}
                  className="w-full py-2.5 border-2 border-dashed border-[#253247] hover:border-amber-500/40 rounded-lg text-xs text-slate-400 hover:text-amber-400 transition-colors"
                >
                  + Add Evaluation Criterion
                </button>

                {/* Preset Templates */}
                <div className="pt-2 border-t border-[#253247]">
                  <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">QUICK TEMPLATES</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRubricDraft([
                        { _key: "t1", name: "Innovation & Novelty", weight: "25%", desc: "Originality and creativity of the proposed solution." },
                        { _key: "t2", name: "Technical Execution", weight: "25%", desc: "Code quality, architecture, and technical completeness." },
                        { _key: "t3", name: "UI/UX Design", weight: "25%", desc: "User interface elegance, usability, and accessibility." },
                        { _key: "t4", name: "Real-world Feasibility", weight: "25%", desc: "Scalability, business viability, and practical impact." },
                      ])}
                      className="px-3 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 hover:text-white rounded text-[11px] transition-colors"
                    >
                      🎯 Standard (4 criteria × 25%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRubricDraft([
                        { _key: "a1", name: "Agent Autonomy & Intelligence", weight: "35%", desc: "Robustness of multi-step planning and tool usage." },
                        { _key: "a2", name: "Novelty & System Utility", weight: "25%", desc: "Uniqueness compared to existing commercial tools." },
                        { _key: "a3", name: "Execution & Engineering", weight: "25%", desc: "API resilience, error fallbacks, and response latency." },
                        { _key: "a4", name: "Responsible AI Standards", weight: "15%", desc: "Guardrails, toxicity filtering, dataset attribution." },
                      ])}
                      className="px-3 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 hover:text-white rounded text-[11px] transition-colors"
                    >
                      🤖 AI / ML Focus
                    </button>
                    <button
                      type="button"
                      onClick={() => setRubricDraft([
                        { _key: "h1", name: "Hardware & Telemetry Quality", weight: "35%", desc: "Sensor fidelity, data transmission, battery efficiency." },
                        { _key: "h2", name: "Practical Impact", weight: "30%", desc: "Cost savings or tangible benefits to operations." },
                        { _key: "h3", name: "Dashboard & Interface Design", weight: "20%", desc: "Clarity of visualizations and alerting responsiveness." },
                        { _key: "h4", name: "Scalability & Viability", weight: "15%", desc: "Ease of deployment across environments." },
                      ])}
                      className="px-3 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 hover:text-white rounded text-[11px] transition-colors"
                    >
                      🔌 IoT / Hardware
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-3 border-t border-[#253247]">
                  <button
                    type="button"
                    onClick={() => { setRubricTarget(null); setRubricDraft([]); }}
                    className="px-4 py-2 bg-[#121c32] hover:bg-[#1a2744] text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
                  >
                    Save Rubrics
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Committee & Access Codes Management */}
        {manageTarget && (() => {
          const committee = getHackathonCommittee(manageTarget.id);
          const judgeCodeRecord = (committee.codes || []).find((c) => c.role === "judge");
          const screeningCodeRecord = (committee.codes || []).find((c) => c.role === "screening");

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
              <div className="bg-[#0d1526] border border-[#253247] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-[#253247] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[11px] font-semibold">
                        ACCESS CODES & COMMITTEE
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-xs text-slate-400 font-mono">{manageTarget.stage}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">
                      {manageTarget.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setManageTarget(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#121c32] transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Explanatory Banner: Screening vs Judges */}
                <div className="p-3.5 bg-[#080e1a] border border-[#1e2a3e] rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1">
                      <span>🛡️</span>
                      <span>Screening Committee (Gatekeeper)</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Operates <strong>first</strong> right after submission deadline. Verifies commit authenticity, documentation, live URL. Makes binary decision: <strong>Shortlist ✓</strong> or <strong>Reject ✗</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-1">
                      <span>⚖️</span>
                      <span>Judges (Final Scoring)</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Operates <strong>second</strong> after screening. Evaluates <em>only shortlisted</em> teams against your configured rubrics ({manageTarget.rubrics?.length || 4} criteria) to determine final rank and leaderboard.
                    </p>
                  </div>
                </div>

                {/* Access Codes Section */}
                <div className="space-y-4">
                  {/* Screening Committee Code Card */}
                  <div className="p-4 bg-[#080e1a] border border-[#1c283c] rounded-xl space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wide">
                            🛡️ SCREENING COMMITTEE ACCESS CODE
                          </span>
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                            Shortlisting
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Share this code with committee reviewers. They enter it once on their dashboard to unlock this hackathon.
                        </p>
                      </div>

                      <button
                        onClick={() => handleRegenerateCode('screening')}
                        className="px-2.5 py-1 bg-[#121c32] hover:bg-[#1a2744] text-slate-300 hover:text-white border border-[#253247] rounded text-[11px] transition-colors shrink-0"
                      >
                        🔄 Regenerate
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#050911] border border-[#253247] rounded-lg px-3.5 py-2 font-mono text-sm font-bold text-amber-300 tracking-wider">
                        {screeningCodeRecord?.code || "NOT GENERATED"}
                      </div>
                      <button
                        onClick={() => handleCopyCode(screeningCodeRecord?.code)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                          copiedCode === screeningCodeRecord?.code
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {copiedCode === screeningCodeRecord?.code ? "✓ Copied!" : "Copy Code"}
                      </button>
                    </div>

                    {/* Redeemed Screeners */}
                    <div className="pt-2 border-t border-[#192334]">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
                        <span>BOUND SCREENING REVIEWERS ({committee.screeners.length})</span>
                      </div>
                      {committee.screeners.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-1">No screeners have redeemed this code yet. Share the code above.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {committee.screeners.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-[#0d1526] rounded border border-[#1e2a3e]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{s.fullName || "Screening Reviewer"}</span>
                                <span className="text-slate-400 font-mono text-[11px]">{s.email}</span>
                              </div>
                              <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Judge Access Code Card */}
                  <div className="p-4 bg-[#080e1a] border border-[#1c283c] rounded-xl space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wide">
                            ⚖️ JUDGE ACCESS CODE
                          </span>
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                            Final Rubric Scoring
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Share this code with your evaluators. They enter it once on their Judge dashboard to score submissions against your rubrics.
                        </p>
                      </div>

                      <button
                        onClick={() => handleRegenerateCode('judge')}
                        className="px-2.5 py-1 bg-[#121c32] hover:bg-[#1a2744] text-slate-300 hover:text-white border border-[#253247] rounded text-[11px] transition-colors shrink-0"
                      >
                        🔄 Regenerate
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#050911] border border-[#253247] rounded-lg px-3.5 py-2 font-mono text-sm font-bold text-blue-300 tracking-wider">
                        {judgeCodeRecord?.code || "NOT GENERATED"}
                      </div>
                      <button
                        onClick={() => handleCopyCode(judgeCodeRecord?.code)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                          copiedCode === judgeCodeRecord?.code
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40"
                        }`}
                      >
                        {copiedCode === judgeCodeRecord?.code ? "✓ Copied!" : "Copy Code"}
                      </button>
                    </div>

                    {/* Redeemed Judges */}
                    <div className="pt-2 border-t border-[#192334]">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
                        <span>BOUND JUDGES / EVALUATORS ({committee.judges.length})</span>
                      </div>
                      {committee.judges.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-1">No judges have redeemed this code yet. Share the code above.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {committee.judges.map((j, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-[#0d1526] rounded border border-[#1e2a3e]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{j.fullName || "Judge Evaluator"}</span>
                                <span className="text-slate-400 font-mono text-[11px]">{j.email}</span>
                              </div>
                              <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[#253247]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const h = manageTarget;
                        setManageTarget(null);
                        openRubricEditor(h);
                      }}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      ✦ Edit Rubrics ({(manageTarget.rubrics || []).length})
                    </button>
                    <button
                      onClick={() => {
                        const h = manageTarget;
                        setManageTarget(null);
                        setConfigTarget(h);
                      }}
                      className="px-3 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 rounded-lg text-xs transition-colors"
                    >
                      ⚙️ Hackathon Rules & Settings
                    </button>
                  </div>

                  <button
                    onClick={() => setManageTarget(null)}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          );
        })()}


      </div>
    </DashboardLayout>
  );
}
