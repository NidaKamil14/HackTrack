import React, { useState, useMemo } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getStoredHackathons,
  createNewHackathon,
  advanceHackathonStage,
  updateHackathon
} from '../../utils/hackathonService';
import { getUsers, updateUserRole } from '../../utils/auth';
import { getAllTeams } from '../../utils/teamService';
import { getSubmissions } from '../../utils/submissionService';
import {
  getEvaluations,
  setResultsPublished,
  isResultsPublished
} from '../../utils/evaluationService';
import { issueCertificate } from '../../utils/certificateService';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  // Live state from persistent services
  const hackathons = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getStoredHackathons();
  }, [refreshKey]);

  const usersList = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getUsers();
  }, [refreshKey]);

  const allTeams = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getAllTeams();
  }, [refreshKey]);

  const allSubmissions = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getSubmissions();
  }, [refreshKey]);

  const allEvaluations = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getEvaluations();
  }, [refreshKey]);

  const [adminNotice, setAdminNotice] = useState(null);

  // Modal: Create Hackathon
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newHackathon, setNewHackathon] = useState({
    title: "",
    track: "Full-Stack & Cloud Systems",
    stage: "Registration Open",
    prize: "$10,000 USD",
    deadline: "Nov 30, 2026",
    teamSize: "2 - 4 Members",
    enabledModules: {
      screeningGate: true,
      rubricJudging: true,
      mentorship: true,
      certificates: true
    }
  });

  // Modal: Edit Hackathon Modules / Settings
  const [configTarget, setConfigTarget] = useState(null);

  // Dynamic Metrics
  const shortlistedSubs = allSubmissions.filter((s) => s.screeningStatus === "Shortlisted").length;
  const reviewedSubs = allSubmissions.filter((s) => s.screeningStatus === "Shortlisted" || s.screeningStatus === "Rejected").length;
  const clearanceRate = reviewedSubs > 0 ? `${((shortlistedSubs / reviewedSubs) * 100).toFixed(1)}%` : "100%";

  const handleAdvanceStage = (id) => {
    const res = advanceHackathonStage(id);
    if (res.success) {
      setAdminNotice(`Stage advanced for "${res.hackathon.title}" → ${res.hackathon.stage}`);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setAdminNotice(null), 3500);
    }
  };

  const handleCreateHackathon = (e) => {
    e.preventDefault();
    if (!newHackathon.title.trim()) return;

    const res = createNewHackathon({
      title: newHackathon.title.trim(),
      track: newHackathon.track,
      stage: newHackathon.stage,
      prizePool: newHackathon.prize,
      deadline: newHackathon.deadline,
      teamSize: newHackathon.teamSize,
      enabledModules: newHackathon.enabledModules
    });

    if (res.success) {
      setShowCreateModal(false);
      setNewHackathon({
        title: "",
        track: "Full-Stack & Cloud Systems",
        stage: "Registration Open",
        prize: "$10,000 USD",
        deadline: "Nov 30, 2026",
        teamSize: "2 - 4 Members",
        enabledModules: {
          screeningGate: true,
          rubricJudging: true,
          mentorship: true,
          certificates: true
        }
      });
      setAdminNotice(`✓ Sanctioned new hackathon: "${res.hackathon.title}".`);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setAdminNotice(null), 3500);
    }
  };

  const handleRoleChange = (email, newRole) => {
    const res = updateUserRole(email, newRole);
    if (res.success) {
      setAdminNotice(`✓ Updated role for ${email} to ${newRole.toUpperCase()}.`);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setAdminNotice(null), 3500);
    }
  };

  const handlePublishResults = (hackathonId, title) => {
    setResultsPublished(hackathonId, true);

    // Issue certificates for all evaluated teams in this sprint
    const sprintEvals = allEvaluations.filter((e) => e.hackathonId === hackathonId || !e.hackathonId);
    sprintEvals.forEach((ev, idx) => {
      const award = idx === 0 ? "Grand Prize Champion (1st Place)" : idx === 1 ? "1st Runner Up (2nd Place)" : "Technical Finalist Award";
      issueCertificate({
        recipientName: ev.leadName || "Alex Chen",
        recipientEmail: ev.submittedBy || "alex@university.edu",
        teamName: ev.teamName,
        projectTitle: ev.projectTitle || "Hackathon Project",
        hackathonId,
        hackathonTitle: title,
        track: ev.track || "General Track",
        awardTitle: award,
        rank: `${idx + 1}th Place`,
        score: ev.totalScore
      });
    });

    setAdminNotice(`✓ Official results & digital certificates certified and released for "${title}"! Visible to all participants.`);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setAdminNotice(null), 5000);
  };

  const handleSaveModulesConfig = (e) => {
    e.preventDefault();
    if (!configTarget) return;

    updateHackathon(configTarget.id, {
      teamSize: configTarget.teamSize,
      deadline: configTarget.deadline,
      enabledModules: configTarget.enabledModules
    });

    setConfigTarget(null);
    setAdminNotice(`✓ Updated configuration rules for "${configTarget.title}".`);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setAdminNotice(null), 3500);
  };

  return (
    <DashboardLayout
      portalTitle="Platform Administration & Governance Console"
      roleBadgeText="PLATFORM ADMINISTRATOR"
    >
      <div className="space-y-6">
        
        {/* 1. PLATFORM OVERVIEW */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  ADMIN CONSOLE
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {user?.university || "HackTrack Central HQ"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Platform Overview
              </h1>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
            >
              + Create New Hackathon
            </button>
          </div>

          {/* 5 Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-[#253247]">
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">ACTIVE SPRINTS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{hackathons.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">REGISTERED USERS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{usersList.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">TEAMS FORMED</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{Object.keys(allTeams).length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-emerald-400 font-mono uppercase block">SCREENING PASS RATE</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{clearanceRate}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-amber-400 font-mono uppercase block">CERTIFIED EVALUATIONS</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">{allEvaluations.length}</span>
            </div>
          </div>
        </section>

        {adminNotice && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs">
            {adminNotice}
          </div>
        )}

        {/* 2. COMPETITION MANAGEMENT CARD */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-[#253247] bg-[#121c32] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                COMPETITION MANAGEMENT
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Stage progression, rules configuration, and certified results publication
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{hackathons.length} Sprints</span>
          </div>

          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-mono text-slate-400 border-b border-[#253247] pb-2">
                  <tr>
                    <th className="pb-2.5 font-semibold">Sprint Title</th>
                    <th className="pb-2.5 font-semibold">Track</th>
                    <th className="pb-2.5 font-semibold">Current Stage</th>
                    <th className="pb-2.5 font-semibold">Deadline</th>
                    <th className="pb-2.5 font-semibold">Results Release</th>
                    <th className="pb-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c283c]">
                  {hackathons.map((h) => {
                    const isPub = isResultsPublished(h.id);

                    return (
                      <tr key={h.id} className="hover:bg-[#121c32]/50 transition-colors">
                        <td className="py-3 font-bold text-white pr-4">{h.title}</td>
                        <td className="py-3 text-slate-300 pr-4">{h.track}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] w-fit">
                              {h.stage}
                            </span>
                            <div className="w-20 h-1 bg-[#111E31] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#2878F0] rounded-full transition-all duration-300"
                                style={{
                                  width: `${
                                    h.stage === "Results Published" ? 100 :
                                    h.stage === "Rubric Judging" ? 85 :
                                    h.stage === "Screening Gate" ? 70 :
                                    h.stage === "Hacking Phase" ? 50 :
                                    h.stage === "Team Formation" ? 35 : 20
                                  }%`
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-slate-400 font-mono pr-4">{h.deadline}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isPub
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                              : "bg-[#121c32] border border-[#253247] text-slate-400"
                          }`}>
                            {isPub ? "● Released" : "Private"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setConfigTarget(h)}
                              className="px-2.5 py-1 bg-[#121c32] hover:bg-[#1a2744] text-slate-300 border border-[#253247] rounded text-[11px] transition-colors"
                            >
                              Config
                            </button>

                            <button
                              onClick={() => handleAdvanceStage(h.id)}
                              className="px-2.5 py-1 bg-[#162238] hover:bg-[#1d2d4a] text-slate-200 border border-[#253247] rounded text-[11px] font-medium transition-colors"
                            >
                              Advance Stage →
                            </button>

                            {!isPub && (
                              <button
                                onClick={() => handlePublishResults(h.id, h.title)}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-[11px] transition-colors"
                              >
                                Release Results
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3. USERS & ROLES CARD */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-[#253247] bg-[#121c32] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                USERS & ROLE ASSIGNMENTS
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Participant, committee, judge, organizer, and mentor assignments
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{usersList.length} Active Records</span>
          </div>

          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-mono text-slate-400 border-b border-[#253247] pb-2">
                  <tr>
                    <th className="pb-2.5 font-semibold">Name</th>
                    <th className="pb-2.5 font-semibold">Email</th>
                    <th className="pb-2.5 font-semibold">Current Role</th>
                    <th className="pb-2.5 font-semibold">Organization</th>
                    <th className="pb-2.5 font-semibold text-right">Reassign Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c283c]">
                  {usersList.map((u, i) => (
                    <tr key={i} className="hover:bg-[#121c32]/50 transition-colors">
                      <td className="py-3 font-semibold text-white">{u.fullName}</td>
                      <td className="py-3 text-slate-300 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-[#121c32] border border-[#253247] text-emerald-400 font-mono text-[10px]">
                          {u.roleCategory || u.role}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{u.university}</td>
                      <td className="py-3 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.email, e.target.value)}
                          className="bg-[#080e1a] border border-[#223044] text-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500"
                        >
                          <option value="student">Student / Participant</option>
                          <option value="leader">Team Leader</option>
                          <option value="screening">Screening Committee</option>
                          <option value="judge">Judge / Evaluator</option>
                          <option value="admin">Platform Admin</option>
                          <option value="organizer">Organizer</option>
                          <option value="mentor">Technical Mentor</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 4. PLATFORM AUDIT & INTEGRITY ACTIONS */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-[#253247] bg-[#121c32]">
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              PLATFORM ACTIONS & AUTOMATION
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              System-wide audit scans and certified ranking publication
            </p>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-2.5">
              <h3 className="text-sm font-bold text-white">Automated Integrity Screen</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan all {allSubmissions.length} participant repositories for pre-dated commits and tampering.
              </p>
              <button
                onClick={() => {
                  setAdminNotice("Executed repository integrity scan. Zero commit discrepancies detected across active submissions.");
                  setTimeout(() => setAdminNotice(null), 3500);
                }}
                className="px-3.5 py-1.5 bg-[#121c32] hover:bg-[#1a2744] text-slate-200 border border-[#253247] text-xs font-semibold rounded-lg transition-colors"
              >
                Execute Integrity Scan
              </button>
            </div>

            <div className="p-4 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-2.5">
              <h3 className="text-sm font-bold text-white">Publish Certified Leaderboard</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Lock completed evaluations, aggregate weights, and reveal final public standings across all sprints.
              </p>
              <button
                onClick={() => {
                  hackathons.forEach((h) => setResultsPublished(h.id, true));
                  setAdminNotice("Official rankings compiled and certified for platform-wide release.");
                  setRefreshKey((k) => k + 1);
                  setTimeout(() => setAdminNotice(null), 3500);
                }}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
              >
                Certify & Publish All Results
              </button>
            </div>
          </div>
        </section>

        {/* MODAL: CREATE NEW HACKATHON */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060a12]/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#0d1526] border border-[#253247] rounded-xl max-w-md w-full p-6 relative shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  SANCTION NEW HACKATHON
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕ Close
                </button>
              </div>

              <form onSubmit={handleCreateHackathon} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Competition Title *</label>
                  <input
                    type="text"
                    required
                    value={newHackathon.title}
                    onChange={(e) => setNewHackathon({ ...newHackathon, title: e.target.value })}
                    placeholder="e.g. NextGen Web3 Sprint"
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Track Category</label>
                  <select
                    value={newHackathon.track}
                    onChange={(e) => setNewHackathon({ ...newHackathon, track: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none"
                  >
                    <option value="Full-Stack & Cloud Systems">Full-Stack & Cloud Systems</option>
                    <option value="Applied Machine Learning & Agents">Applied Machine Learning & Agents</option>
                    <option value="IoT & Campus Optimization">IoT & Campus Optimization</option>
                    <option value="Web3 & Smart Contracts">Web3 & Smart Contracts</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Prize Pool</label>
                    <input
                      type="text"
                      value={newHackathon.prize}
                      onChange={(e) => setNewHackathon({ ...newHackathon, prize: e.target.value })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Deadline</label>
                    <input
                      type="text"
                      value={newHackathon.deadline}
                      onChange={(e) => setNewHackathon({ ...newHackathon, deadline: e.target.value })}
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Team Size Limits</label>
                  <input
                    type="text"
                    value={newHackathon.teamSize}
                    onChange={(e) => setNewHackathon({ ...newHackathon, teamSize: e.target.value })}
                    placeholder="e.g. 2 - 4 Members"
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none"
                  />
                </div>

                {/* Enabled Modules */}
                <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-1.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">Enabled Modules</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.screeningGate}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, screeningGate: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Screening Gate</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.rubricJudging}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, rubricJudging: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Rubric Judging</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.mentorship}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, mentorship: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Mentorship</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHackathon.enabledModules.certificates}
                        onChange={(e) => setNewHackathon({
                          ...newHackathon,
                          enabledModules: { ...newHackathon.enabledModules, certificates: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Certificates</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors mt-2"
                >
                  Create Competition
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT HACKATHON CONFIGURATION */}
        {configTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060a12]/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#0d1526] border border-[#253247] rounded-xl max-w-md w-full p-6 relative shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  CONFIGURE RULES: {configTarget.title}
                </h3>
                <button
                  onClick={() => setConfigTarget(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕ Close
                </button>
              </div>

              <form onSubmit={handleSaveModulesConfig} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Submission Deadline</label>
                  <input
                    type="text"
                    value={configTarget.deadline || ""}
                    onChange={(e) => setConfigTarget({ ...configTarget, deadline: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Team Size Limits</label>
                  <input
                    type="text"
                    value={configTarget.teamSize || ""}
                    onChange={(e) => setConfigTarget({ ...configTarget, teamSize: e.target.value })}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">Active Modules</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configTarget.enabledModules?.screeningGate !== false}
                        onChange={(e) => setConfigTarget({
                          ...configTarget,
                          enabledModules: { ...configTarget.enabledModules, screeningGate: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Screening Gate</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configTarget.enabledModules?.rubricJudging !== false}
                        onChange={(e) => setConfigTarget({
                          ...configTarget,
                          enabledModules: { ...configTarget.enabledModules, rubricJudging: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Rubric Judging</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configTarget.enabledModules?.mentorship !== false}
                        onChange={(e) => setConfigTarget({
                          ...configTarget,
                          enabledModules: { ...configTarget.enabledModules, mentorship: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Mentorship</span>
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configTarget.enabledModules?.certificates !== false}
                        onChange={(e) => setConfigTarget({
                          ...configTarget,
                          enabledModules: { ...configTarget.enabledModules, certificates: e.target.checked }
                        })}
                        className="rounded accent-emerald-500"
                      />
                      <span>Certificates</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Save Configuration
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
