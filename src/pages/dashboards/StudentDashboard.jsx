import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { Icons } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { getStoredHackathons } from '../../utils/hackathonService';
import { getUserRegistrations, registerForHackathon } from '../../utils/registrationService';
import {
  getUserTeamForHackathon,
  createTeam,
  joinTeamWithCode,
  lockTeamRoster,
  unlockTeamRoster,
  removeTeamMember
} from '../../utils/teamService';
import {
  getSubmissionByTeamAndHackathon,
  saveDraftSubmission,
  finalizeSubmission,
  createS3FileMetadata,
  isUserTeamLeader
} from '../../utils/submissionService';
import { getTeamEvaluation, isResultsPublished } from '../../utils/evaluationService';
import { getUserCertificates } from '../../utils/certificateService';
import { getUserNotifications, markAsRead, markAllAsRead } from '../../utils/notificationService';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function StudentDashboard({ initialTab = "workspace" }) {
  const { user } = useAuth();
  const userEmail = user?.email || "";

  // Active dashboard tab
  const [activeTab, setActiveTab] = useState(initialTab);

  // Invite code copy feedback
  const [copied, setCopied] = useState(false);

  // State refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Notifications
  const notifications = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    return getUserNotifications(userEmail);
  }, [userEmail, refreshKey]);
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  // Certificates
  const certificates = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    return getUserCertificates(userEmail);
  }, [userEmail, refreshKey]);

  // All hackathons from service
  const allHackathons = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    return getStoredHackathons();
  }, [refreshKey]);

  // Registrations
  const registrations = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    return getUserRegistrations(userEmail);
  }, [userEmail, refreshKey]);

  const [selectedHackathonId, setSelectedHackathonId] = useState(null);

  // New team formation state
  const [newTeamName, setNewTeamName] = useState("");
  const [teamActionFeedback, setTeamActionFeedback] = useState(null);

  // Join team state
  const [joinCode, setJoinCode] = useState("");

  // Combine user registration records with hackathons metadata
  const registeredHackathons = registrations.map((reg) => {
    const meta = allHackathons.find((h) => h.id === reg.hackathonId) || {
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

  // Team-based submission resolution
  const teamSubmission = (currentTeam && activeSprint)
    ? getSubmissionByTeamAndHackathon(currentTeam.code, activeSprint.id)
    : null;

  const isLeader = Boolean(currentTeam && user && isUserTeamLeader(currentTeam, user));
  const isFinalized = teamSubmission?.status === "finalized";

  // Evaluation & Results resolution
  const teamEvaluation = (currentTeam && activeSprint)
    ? getTeamEvaluation(currentTeam.code, activeSprint.id)
    : null;
  const resultsReleased = activeSprint ? isResultsPublished(activeSprint.id) : false;

  // Form state tracking
  const currentSubmissionKey = `${activeSprint?.id || ''}_${currentTeam?.code || ''}_${refreshKey}`;
  const [formOverride, setFormOverride] = useState({
    key: "",
    projectTitle: "",
    projectDescription: "",
    repositoryUrl: "",
    liveDemoUrl: "",
    submissionFiles: []
  });

  const formValues = formOverride.key === currentSubmissionKey
    ? formOverride
    : {
        key: currentSubmissionKey,
        projectTitle: teamSubmission?.projectTitle || "",
        projectDescription: teamSubmission?.projectDescription || "",
        repositoryUrl: teamSubmission?.repositoryUrl || "",
        liveDemoUrl: teamSubmission?.liveDemoUrl || "",
        submissionFiles: teamSubmission?.submissionFiles || []
      };

  const updateFormField = (field, value) => {
    setFormOverride({
      ...formValues,
      key: currentSubmissionKey,
      [field]: value
    });
  };

  const [submissionNotice, setSubmissionNotice] = useState(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [selectedFileCategory, setSelectedFileCategory] = useState("System Documentation");
  const fileInputRef = useRef(null);

  // Certificate modal preview
  const [previewCert, setPreviewCert] = useState(null);

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
        text: `✓ Created team "${res.team.name}"! Unique Invite Code: ${res.team.code}`
      });
      setIsCreatingTeam(false);
      setNewTeamName("");
      setRefreshKey((k) => k + 1);
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
      setRefreshKey((k) => k + 1);
    } else {
      setTeamActionFeedback({
        type: "error",
        text: res.error
      });
    }
    setTimeout(() => setTeamActionFeedback(null), 5000);
  };

  const handleToggleRosterLock = () => {
    if (!currentTeam || !user || !isLeader) return;

    if (currentTeam.rosterLocked) {
      const res = unlockTeamRoster(currentTeam.code, user);
      if (res.success) {
        setTeamActionFeedback({ type: "success", text: "✓ Team roster unlocked. Teammates can now join." });
        setRefreshKey((k) => k + 1);
      }
    } else {
      const res = lockTeamRoster(currentTeam.code, user);
      if (res.success) {
        setTeamActionFeedback({ type: "success", text: "✓ Team roster locked! No further members may join." });
        setRefreshKey((k) => k + 1);
      }
    }
    setTimeout(() => setTeamActionFeedback(null), 4000);
  };

  const handleRemoveMember = (memberEmail) => {
    if (!currentTeam || !user || !isLeader) return;
    if (window.confirm(`Are you sure you want to remove ${memberEmail} from the roster?`)) {
      const res = removeTeamMember(currentTeam.code, memberEmail, user);
      if (res.success) {
        setTeamActionFeedback({ type: "success", text: `✓ Member removed from roster.` });
        setRefreshKey((k) => k + 1);
      } else {
        setTeamActionFeedback({ type: "error", text: res.error });
      }
      setTimeout(() => setTeamActionFeedback(null), 4000);
    }
  };

  const handleRegisterDirect = (hackathonId, title) => {
    const res = registerForHackathon(userEmail, hackathonId);
    if (res.success) {
      setSubmissionNotice({ type: "success", text: `✓ Successfully registered for ${title}!` });
      setSelectedHackathonId(hackathonId);
      setRefreshKey((k) => k + 1);
    } else {
      setSubmissionNotice({ type: "info", text: res.error || "Already registered." });
    }
    setTimeout(() => setSubmissionNotice(null), 4000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileMeta = createS3FileMetadata(file, selectedFileCategory);
    const updatedFiles = [...formValues.submissionFiles, fileMeta];
    updateFormField("submissionFiles", updatedFiles);

    setSubmissionNotice({
      type: "info",
      text: `✓ Staged "${file.name}" ready for AWS S3 upload (${formatBytes(file.size)})`
    });
    setTimeout(() => setSubmissionNotice(null), 4000);
    e.target.value = "";
  };

  const handleAddSampleFile = (name, category, size) => {
    const mockFile = { name, size, type: "application/pdf" };
    const fileMeta = createS3FileMetadata(mockFile, category);
    const updatedFiles = [...formValues.submissionFiles, fileMeta];
    updateFormField("submissionFiles", updatedFiles);

    setSubmissionNotice({
      type: "info",
      text: `✓ Staged "${name}" (${category}) ready for AWS S3.`
    });
    setTimeout(() => setSubmissionNotice(null), 4000);
  };

  const handleRemoveFile = (fileId) => {
    const updatedFiles = formValues.submissionFiles.filter((f) => f.id !== fileId);
    updateFormField("submissionFiles", updatedFiles);
  };

  const handleSaveSubmission = (e) => {
    e.preventDefault();
    if (!currentTeam || !activeSprint || !user) return;

    if (!isLeader) {
      setSubmissionNotice({
        type: "error",
        text: `Read-only access. Only the Team Leader (${currentTeam.lead || "Leader"}) can save or edit deliverables.`
      });
      setTimeout(() => setSubmissionNotice(null), 4500);
      return;
    }

    const res = saveDraftSubmission({
      teamId: currentTeam.code,
      hackathonId: activeSprint.id,
      hackathonTitle: activeSprint.title,
      track: activeSprint.track,
      user,
      projectTitle: formValues.projectTitle,
      projectDescription: formValues.projectDescription,
      repositoryUrl: formValues.repositoryUrl,
      liveDemoUrl: formValues.liveDemoUrl,
      submissionFiles: formValues.submissionFiles
    });

    if (res.success) {
      setSubmissionNotice({
        type: "success",
        text: "✓ Submission draft saved. You can continue editing before final freeze."
      });
      setRefreshKey((k) => k + 1);
    } else {
      setSubmissionNotice({
        type: "error",
        text: res.error || "Failed to save draft."
      });
    }
    setTimeout(() => setSubmissionNotice(null), 4500);
  };

  const handleOpenFinalizeModal = () => {
    if (!isLeader) {
      setSubmissionNotice({
        type: "error",
        text: `Only the Team Leader (${currentTeam?.lead || "Leader"}) can finalize the project submission.`
      });
      setTimeout(() => setSubmissionNotice(null), 4500);
      return;
    }
    if (!formValues.projectTitle.trim()) {
      setSubmissionNotice({
        type: "error",
        text: "Please provide a Project Title before finalizing."
      });
      setTimeout(() => setSubmissionNotice(null), 4500);
      return;
    }
    if (!formValues.repositoryUrl.trim()) {
      setSubmissionNotice({
        type: "error",
        text: "Please provide a valid Repository URL before finalizing."
      });
      setTimeout(() => setSubmissionNotice(null), 4500);
      return;
    }
    setShowFinalizeModal(true);
  };

  const handleConfirmFinalize = () => {
    saveDraftSubmission({
      teamId: currentTeam.code,
      hackathonId: activeSprint.id,
      hackathonTitle: activeSprint.title,
      track: activeSprint.track,
      user,
      projectTitle: formValues.projectTitle,
      projectDescription: formValues.projectDescription,
      repositoryUrl: formValues.repositoryUrl,
      liveDemoUrl: formValues.liveDemoUrl,
      submissionFiles: formValues.submissionFiles
    });

    const res = finalizeSubmission({
      teamId: currentTeam.code,
      hackathonId: activeSprint.id,
      user
    });

    setShowFinalizeModal(false);

    if (res.success) {
      setSubmissionNotice({
        type: "success",
        text: "✓ Submission frozen & finalized! Deliverables are locked and forwarded to the Screening Committee queue."
      });
      setRefreshKey((k) => k + 1);
    } else {
      setSubmissionNotice({
        type: "error",
        text: res.error || "Failed to finalize submission."
      });
    }
    setTimeout(() => setSubmissionNotice(null), 6000);
  };

  return (
    <DashboardLayout
      portalTitle={isLeader ? "Team Leader Portal" : "Student Participant Portal"}
      roleBadgeText={isLeader ? "TEAM LEADER" : "STUDENT PARTICIPANT"}
    >
      <div className="space-y-6">

        {/* 1. COMPACT HEADER */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  {isLeader ? "TEAM LEADER CHAMBER" : "PARTICIPANT DASHBOARD"}
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
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-slate-400 bg-[#080e1a] px-3.5 py-2 rounded-lg border border-[#1c283c]">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Sprints:</span>
                <span className="text-white font-medium">{registeredHackathons.length}</span>
              </div>
              <span className="text-slate-700 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Squad:</span>
                <span className="text-emerald-400 font-medium">
                  {currentTeam ? currentTeam.name : "No Team Yet"}
                </span>
              </div>
              <span className="text-slate-700 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Role:</span>
                <span className={isLeader ? "text-emerald-400 font-bold" : "text-slate-300"}>
                  {isLeader ? "Team Leader" : "Member"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. NAVIGATION TAB PILLS */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#253247] pb-3">
          <button
            onClick={() => setActiveTab("workspace")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "workspace"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "bg-[#0d1526] border border-[#253247] text-slate-300 hover:text-white hover:border-slate-500"
            }`}
          >
            <span>🚀 Project Submission</span>
            {isFinalized && <span className="w-2 h-2 rounded-full bg-rose-400"></span>}
          </button>

          <button
            onClick={() => setActiveTab("roster")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "roster"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "bg-[#0d1526] border border-[#253247] text-slate-300 hover:text-white hover:border-slate-500"
            }`}
          >
            <span>👥 Squad & Roster</span>
            {currentTeam && <span className="font-mono text-[10px] opacity-80">({currentTeam.capacity})</span>}
          </button>

          <button
            onClick={() => setActiveTab("results")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "results"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "bg-[#0d1526] border border-[#253247] text-slate-300 hover:text-white hover:border-slate-500"
            }`}
          >
            <span>📊 Screening & Judging</span>
            {teamSubmission?.screeningStatus && (
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                teamSubmission.screeningStatus === "Shortlisted" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40" : "bg-slate-800 text-slate-400"
              }`}>
                {teamSubmission.screeningStatus}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("certificates")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "certificates"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "bg-[#0d1526] border border-[#253247] text-slate-300 hover:text-white hover:border-slate-500"
            }`}
          >
            <span>🎓 Certificates</span>
            {certificates.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-bold text-[10px]">
                {certificates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "notifications"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "bg-[#0d1526] border border-[#253247] text-slate-300 hover:text-white hover:border-slate-500"
            }`}
          >
            <span>🔔 Notifications</span>
            {unreadNotifsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white font-bold text-[10px]">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("discover")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "discover"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "bg-[#0d1526] border border-[#253247] text-slate-300 hover:text-white hover:border-slate-500"
            }`}
          >
            <span>🌐 Discover Sprints</span>
          </button>
        </div>

        {/* Multi-Hackathon View Switcher */}
        {registeredHackathons.length > 1 && (
          <div className="flex items-center gap-2 p-2.5 bg-[#0d1526] border border-[#253247] rounded-xl overflow-x-auto text-xs shadow-sm">
            <span className="text-slate-400 font-mono text-[11px] px-2 shrink-0">Selected Sprint Context:</span>
            {registeredHackathons.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHackathonId(h.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                  activeSprint?.id === h.id
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "bg-[#080e1a] text-slate-300 hover:text-white border border-[#1c283c]"
                }`}
              >
                {h.title}
              </button>
            ))}
          </div>
        )}

        {/* Global Feedback Notice */}
        {submissionNotice && (
          <div
            className={`p-3 rounded-lg text-xs leading-relaxed ${
              submissionNotice.type === "success"
                ? "bg-emerald-950/40 border border-emerald-800/50 text-emerald-300"
                : submissionNotice.type === "info"
                ? "bg-sky-950/40 border border-sky-800/50 text-sky-300"
                : "bg-rose-950/40 border border-rose-800/50 text-rose-300"
            }`}
          >
            {submissionNotice.text}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: WORKSPACE & PROJECT SUBMISSION */}
        {/* ========================================================= */}
        {activeTab === "workspace" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Col (7 cols): Primary Submission Workspace */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-[#253247] flex items-center justify-between bg-[#121c32]">
                  <div>
                    <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      PROJECT SUBMISSION
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {activeSprint
                        ? `Deliverables for ${activeSprint.title}${currentTeam ? ` • Squad: ${currentTeam.name}` : ''}`
                        : "Select a sprint to submit"}
                    </p>
                  </div>
                  {currentTeam && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isFinalized
                          ? "bg-rose-950/80 border border-rose-500/50 text-rose-300"
                          : "bg-amber-950/70 border border-amber-500/50 text-amber-300"
                      }`}
                    >
                      {isFinalized ? "SUBMITTED — LOCKED" : "DRAFT — NOT SUBMITTED"}
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-5">
                  {!activeSprint ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Please select or register for a hackathon to manage project deliverables.
                    </div>
                  ) : !currentTeam ? (
                    <div className="py-6 px-4 bg-[#080e1a] border border-dashed border-[#253247] rounded-xl space-y-2 text-center">
                      <span className="text-xs font-bold text-amber-300 font-mono block uppercase">
                        Squad Required for Project Submission
                      </span>
                      <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                        Deliverables belong to a team. Create a new squad or enter an invite code in the Squad & Roster tab.
                      </p>
                      <button
                        onClick={() => setActiveTab("roster")}
                        className="mt-2 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors inline-block"
                      >
                        Go to Squad Management →
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Context Status Banner */}
                      {isFinalized ? (
                        <div className="px-3.5 py-2.5 bg-emerald-950/30 border-l-2 border-emerald-500 rounded-r-lg flex items-center justify-between text-xs text-emerald-300">
                          <div className="flex items-center gap-2">
                            <span>🔒</span>
                            <span>Deliverables finalized and locked for Screening Committee review.</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {teamSubmission?.finalizedAt ? new Date(teamSubmission.finalizedAt).toLocaleDateString() : 'Locked'}
                          </span>
                        </div>
                      ) : !isLeader ? (
                        <div className="px-3.5 py-2.5 bg-amber-950/20 border-l-2 border-amber-500 rounded-r-lg text-xs text-amber-300">
                          ℹ️ You are a squad member. Only Team Leader <span className="font-bold">{currentTeam.lead}</span> can edit and freeze deliverables.
                        </div>
                      ) : null}

                      <form onSubmit={handleSaveSubmission} className="space-y-4 text-xs">
                        {/* Title */}
                        <div>
                          <label className="text-slate-300 font-semibold block mb-1">
                            Project Title *
                          </label>
                          <input
                            type="text"
                            disabled={isFinalized || !isLeader}
                            value={formValues.projectTitle}
                            onChange={(e) => updateFormField("projectTitle", e.target.value)}
                            placeholder="e.g. ResilientQueue Engine"
                            className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-slate-300 font-semibold block mb-1">
                            Elevator Pitch / Summary
                          </label>
                          <textarea
                            rows={3}
                            disabled={isFinalized || !isLeader}
                            value={formValues.projectDescription}
                            onChange={(e) => updateFormField("projectDescription", e.target.value)}
                            placeholder="Describe the problem, architectural highlights, and tech stack..."
                            className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* URL Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-300 font-semibold block mb-1">
                              Repository URL *
                            </label>
                            <input
                              type="url"
                              disabled={isFinalized || !isLeader}
                              value={formValues.repositoryUrl}
                              onChange={(e) => updateFormField("repositoryUrl", e.target.value)}
                              placeholder="https://github.com/org/repo"
                              className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="text-slate-300 font-semibold block mb-1">
                              Live Demo URL
                            </label>
                            <input
                              type="url"
                              disabled={isFinalized || !isLeader}
                              value={formValues.liveDemoUrl}
                              onChange={(e) => updateFormField("liveDemoUrl", e.target.value)}
                              placeholder="https://demo.app"
                              className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed font-mono text-[11px]"
                            />
                          </div>
                        </div>

                        {/* S3-Ready Upload Section */}
                        <div className="p-3.5 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-mono text-slate-300 font-semibold uppercase block">
                                Deliverable Documentation & Files (AWS S3-Ready)
                              </span>
                              <span className="text-[10px] text-slate-500">
                                System architecture PDFs, whitepapers, or pitch decks
                              </span>
                            </div>

                            {isLeader && !isFinalized && (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={selectedFileCategory}
                                  onChange={(e) => setSelectedFileCategory(e.target.value)}
                                  className="bg-[#121c32] border border-[#253247] rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none"
                                >
                                  <option value="System Documentation">System Documentation</option>
                                  <option value="Presentation / Pitch Deck">Pitch Deck</option>
                                  <option value="Architecture Diagram">Architecture</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleAddSampleFile("Architecture_Design_v2.pdf", selectedFileCategory, 1850000)}
                                  className="px-2 py-1 rounded bg-[#121c32] border border-[#253247] text-[10px] text-slate-300 hover:text-white"
                                >
                                  + Sample
                                </button>
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="px-2.5 py-1 bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded text-[10px] font-semibold hover:bg-emerald-900/60"
                                >
                                  Upload
                                </button>
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  onChange={handleFileUpload}
                                  className="hidden"
                                  accept=".pdf,.png,.jpg,.jpeg,.zip"
                                />
                              </div>
                            )}
                          </div>

                          {/* Staged Files List */}
                          <div className="space-y-1.5">
                            {formValues.submissionFiles && formValues.submissionFiles.length > 0 ? (
                              formValues.submissionFiles.map((file) => (
                                <div
                                  key={file.id}
                                  className="p-2 rounded bg-[#0d1526] border border-[#1c283c] flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-950">
                                      {file.category || "DOC"}
                                    </span>
                                    <span className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{formatBytes(file.size)}</span>
                                  </div>

                                  {isLeader && !isFinalized && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFile(file.id)}
                                      className="text-slate-500 hover:text-rose-400 text-xs px-1"
                                      title="Remove staged file"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500 block italic">
                                No files attached yet. Attach your pitch deck or architecture documentation.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Leader Submit Actions */}
                        {isLeader && (
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[11px] text-slate-500 font-mono">
                              Status: <span className="text-slate-300 font-semibold">{isFinalized ? "Locked" : "Draft"}</span>
                            </span>

                            {!isFinalized ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  className="px-3.5 py-2 bg-[#162238] hover:bg-[#1d2d4a] border border-[#253247] text-slate-200 font-semibold rounded-lg text-xs transition-colors"
                                >
                                  Save Draft
                                </button>
                                <button
                                  type="button"
                                  onClick={handleOpenFinalizeModal}
                                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-colors shadow"
                                >
                                  Freeze & Finalize Submission →
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-mono">
                                Submission certified & locked. Reopening requires admin request.
                              </span>
                            )}
                          </div>
                        )}
                      </form>
                    </>
                  )}
                </div>
              </section>
            </div>

            {/* Right Col (5 cols): Roster Snapshot & Deadlines */}
            <div className="lg:col-span-5 space-y-6">
              {/* Squad Snapshot Card */}
              <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                  <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">SQUAD SNAPSHOT</span>
                  {currentTeam && (
                    <span className="px-2 py-0.5 rounded bg-[#121c32] border border-[#253247] text-[10px] font-mono text-slate-300">{currentTeam.capacity}</span>
                  )}
                </div>

                {currentTeam ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1">
                      <span className="font-bold text-white text-sm">{currentTeam.name}</span>
                      <span className="text-slate-400">Leader: {currentTeam.lead}</span>
                    </div>

                    <div className="p-2.5 bg-[#080e1a] border border-[#1c283c] rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 block">INVITE CODE</span>
                        <span className="font-mono font-bold text-emerald-400">{currentTeam.code}</span>
                      </div>
                      <button
                        onClick={() => handleCopyCode(currentTeam.code)}
                        className="px-2.5 py-1 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] rounded text-[11px] text-slate-200"
                      >
                        {copied ? "✓ Copied" : "Copy Code"}
                      </button>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setActiveTab("roster")}
                        className="text-xs text-emerald-400 hover:underline font-mono"
                      >
                        Manage Full Roster & Permissions →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 space-y-2">
                    <p>No squad formed for {activeSprint?.title || "this sprint"}.</p>
                    <button
                      onClick={() => setActiveTab("roster")}
                      className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded text-xs"
                    >
                      Form or Join Squad
                    </button>
                  </div>
                )}
              </section>

              {/* Deadlines Card */}
              <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 space-y-3 shadow-sm">
                <div className="border-b border-[#253247] pb-3">
                  <span className="text-xs font-mono text-slate-300 uppercase font-semibold block">SPRINT TIMELINE</span>
                </div>
                <div className="space-y-3 text-xs">
                  {[
                    { label: "Team Roster Lock Window", time: "Oct 18, 2026 • 18:00 UTC", urgency: "high" },
                    { label: "Sprint Kickoff & Repo Push", time: "Oct 18, 2026 • 20:00 UTC", urgency: "normal" },
                    { label: "Final Code Freeze & Demo Link", time: "Oct 20, 2026 • 20:00 UTC", urgency: "critical" },
                    { label: "Screening Gate Clearance", time: "Oct 21, 2026 • 12:00 UTC", urgency: "normal" }
                  ].map((dl, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        dl.urgency === "critical"
                          ? "bg-rose-400 animate-pulse"
                          : dl.urgency === "high"
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`} />
                      <div className="flex-1">
                        <span className="text-slate-300 font-medium block leading-tight">{dl.label}</span>
                        <span className="text-[10px] font-mono text-slate-500">{dl.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SQUAD & ROSTER MANAGEMENT */}
        {/* ========================================================= */}
        {activeTab === "roster" && (
          <div className="space-y-6">
            {teamActionFeedback && (
              <div className={`p-3 rounded-lg text-xs ${
                teamActionFeedback.type === "success"
                  ? "bg-emerald-950/50 border border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/50 border border-rose-800/50 text-rose-300"
              }`}>
                {teamActionFeedback.text}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Squad Details & Roster (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-[#253247] flex items-center justify-between bg-[#121c32]">
                    <div>
                      <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        SQUAD ROSTER & TEAM MANAGEMENT
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {currentTeam ? `${currentTeam.name} (${activeSprint?.title})` : "No team assigned"}
                      </p>
                    </div>

                    {currentTeam && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        currentTeam.rosterLocked
                          ? "bg-rose-950 border border-rose-500/40 text-rose-300"
                          : "bg-emerald-950 border border-emerald-500/40 text-emerald-300"
                      }`}>
                        {currentTeam.rosterLocked ? "ROSTER LOCKED" : "OPEN FOR MEMBERS"}
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-5 text-xs">
                    {currentTeam ? (
                      <>
                        {/* Leader Banner */}
                        <div className="p-3.5 bg-[#080e1a] border border-[#1c283c] rounded-xl flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] text-slate-500 font-mono block">SHAREABLE INVITE CODE</span>
                            <span className="text-lg font-mono font-bold text-emerald-400 tracking-wider">
                              {currentTeam.code}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyCode(currentTeam.code)}
                              className="px-3 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-200 font-semibold rounded-lg text-xs"
                            >
                              {copied ? "✓ Copied" : "Copy Team Code"}
                            </button>

                            {isLeader && (
                              <button
                                onClick={handleToggleRosterLock}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                  currentTeam.rosterLocked
                                    ? "bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-200"
                                    : "bg-amber-950 hover:bg-amber-900 border border-amber-600/40 text-amber-300"
                                }`}
                              >
                                {currentTeam.rosterLocked ? "Unlock Roster" : "Lock Roster 🔒"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Members Table */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
                            ACTIVE MEMBERS ({currentTeam.capacity})
                          </span>

                          <div className="divide-y divide-[#1c283c] border border-[#1c283c] rounded-xl overflow-hidden bg-[#080e1a]">
                            {currentTeam.members?.map((m, idx) => {
                              const mName = typeof m === 'string' ? m : m.name;
                              const mEmail = typeof m === 'object' && m.email ? m.email : "";
                              const mRole = typeof m === 'object' && m.role ? m.role : (mName.includes('(Lead)') ? 'Team Leader' : 'Member');
                              const isThisMemberLead = mRole === "Team Leader" || mName.includes('(Lead)');

                              return (
                                <div key={idx} className="p-3.5 flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white text-xs">{mName}</span>
                                      {isThisMemberLead && (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono">
                                          LEAD
                                        </span>
                                      )}
                                    </div>
                                    {mEmail && <span className="text-[11px] text-slate-400 font-mono block mt-0.5">{mEmail}</span>}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#121c32] border border-[#253247] text-slate-300">
                                      Active
                                    </span>
                                    {isLeader && !isThisMemberLead && mEmail && (
                                      <button
                                        onClick={() => handleRemoveMember(mEmail)}
                                        className="text-slate-400 hover:text-rose-400 text-xs px-2 py-1 rounded bg-[#121c32] border border-[#253247]"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-slate-400 space-y-3">
                        <p>No squad formed for {activeSprint?.title}. Create a new team or enter an invite code to join an existing team.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Formation & Join Actions (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                {/* Create Team Card */}
                {!currentTeam && (
                  <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-3">
                    <div className="border-b border-[#253247] pb-3">
                      <span className="text-xs font-mono text-emerald-400 uppercase font-semibold block">CREATE A NEW SQUAD</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Found a team for <span className="text-slate-200">{activeSprint?.title}</span>. You will be assigned as Team Leader.
                    </p>

                    <form onSubmit={handleCreateTeamSubmit} className="space-y-3 text-xs">
                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Squad Name *</label>
                        <input
                          type="text"
                          required
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="e.g. ApexInnovators"
                          className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                      >
                        + Create Squad
                      </button>
                    </form>
                  </section>
                )}

                {/* Join with Invite Code Card */}
                <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-3">
                  <div className="border-b border-[#253247] pb-3">
                    <span className="text-xs font-mono text-slate-300 uppercase font-semibold block">JOIN VIA INVITE CODE</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Enter the unique 8-character invite code provided by your Team Leader.
                  </p>

                  <form onSubmit={handleJoinTeam} className="space-y-3 text-xs">
                    <div>
                      <input
                        type="text"
                        required
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="e.g. HT-DEV-42"
                        className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#162238] hover:bg-[#1d2d4a] border border-[#253247] text-slate-200 font-semibold rounded-lg text-xs transition-colors"
                    >
                      Join Squad
                    </button>
                  </form>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SCREENING & JUDGING RESULTS */}
        {/* ========================================================= */}
        {activeTab === "results" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Left Col: Screening Gate Status (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                    <div>
                      <span className="text-xs font-mono text-emerald-400 uppercase font-semibold block">STAGE 1: SCREENING GATEWAY</span>
                      <h3 className="text-sm font-bold text-white mt-0.5">Automated & Technical Compliance</h3>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      teamSubmission?.screeningStatus === "Shortlisted"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                        : teamSubmission?.screeningStatus === "Rejected"
                        ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                        : "bg-amber-950 text-amber-300 border border-amber-500/40"
                    }`}>
                      {teamSubmission?.screeningStatus || "Pending Review"}
                    </span>
                  </div>

                  {teamSubmission ? (
                    <div className="space-y-3 text-xs">
                      {/* Gate Verification Checks */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">COMPLIANCE CRITERIA</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`p-2.5 rounded border ${
                            teamSubmission.checks?.gitFreshness ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                          }`}>
                            <span className="font-semibold block">Git Freshness</span>
                            <span className="text-[10px] font-mono">{teamSubmission.checks?.gitFreshness ? "PASS ✓" : "FAIL ✕"}</span>
                          </div>

                          <div className={`p-2.5 rounded border ${
                            teamSubmission.checks?.endpointsLive ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                          }`}>
                            <span className="font-semibold block">HTTPS Endpoint Live</span>
                            <span className="text-[10px] font-mono">{teamSubmission.checks?.endpointsLive ? "PASS ✓" : "FAIL ✕"}</span>
                          </div>

                          <div className={`p-2.5 rounded border ${
                            teamSubmission.checks?.envConfigured ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                          }`}>
                            <span className="font-semibold block">.env.example Documentation</span>
                            <span className="text-[10px] font-mono">{teamSubmission.checks?.envConfigured ? "PASS ✓" : "FAIL ✕"}</span>
                          </div>

                          <div className={`p-2.5 rounded border ${
                            teamSubmission.checks?.licenseMIT ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                          }`}>
                            <span className="font-semibold block">Open Source License</span>
                            <span className="text-[10px] font-mono">{teamSubmission.checks?.licenseMIT ? "PASS ✓" : "FAIL ✕"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Committee Remarks */}
                      {teamSubmission.screeningRemarks && (
                        <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-1">
                          <span className="text-[10px] font-mono text-slate-500 uppercase block">REVIEWER REMARKS</span>
                          <p className="text-slate-300 leading-relaxed">{teamSubmission.screeningRemarks}</p>
                          {teamSubmission.screenedBy && (
                            <span className="text-[10px] text-slate-500 font-mono block mt-1">Reviewer: {teamSubmission.screenedBy}</span>
                          )}
                        </div>
                      )}

                      {/* Rejection notice */}
                      {teamSubmission.screeningStatus === "Rejected" && teamSubmission.rejectionReason && (
                        <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-lg text-rose-300 text-xs space-y-1">
                          <span className="font-bold block">Non-Compliance Notice:</span>
                          <p>{teamSubmission.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      Submit deliverables first to enter the screening gateway.
                    </div>
                  )}
                </section>
              </div>

              {/* Right Col: Rubric Judging & Certified Results (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                    <div>
                      <span className="text-xs font-mono text-emerald-400 uppercase font-semibold block">STAGE 2: RUBRIC EVALUATION</span>
                      <h3 className="text-sm font-bold text-white mt-0.5">Judge Panel Scorecard</h3>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      resultsReleased
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                        : "bg-[#121c32] border border-[#253247] text-slate-400"
                    }`}>
                      {resultsReleased ? "OFFICIALLY RELEASED" : "UNDER CONFIDENTIAL EVALUATION"}
                    </span>
                  </div>

                  {resultsReleased && teamEvaluation ? (
                    <div className="space-y-4 text-xs">
                      {/* Certified Total Score */}
                      <div className="p-4 bg-[#080e1a] border border-[#1c283c] rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase block">CERTIFIED TOTAL SCORE</span>
                          <span className="text-2xl font-extrabold font-mono text-emerald-400">
                            {teamEvaluation.totalScore} <span className="text-sm text-slate-500 font-normal">/ 100</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs">
                            Top Tier Finalist
                          </span>
                        </div>
                      </div>

                      {/* Rubric Breakdown */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">CRITERIA BREAKDOWN</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 bg-[#080e1a] border border-[#1c283c] rounded">
                            <span className="text-slate-400 block text-[11px]">Architecture</span>
                            <span className="font-mono text-emerald-400 font-bold text-sm">
                              {teamEvaluation.scores?.architecture || 0} / 30
                            </span>
                          </div>
                          <div className="p-2.5 bg-[#080e1a] border border-[#1c283c] rounded">
                            <span className="text-slate-400 block text-[11px]">Usability & UX</span>
                            <span className="font-mono text-emerald-400 font-bold text-sm">
                              {teamEvaluation.scores?.usability || 0} / 25
                            </span>
                          </div>
                          <div className="p-2.5 bg-[#080e1a] border border-[#1c283c] rounded">
                            <span className="text-slate-400 block text-[11px]">Innovation</span>
                            <span className="font-mono text-emerald-400 font-bold text-sm">
                              {teamEvaluation.scores?.innovation || 0} / 25
                            </span>
                          </div>
                          <div className="p-2.5 bg-[#080e1a] border border-[#1c283c] rounded">
                            <span className="text-slate-400 block text-[11px]">Completeness</span>
                            <span className="font-mono text-emerald-400 font-bold text-sm">
                              {teamEvaluation.scores?.completeness || 0} / 20
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Judge Feedback */}
                      {teamEvaluation.feedback && (
                        <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg space-y-1">
                          <span className="text-[10px] font-mono text-slate-500 uppercase block">JUDGE PANEL FEEDBACK</span>
                          <p className="text-slate-300 leading-relaxed italic">"{teamEvaluation.feedback}"</p>
                          <span className="text-[10px] text-slate-500 font-mono block mt-1">Evaluated by: {teamEvaluation.judgeName || "Expert Panel"}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 px-4 bg-[#080e1a] border border-dashed border-[#253247] rounded-xl text-center space-y-2 text-xs text-slate-400">
                      <span className="text-amber-400 block font-semibold">Judging & Scoring In Progress</span>
                      <p className="max-w-xs mx-auto leading-relaxed">
                        Evaluations are scored privately by assigned judges. Results and certificates will unlock here when officially certified by the Platform Administrator.
                      </p>
                    </div>
                  )}
                </section>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: CERTIFICATES */}
        {/* ========================================================= */}
        {activeTab === "certificates" && (
          <div className="space-y-6">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <div>
                  <span className="text-xs font-mono text-emerald-400 uppercase font-semibold block">VERIFIED CREDENTIALS</span>
                  <h3 className="text-base font-bold text-white mt-0.5">Issued Certificates of Excellence & Participation</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {certificates.length} Verified Document(s)
                </span>
              </div>

              {certificates.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 space-y-2">
                  <span className="text-slate-300 font-semibold block">No Certificates Available Yet</span>
                  <p className="max-w-md mx-auto">
                    Certificates are automatically generated upon official release of hackathon leaderboard results.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {certificates.map((cert) => (
                    <div
                      key={cert.certificateId}
                      className="p-5 bg-[#080e1a] border border-[#1c283c] rounded-xl space-y-3 relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px] font-mono font-bold block w-fit mb-1">
                            {cert.awardTitle || "Certificate of Excellence"}
                          </span>
                          <h4 className="text-sm font-bold text-white">{cert.hackathonTitle}</h4>
                          <span className="text-[11px] text-slate-400">Track: {cert.track}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{cert.issueDate}</span>
                      </div>

                      <div className="py-2 border-y border-[#1c283c] text-xs space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Recipient:</span>
                          <span className="text-slate-200 font-semibold">{cert.recipientName}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Squad:</span>
                          <span className="text-emerald-400 font-mono">{cert.teamName}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Certificate ID:</span>
                          <span className="text-slate-300 font-mono text-[11px]">{cert.certificateId}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[10px] font-mono text-emerald-400">✓ Cryptographically Verified</span>
                        <button
                          onClick={() => setPreviewCert(cert)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                        >
                          View Certificate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: NOTIFICATIONS & TIMELINES */}
        {/* ========================================================= */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <div>
                  <span className="text-xs font-mono text-emerald-400 uppercase font-semibold block">NOTIFICATION FEED</span>
                  <h3 className="text-base font-bold text-white mt-0.5">Platform Activity & Competition Updates</h3>
                </div>
                {unreadNotifsCount > 0 && (
                  <button
                    onClick={() => { markAllAsRead(userEmail); setRefreshKey((k) => k + 1); }}
                    className="text-xs text-emerald-400 hover:underline font-mono"
                  >
                    Mark All as Read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No notifications yet.
                </div>
              ) : (
                <div className="divide-y divide-[#1c283c]">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => { markAsRead(n.id); setRefreshKey((k) => k + 1); }}
                      className={`p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                        !n.read ? "bg-[#121c32]" : "hover:bg-[#0f172a]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          !n.read ? "bg-emerald-400" : "bg-slate-600"
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{n.title}</span>
                            <span className="text-[10px] font-mono text-slate-500">{n.date}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      </div>

                      {!n.read && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: DISCOVER HACKATHONS */}
        {/* ========================================================= */}
        {activeTab === "discover" && (
          <div className="space-y-6">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <div>
                  <span className="text-xs font-mono text-emerald-400 uppercase font-semibold block">SPRINT DIRECTORY</span>
                  <h3 className="text-base font-bold text-white mt-0.5">Explore Active & Upcoming Competitions</h3>
                </div>
                <Link to="/hackathons" className="text-xs text-emerald-400 hover:underline font-mono">
                  Browse All Public Pages →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allHackathons.map((h) => {
                  const isReg = registrations.some((r) => r.hackathonId === h.id);

                  return (
                    <div
                      key={h.id}
                      className="p-5 bg-[#080e1a] border border-[#1c283c] rounded-xl flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded bg-[#121c32] border border-[#253247] text-[10px] font-mono text-slate-300">{h.stage}</span>
                          <span className="text-xs font-mono text-emerald-400 font-bold">{h.prizePool}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white">{h.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{h.summary}</p>
                      </div>

                      <div className="pt-2 border-t border-[#1c283c] flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-slate-500">Deadline: {h.deadline}</span>

                        {isReg ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold">
                            ✓ Enrolled
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRegisterDirect(h.id, h.title)}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs transition-colors"
                          >
                            Register
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

      </div>

      {/* MODAL: FREEZE & FINALIZE CONFIRMATION */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060a12]/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0d1526] border border-[#253247] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Icons.AlertCircle />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Freeze & Finalize Project Submission
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Once finalized, your submission cannot be edited. Continue?
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                <span>COMPETITION</span>
                <span className="text-slate-200 font-medium truncate max-w-[200px]">{activeSprint?.title}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                <span>SQUAD</span>
                <span className="text-emerald-400 font-bold">{currentTeam?.name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                <span>PROJECT TITLE</span>
                <span className="text-slate-200 truncate max-w-[200px]">{formValues.projectTitle}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                <span>DELIVERABLE FILES</span>
                <span className="text-slate-200 font-mono">{formValues.submissionFiles?.length || 0} file(s) attached</span>
              </div>
            </div>

            <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-lg text-[11px] text-rose-300 leading-normal">
              <strong>Warning:</strong> This action is irreversible. All links and uploaded documentation will be locked and immediately forwarded to the Screening Committee review board.
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 py-2 px-3 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Yes, Finalize & Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIGITAL CERTIFICATE VIEWER */}
      {previewCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060a12]/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0d1526] border border-[#253247] rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative space-y-6">
            <button
              onClick={() => setPreviewCert(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs"
            >
              ✕ Close
            </button>

            {/* Certificate Canvas Mock */}
            <div className="border-4 border-double border-amber-500/40 p-8 rounded-xl bg-[#080e1a] text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <Icons.Terminal />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-mono tracking-widest text-amber-400 uppercase">
                  HACKTRACK CERTIFICATE OF ACCOMPLISHMENT
                </span>
                <h2 className="text-2xl font-bold text-white tracking-tight">{previewCert.awardTitle}</h2>
              </div>

              <p className="text-xs text-slate-400">This official credential certifies that</p>

              <h3 className="text-xl font-bold text-emerald-400 tracking-wide font-mono">
                {previewCert.recipientName}
              </h3>

              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                has successfully competed with squad <strong className="text-white">{previewCert.teamName}</strong> in the{" "}
                <strong className="text-white">{previewCert.hackathonTitle}</strong> ({previewCert.track}) submitting project <strong className="text-white">"{previewCert.projectTitle}"</strong>.
              </p>

              <div className="pt-4 border-t border-[#1c283c] flex flex-wrap items-center justify-between gap-4 text-left text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">ISSUANCE DATE</span>
                  <span className="text-slate-300">{previewCert.issueDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">CERTIFICATE ID</span>
                  <span className="text-emerald-400">{previewCert.certificateId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">VERIFICATION SIGNATURE</span>
                  <span className="text-slate-300">{previewCert.signedBy}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs"
              >
                Print / Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
