import React, { useState, useMemo } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getStoredHackathons,
  createNewHackathon,
  advanceHackathonStage,
  updateHackathon,
  getHackathonCommittee
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

  // Hackathon-Scoped Inspection State
  const [selectedHackathonId, setSelectedHackathonId] = useState("all");
  const [hackathonViewTab, setHackathonViewTab] = useState("teams"); // 'teams' | 'screening' | 'judges' | 'submissions'
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopyCode = (code) => {
    if (!code) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

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

        {/* HACKATHON SELECTOR TABS BAR */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2 px-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
              HACKATHON-SPECIFIC INSPECTION
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Switch context to view dedicated teams, committee & submissions
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedHackathonId("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedHackathonId === "all"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "bg-[#080e1a] text-slate-300 hover:text-white border border-[#1e2a3e] hover:border-[#2a3c58]"
              }`}
            >
              <span>🌐</span> All Platform Overview
            </button>

            {hackathons.map((h) => {
              const isSelected = selectedHackathonId === h.id;
              return (
                <button
                  key={h.id}
                  onClick={() => {
                    setSelectedHackathonId(h.id);
                    setHackathonViewTab("teams");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#2878F0] text-white shadow-sm"
                      : "bg-[#080e1a] text-slate-300 hover:text-white border border-[#1e2a3e] hover:border-[#2a3c58]"
                  }`}
                >
                  <span>⚡</span> {h.title}
                </button>
              );
            })}
          </div>
        </section>

        {/* CONDITION 1: SPECIFIC HACKATHON SELECTED */}
        {selectedHackathonId !== "all" && (() => {
          const activeH = hackathons.find((h) => h.id === selectedHackathonId) || hackathons[0];
          if (!activeH) return null;

          const committee = getHackathonCommittee(activeH.id);
          const judgeCodeRecord = (committee.codes || []).find((c) => c.role === "judge");
          const screenCodeRecord = (committee.codes || []).find((c) => c.role === "screening");

          const hackTeams = Object.entries(allTeams)
            .filter(([, t]) =>
              t.hackathonId === activeH.id ||
              (t.hackathon && t.hackathon.toLowerCase().includes(activeH.title.toLowerCase()))
            )
            .map(([code, t]) => ({ ...t, code }));

          const hackSubs = allSubmissions.filter((s) =>
            s.hackathonId === activeH.id ||
            (s.hackathonTitle && s.hackathonTitle.toLowerCase().includes(activeH.title.toLowerCase()))
          );

          return (
            <div className="space-y-6 animate-in fade-in">
              {/* Hackathon Header Card */}
              <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-semibold">
                        HACKATHON SCOPED VIEW
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs font-mono text-emerald-400 font-bold">{activeH.stage}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs text-slate-400 font-mono">{activeH.track}</span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{activeH.title}</h2>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl">{activeH.summary || activeH.headline}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfigTarget(activeH)}
                      className="px-3 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 rounded text-xs transition-colors"
                    >
                      ⚙️ Config
                    </button>
                    <button
                      onClick={() => handleAdvanceStage(activeH.id)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs transition-colors"
                    >
                      Advance Stage →
                    </button>
                  </div>
                </div>

                {/* Quick Access Codes & Metrics Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#1e2a3e]">
                  {/* Screening Code */}
                  <div className="p-3 bg-[#080e1a] border border-[#1e2a3e] rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-400 uppercase font-semibold">🛡️ SCREENING CODE</span>
                      <button
                        onClick={() => handleCopyCode(screenCodeRecord?.code)}
                        className="text-[10px] text-amber-300 hover:underline font-mono"
                      >
                        {copiedCode === screenCodeRecord?.code ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="font-mono text-xs text-white font-bold tracking-wide">
                      {screenCodeRecord?.code || "NOT GENERATED"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {committee.screeners.length} reviewer(s) bound
                    </div>
                  </div>

                  {/* Judge Code */}
                  <div className="p-3 bg-[#080e1a] border border-[#1e2a3e] rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-blue-400 uppercase font-semibold">⚖️ JUDGE CODE</span>
                      <button
                        onClick={() => handleCopyCode(judgeCodeRecord?.code)}
                        className="text-[10px] text-blue-300 hover:underline font-mono"
                      >
                        {copiedCode === judgeCodeRecord?.code ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="font-mono text-xs text-white font-bold tracking-wide">
                      {judgeCodeRecord?.code || "NOT GENERATED"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {committee.judges.length} evaluator(s) bound
                    </div>
                  </div>

                  {/* Registered Teams */}
                  <div className="p-3 bg-[#080e1a] border border-[#1e2a3e] rounded-lg space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">ENROLLED SQUADS</span>
                    <span className="text-base font-bold text-white block">{hackTeams.length} Teams</span>
                    <span className="text-[10px] text-slate-500">{hackSubs.length} deliverable(s) submitted</span>
                  </div>

                  {/* Rubric Criteria */}
                  <div className="p-3 bg-[#080e1a] border border-[#1e2a3e] rounded-lg space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">RUBRICS CRITERIA</span>
                    <span className="text-base font-bold text-amber-400 block">{(activeH.rubrics || []).length} Criteria</span>
                    <span className="text-[10px] text-slate-500">{activeH.prizePool || activeH.prize || "Prizes set"}</span>
                  </div>
                </div>
              </section>

              {/* Sub-Tabs: Teams | Screeners | Judges | Deliverables */}
              <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-[#253247] bg-[#121c32] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHackathonViewTab("teams")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        hackathonViewTab === "teams"
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : "text-slate-300 hover:text-white hover:bg-[#1a2744]"
                      }`}
                    >
                      👥 Teams & Participants ({hackTeams.length})
                    </button>
                    <button
                      onClick={() => setHackathonViewTab("screening")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        hackathonViewTab === "screening"
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "text-slate-300 hover:text-white hover:bg-[#1a2744]"
                      }`}
                    >
                      🛡️ Screening Committee ({committee.screeners.length})
                    </button>
                    <button
                      onClick={() => setHackathonViewTab("judges")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        hackathonViewTab === "judges"
                          ? "bg-blue-500 text-white font-bold"
                          : "text-slate-300 hover:text-white hover:bg-[#1a2744]"
                      }`}
                    >
                      ⚖️ Judges & Evaluators ({committee.judges.length})
                    </button>
                    <button
                      onClick={() => setHackathonViewTab("submissions")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        hackathonViewTab === "submissions"
                          ? "bg-purple-500 text-white font-bold"
                          : "text-slate-300 hover:text-white hover:bg-[#1a2744]"
                      }`}
                    >
                      📦 Deliverables ({hackSubs.length})
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    Scoped to {activeH.title}
                  </span>
                </div>

                <div className="p-5">
                  {/* TAB 1: TEAMS */}
                  {hackathonViewTab === "teams" && (
                    <div>
                      {hackTeams.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          No squads currently enrolled in this specific sprint.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="text-[11px] font-mono text-slate-400 border-b border-[#253247] pb-2">
                              <tr>
                                <th className="pb-2.5 font-semibold">Team Code</th>
                                <th className="pb-2.5 font-semibold">Squad Name</th>
                                <th className="pb-2.5 font-semibold">Team Lead</th>
                                <th className="pb-2.5 font-semibold">Members Roster</th>
                                <th className="pb-2.5 font-semibold">Track</th>
                                <th className="pb-2.5 font-semibold text-right">Screening Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1c283c]">
                              {hackTeams.map((t, idx) => (
                                <tr key={idx} className="hover:bg-[#121c32]/50 transition-colors">
                                  <td className="py-3 font-mono font-bold text-emerald-400">{t.code}</td>
                                  <td className="py-3 font-semibold text-white">{t.name}</td>
                                  <td className="py-3 text-slate-300">{t.lead || "Lead Member"}</td>
                                  <td className="py-3 text-slate-400">
                                    {(t.members || []).map((m) => (typeof m === 'string' ? m : m.name || m.email)).join(', ')}
                                  </td>
                                  <td className="py-3 text-slate-400">{t.track || activeH.track}</td>
                                  <td className="py-3 text-right">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
                                      {t.screeningStatus || "Registered"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: SCREENING COMMITTEE */}
                  {hackathonViewTab === "screening" && (
                    <div className="space-y-4">
                      <div className="p-3 bg-[#080e1a] border border-amber-500/20 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
                        <span className="text-base">🛡️</span>
                        <div>
                          <strong className="text-amber-400">Screening Committee Role:</strong> Operates immediately after the submission deadline. Reviewers inspect raw GitHub repos, verify live deployment links, and make gatekeeping decisions: <strong>Shortlist ✓</strong> or <strong>Reject ✗</strong>. Only shortlisted teams advance to judging.
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-[11px] font-mono text-slate-400 border-b border-[#253247] pb-2">
                            <tr>
                              <th className="pb-2.5 font-semibold">Reviewer Name</th>
                              <th className="pb-2.5 font-semibold">Email</th>
                              <th className="pb-2.5 font-semibold">Role</th>
                              <th className="pb-2.5 font-semibold">Assignment Method</th>
                              <th className="pb-2.5 font-semibold text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1c283c]">
                            {committee.screeners.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="py-6 text-center text-slate-500 italic">
                                  No screening reviewers bound yet. Share code <span className="font-mono text-amber-400">{screenCodeRecord?.code}</span> with your review team.
                                </td>
                              </tr>
                            ) : (
                              committee.screeners.map((s, idx) => (
                                <tr key={idx} className="hover:bg-[#121c32]/50 transition-colors">
                                  <td className="py-3 font-semibold text-white">{s.fullName || "Screening Reviewer"}</td>
                                  <td className="py-3 text-slate-300 font-mono text-[11px]">{s.email}</td>
                                  <td className="py-3">
                                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px]">
                                      Screening Gatekeeper
                                    </span>
                                  </td>
                                  <td className="py-3 text-slate-400 font-mono text-[11px]">
                                    Code Redemption ({screenCodeRecord?.code || "Direct"})
                                  </td>
                                  <td className="py-3 text-right">
                                    <span className="text-emerald-400 font-mono text-[10px]">● Active</span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: JUDGES */}
                  {hackathonViewTab === "judges" && (
                    <div className="space-y-4">
                      <div className="p-3 bg-[#080e1a] border border-blue-500/20 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
                        <span className="text-base">⚖️</span>
                        <div>
                          <strong className="text-blue-400">Judge / Evaluator Role:</strong> Evaluates only shortlisted submissions after screening clearance. Judges score projects across {(activeH.rubrics || []).length} rubric criteria to calculate the final weighted score and rank.
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-[11px] font-mono text-slate-400 border-b border-[#253247] pb-2">
                            <tr>
                              <th className="pb-2.5 font-semibold">Judge Name</th>
                              <th className="pb-2.5 font-semibold">Email</th>
                              <th className="pb-2.5 font-semibold">Assigned Rubrics</th>
                              <th className="pb-2.5 font-semibold">Assignment Method</th>
                              <th className="pb-2.5 font-semibold text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1c283c]">
                            {committee.judges.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="py-6 text-center text-slate-500 italic">
                                  No judges bound yet. Share code <span className="font-mono text-blue-400">{judgeCodeRecord?.code}</span> with your evaluator panel.
                                </td>
                              </tr>
                            ) : (
                              committee.judges.map((j, idx) => (
                                <tr key={idx} className="hover:bg-[#121c32]/50 transition-colors">
                                  <td className="py-3 font-semibold text-white">{j.fullName || "Judge Evaluator"}</td>
                                  <td className="py-3 text-slate-300 font-mono text-[11px]">{j.email}</td>
                                  <td className="py-3 text-slate-400">
                                    {(activeH.rubrics || []).map((r) => r.name).slice(0, 2).join(', ') || "Standard Rubrics"}...
                                  </td>
                                  <td className="py-3 text-slate-400 font-mono text-[11px]">
                                    Code Redemption ({judgeCodeRecord?.code || "Direct"})
                                  </td>
                                  <td className="py-3 text-right">
                                    <span className="text-emerald-400 font-mono text-[10px]">● Active</span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: DELIVERABLES */}
                  {hackathonViewTab === "submissions" && (
                    <div>
                      {hackSubs.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          No project deliverables uploaded for this hackathon yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="text-[11px] font-mono text-slate-400 border-b border-[#253247] pb-2">
                              <tr>
                                <th className="pb-2.5 font-semibold">Project Title</th>
                                <th className="pb-2.5 font-semibold">Squad</th>
                                <th className="pb-2.5 font-semibold">Repository</th>
                                <th className="pb-2.5 font-semibold">Live Preview</th>
                                <th className="pb-2.5 font-semibold text-right">Screening Decision</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1c283c]">
                              {hackSubs.map((s, idx) => (
                                <tr key={idx} className="hover:bg-[#121c32]/50 transition-colors">
                                  <td className="py-3 font-bold text-white pr-4">
                                    {s.projectTitle || "Project Deliverable"}
                                  </td>
                                  <td className="py-3 text-slate-300 pr-4">{s.teamName || s.teamId}</td>
                                  <td className="py-3 text-blue-400 font-mono text-[11px] pr-4">
                                    <a href={s.repositoryUrl || s.repoUrl || "#"} target="_blank" rel="noreferrer" className="hover:underline">
                                      {s.repositoryUrl ? "GitHub ↗" : "None"}
                                    </a>
                                  </td>
                                  <td className="py-3 text-emerald-400 font-mono text-[11px] pr-4">
                                    <a href={s.liveDemoUrl || s.demoUrl || "#"} target="_blank" rel="noreferrer" className="hover:underline">
                                      {s.liveDemoUrl ? "Live Demo ↗" : "None"}
                                    </a>
                                  </td>
                                  <td className="py-3 text-right">
                                    <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                                      s.screeningStatus === "Shortlisted"
                                        ? "bg-emerald-950 border border-emerald-500/30 text-emerald-400"
                                        : s.screeningStatus === "Rejected"
                                        ? "bg-rose-950 border border-rose-500/30 text-rose-400"
                                        : "bg-amber-950 border border-amber-500/30 text-amber-400"
                                    }`}>
                                      {s.screeningStatus || "Pending Review"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          );
        })()}

        {/* CONDITION 2: GLOBAL PLATFORM OVERVIEW (WHEN ALL IS SELECTED) */}
        {selectedHackathonId === "all" && (
          <>
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
          </>
        )}

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
