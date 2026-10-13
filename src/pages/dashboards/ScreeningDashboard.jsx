import React, { useState, useMemo } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { Icons } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { getFinalizedSubmissions, updateScreeningDecision } from '../../utils/submissionService.js';
import {
  getStoredHackathons,
  getUserAssignedHackathonIds,
  redeemAccessCode
} from '../../utils/hackathonService.js';

export default function ScreeningDashboard() {
  const { user } = useAuth();

  const loadSubmissions = () => {
    const finalized = getFinalizedSubmissions();
    return finalized.map((sub, idx) => ({
      id: sub.submissionId || `sub-fin-${idx}`,
      teamName: sub.teamName,
      hackathonTitle: sub.hackathonTitle || sub.hackathonId,
      hackathonId: sub.hackathonId,
      track: sub.track || "General Track",
      lead: sub.leadName || sub.submittedBy || "Team Lead",
      projectTitle: sub.projectTitle || "Untitled Project",
      projectDescription: sub.projectDescription || "",
      repoUrl: sub.repositoryUrl || "#",
      demoUrl: sub.liveDemoUrl || "#",
      submissionFiles: sub.submissionFiles || [],
      submissionDate: sub.finalizedAt
        ? new Date(sub.finalizedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : "Finalized",
      status: sub.screeningStatus || "Pending Review",
      screeningRemarks: sub.screeningRemarks || "",
      rejectionReason: sub.rejectionReason || "",
      checks: sub.checks || {
        gitFreshness: true,
        endpointsLive: true,
        envConfigured: true,
        licenseMIT: true
      },
      flags: sub.flags || []
    }));
  };

  const [submissions, setSubmissions] = useState(loadSubmissions);
  const [refreshKey, setRefreshKey] = useState(0);

  const allHackathons = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getStoredHackathons();
  }, [refreshKey]);

  const assignedIds = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getUserAssignedHackathonIds(user);
  }, [user, refreshKey]);

  const assignedHackathons = useMemo(() => {
    const list = allHackathons.filter((h) => assignedIds.includes(h.id));
    return list.length > 0 ? list : allHackathons.slice(0, 1);
  }, [allHackathons, assignedIds]);

  const [filterHackathon, setFilterHackathon] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  // Access Code Modal & State
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [codeNotice, setCodeNotice] = useState(null);

  const handleRedeemCode = (e) => {
    e.preventDefault();
    if (!accessCodeInput.trim()) return;
    const res = redeemAccessCode(accessCodeInput, user);
    if (res.success) {
      setCodeNotice({ type: 'success', text: res.message });
      setFilterHackathon(res.hackathonId);
      setAccessCodeInput("");
      setShowCodeModal(false);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setCodeNotice(null), 4500);
    } else {
      setCodeNotice({ type: 'error', text: res.error });
      setTimeout(() => setCodeNotice(null), 4500);
    }
  };

  // Active remarks editing
  const [remarksState, setRemarksState] = useState({});

  // Reject Modal State
  const [rejectModalTarget, setRejectModalTarget] = useState(null);
  const [rejectionReasonSelect, setRejectionReasonSelect] = useState("Pre-dated private commits before kickoff window");
  const [rejectionCustomText, setRejectionCustomText] = useState("");

  const handleRemarkChange = (id, text) => {
    setRemarksState((prev) => ({ ...prev, [id]: text }));
  };

  const handleDecision = (id, newStatus, remarks = "", rejectionReason = "") => {
    const target = submissions.find((s) => s.id === id);
    if (!target) return;

    const finalRemarks = remarks !== "" ? remarks : (remarksState[id] !== undefined ? remarksState[id] : target.screeningRemarks);

    const res = updateScreeningDecision({
      submissionId: id,
      status: newStatus,
      remarks: finalRemarks,
      rejectionReason: newStatus === "Rejected" ? rejectionReason : "",
      checks: target.checks,
      flags: target.flags,
      reviewer: user?.fullName || "Screening Committee"
    });

    if (res.success) {
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: newStatus,
                screeningRemarks: finalRemarks,
                rejectionReason: newStatus === "Rejected" ? rejectionReason : ""
              }
            : s
        )
      );

      setFeedbackNotice({
        type: newStatus === "Shortlisted" ? "success" : newStatus === "Rejected" ? "error" : "info",
        text: `✓ Decision recorded: "${target.teamName}" set to ${newStatus}. Synced with team & judge views.`
      });
      setTimeout(() => setFeedbackNotice(null), 4000);
    }
  };

  const toggleCheck = (id, checkKey) => {
    const target = submissions.find((s) => s.id === id);
    if (!target) return;

    const nextChecks = { ...target.checks, [checkKey]: !target.checks[checkKey] };

    updateScreeningDecision({
      submissionId: id,
      status: target.status,
      remarks: target.screeningRemarks,
      rejectionReason: target.rejectionReason,
      checks: nextChecks,
      flags: target.flags,
      reviewer: user?.fullName || "Screening Committee"
    });

    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checks: nextChecks } : s))
    );
  };

  const openRejectModal = (sub) => {
    setRejectModalTarget(sub);
    setRejectionReasonSelect("Pre-dated private commits before kickoff window");
    setRejectionCustomText("");
  };

  const confirmRejection = () => {
    if (!rejectModalTarget) return;
    const finalReason = rejectionReasonSelect === "Other" && rejectionCustomText.trim()
      ? rejectionCustomText.trim()
      : rejectionReasonSelect;

    handleDecision(rejectModalTarget.id, "Rejected", remarksState[rejectModalTarget.id] || rejectModalTarget.screeningRemarks, finalReason);
    setRejectModalTarget(null);
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
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm">
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
              Verify compliance rules and add remarks before forwarding entries to judges.
            </span>
          </div>

          {feedbackNotice && (
            <div className={`p-3 rounded-lg text-xs mb-3 ${
              feedbackNotice.type === "success"
                ? "bg-emerald-950/50 border border-emerald-500/40 text-emerald-300"
                : feedbackNotice.type === "error"
                ? "bg-rose-950/50 border border-rose-800/50 text-rose-300"
                : "bg-sky-950/50 border border-sky-800/50 text-sky-300"
            }`}>
              {feedbackNotice.text}
            </div>
          )}

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#253247]">
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">FINALIZED ENTRIES</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{total}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-amber-400 font-mono uppercase block">PENDING REVIEW</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">{pendingCount}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-emerald-400 font-mono uppercase block">SHORTLISTED</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{shortlistedCount}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-rose-400 font-mono uppercase block">REJECTED</span>
              <span className="text-lg font-bold text-rose-400 mt-0.5 block">{rejectedCount}</span>
            </div>
          </div>
        </section>

        {/* Role Explanation Banner */}
        <section className="bg-[#080e1a] border border-amber-500/20 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-lg">🛡️</span>
            <div>
              <span className="font-bold text-amber-400">Screening Committee (Gatekeeper):</span>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                You review <strong>all raw submissions</strong> right after the deadline. Verify commit freshness, live URL health, and documentation to mark entries as <strong>Shortlisted ✓</strong> (which sends them to Judges) or <strong>Rejected ✗</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCodeModal(true)}
            className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>🔑</span> Enter Screening Access Code
          </button>
        </section>

        {codeNotice && (
          <div className={`p-3 rounded-lg text-xs font-medium border ${
            codeNotice.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}>
            {codeNotice.text}
          </div>
        )}

        {/* 2. FILTER & QUEUE HEADER */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[11px]">ACTIVE HACKATHON:</span>
              <select
                value={filterHackathon}
                onChange={(e) => setFilterHackathon(e.target.value)}
                className="bg-[#080e1a] border border-[#223044] text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="all">All Assigned Competitions ({assignedHackathons.length})</option>
                {assignedHackathons.map((h) => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#080e1a] border border-[#223044] text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
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
          {filtered.length === 0 ? (
            <div className="bg-[#0d1526] border border-[#253247] rounded-xl p-10 text-center text-slate-400 text-xs">
              No submissions match the selected filters.
            </div>
          ) : (
            filtered.map((sub) => {
              const isShortlisted = sub.status === "Shortlisted";
              const isRejected = sub.status === "Rejected";
              const activeRemarks = remarksState[sub.id] !== undefined ? remarksState[sub.id] : sub.screeningRemarks;

              return (
                <section
                  key={sub.id}
                  className={`bg-[#0d1526] border rounded-xl overflow-hidden shadow-sm transition-colors ${
                    isShortlisted
                      ? "border-emerald-500/50"
                      : isRejected
                      ? "border-rose-800/50"
                      : "border-[#253247]"
                  }`}
                >
                  {/* Card Header: Project Details & Current Status */}
                  <div className="px-5 py-4 border-b border-[#253247] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121c32]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white">{sub.teamName}</h2>
                        <span className="text-xs text-slate-400 font-mono">• Lead: {sub.lead}</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-sm font-semibold text-emerald-400 font-mono">
                          {sub.projectTitle}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Hackathon: <span className="text-slate-300 font-medium">{sub.hackathonTitle}</span> • Track: <span className="text-slate-300">{sub.track}</span>
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isShortlisted
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                          : isRejected
                          ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                          : "bg-amber-950/70 text-amber-300 border border-amber-500/40"
                      }`}>
                        {sub.status}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Date: {sub.submissionDate}
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Links & Compliance Checklist */}
                  <div className="p-5 space-y-4">
                    {/* Project Description */}
                    {sub.projectDescription && (
                      <p className="text-xs text-slate-300 leading-relaxed bg-[#080e1a] p-3 rounded-lg border border-[#1c283c]">
                        {sub.projectDescription}
                      </p>
                    )}

                    {/* Links Row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <a
                        href={sub.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#080e1a] border border-[#223044] hover:border-[#354866] text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Icons.ExternalLink />
                        <span>Inspect Repository</span>
                      </a>
                      <a
                        href={sub.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#080e1a] border border-[#223044] hover:border-[#354866] text-emerald-400 inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Icons.ExternalLink />
                        <span>Live Deployment</span>
                      </a>

                      {sub.submissionFiles && sub.submissionFiles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                          {sub.submissionFiles.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              className="px-2 py-1 rounded bg-[#080e1a] border border-[#1c283c] text-[10px] text-slate-300 font-mono inline-flex items-center gap-1"
                            >
                              <span className="text-emerald-400 font-bold">PDF</span>
                              <span>{f.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 4 Compliance Gate Toggles */}
                    <div className="p-3.5 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-2">
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

                      {sub.rejectionReason && (
                        <div className="pt-2 text-[11px] text-rose-300 font-mono bg-rose-950/40 p-2 rounded border border-rose-900/50">
                          <strong>Rejection Reason:</strong> {sub.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Screening Remarks Input */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
                        Screening Remarks & Evaluator Notes
                      </label>
                      <input
                        type="text"
                        value={activeRemarks}
                        onChange={(e) => handleRemarkChange(sub.id, e.target.value)}
                        placeholder="e.g. Clean commit tree verified; endpoints respond under 200ms latency ceiling."
                        className="w-full bg-[#080e1a] border border-[#223044] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* 4. DECISION ACTION ROW */}
                    <div className="pt-3 border-t border-[#1c283c] flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Committee Decision:
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecision(sub.id, "Shortlisted", activeRemarks)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
                        >
                          ✓ Shortlist Team
                        </button>

                        <button
                          onClick={() => openRejectModal(sub)}
                          className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-semibold rounded-lg transition-colors"
                        >
                          ✕ Reject Entry
                        </button>

                        <button
                          onClick={() => handleDecision(sub.id, "Under Review", activeRemarks)}
                          className="px-2.5 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 text-xs rounded-lg transition-colors"
                        >
                          Under Review
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* REJECTION REASON MODAL */}
        {rejectModalTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060a12]/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#0d1526] border border-[#253247] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Icons.AlertCircle />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Reject Submission: {rejectModalTarget.teamName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Select the non-compliance reason for rejecting this project.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Rejection Category *</label>
                  <select
                    value={rejectionReasonSelect}
                    onChange={(e) => setRejectionReasonSelect(e.target.value)}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="Pre-dated private commits before kickoff window">Pre-dated commits before kickoff window</option>
                    <option value="Missing working live deployment endpoint">Missing working live deployment endpoint (5xx or offline)</option>
                    <option value="Incomplete repository or missing .env.example">Incomplete repository or missing .env.example</option>
                    <option value="Non-permissive or missing open source license">Non-permissive or missing open source license</option>
                    <option value="Rule violation or plagiarism detection">Rule violation or plagiarism detection</option>
                    <option value="Other">Other (Custom explanation)</option>
                  </select>
                </div>

                {rejectionReasonSelect === "Other" && (
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Specific Reason Details *</label>
                    <textarea
                      rows={2}
                      value={rejectionCustomText}
                      onChange={(e) => setRejectionCustomText(e.target.value)}
                      placeholder="Explain the compliance failure..."
                      className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalTarget(null)}
                  className="flex-1 py-2 px-3 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRejection}
                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Enter Screening Access Code */}
        {showCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="bg-[#0d1526] border border-[#253247] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔑</span>
                  <h3 className="text-sm font-bold text-white">Enter Screening Access Code</h3>
                </div>
                <button
                  onClick={() => setShowCodeModal(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Hackathon organizers create unique screening access codes (e.g. <span className="font-mono text-amber-400">SCREEN-DEVPULSE-3M2P</span>). Enter your assigned code once to unlock and review submissions for that hackathon.
              </p>

              <form onSubmit={handleRedeemCode} className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1 uppercase font-semibold">
                    ACCESS CODE
                  </label>
                  <input
                    type="text"
                    required
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. SCREEN-DEVPULSE-3M2P"
                    className="w-full bg-[#080e1a] border border-[#253247] rounded-lg p-3 text-sm font-mono font-bold text-amber-400 placeholder-slate-600 focus:outline-none focus:border-amber-500 tracking-wider uppercase"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#253247]">
                  <button
                    type="button"
                    onClick={() => setShowCodeModal(false)}
                    className="px-4 py-2 bg-[#121c32] hover:bg-[#1a2744] text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
                  >
                    Verify & Unlock Hackathon
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
