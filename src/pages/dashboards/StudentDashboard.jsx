import React, { useState, useMemo, useRef } from 'react';
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
import {
  getSubmissionByTeamAndHackathon,
  saveDraftSubmission,
  finalizeSubmission,
  createS3FileMetadata,
  isUserTeamLeader
} from '../../utils/submissionService';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

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

  // Real team-based submission resolution
  const teamSubmission = (currentTeam && activeSprint)
    ? getSubmissionByTeamAndHackathon(currentTeam.code, activeSprint.id)
    : null;

  const isLeader = Boolean(currentTeam && user && isUserTeamLeader(currentTeam, user));
  const isFinalized = teamSubmission?.status === "finalized";

  // Form state tracking per hackathon/team
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

  // Submission notifications and file upload handling
  const [submissionNotice, setSubmissionNotice] = useState(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [selectedFileCategory, setSelectedFileCategory] = useState("System Documentation");
  const fileInputRef = useRef(null);

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
      setRefreshKey(k => k + 1);
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
    // 1. Ensure current form fields are saved first
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

    // 2. Finalize submission irreversibly
    const res = finalizeSubmission({
      teamId: currentTeam.code,
      hackathonId: activeSprint.id,
      user
    });

    setShowFinalizeModal(false);

    if (res.success) {
      setSubmissionNotice({
        type: "success",
        text: "✓ Submission frozen & finalized! Deliverables are now locked and forwarded to the Screening Committee queue."
      });
      setRefreshKey(k => k + 1);
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

            {/* Quick Status Bar (Compact & Subtle) */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-slate-400">
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
                <span className="text-slate-500">Submission:</span>
                <span className="text-slate-300">
                  {isFinalized ? "Locked" : (currentTeam ? "Draft" : "No Squad")}
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
          
          {/* Left Column (7 cols): Project Submission (Primary) & My Hackathons (Secondary) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. PROJECT SUBMISSION (PRIMARY WORKSPACE) */}
            <section className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
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
                {submissionNotice && (
                  <div
                    className={`p-2.5 rounded-lg text-xs ${
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

                {!activeSprint ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Please select a registered hackathon to manage project deliverables.
                  </div>
                ) : !currentTeam ? (
                  <div className="py-6 px-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl space-y-2 text-center">
                    <span className="text-xs font-bold text-amber-300 font-mono block uppercase">
                      Squad Required for Project Submission
                    </span>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      You are registered for <span className="text-slate-200 font-medium">{activeSprint.title}</span>, but deliverables must belong to a team. Create a new squad or enter an invite code on the right to enable submission.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Read-Only / Status Context Banner */}
                    {isFinalized ? (
                      <div className="px-3.5 py-2.5 bg-emerald-950/20 border-l-2 border-emerald-500 rounded-r-lg flex items-center justify-between text-xs text-emerald-300">
                        <div>
                          <span className="font-semibold block text-white text-xs">✓ Submission Frozen & Locked</span>
                          <span className="text-[11px] text-emerald-400/80 font-mono">
                            Finalized on {teamSubmission?.finalizedAt ? new Date(teamSubmission.finalizedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Verified"}. All deliverables are under review.
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono shrink-0">
                          Review Queue
                        </span>
                      </div>
                    ) : !isLeader ? (
                      <div className="px-3.5 py-2.5 bg-amber-950/20 border-l-2 border-amber-500 rounded-r-lg text-xs text-amber-300">
                        <span className="font-semibold block text-white text-xs">Team Member View (Read-Only)</span>
                        <span className="text-[11px] text-slate-300">
                          Viewing deliverables for squad <strong className="text-white">{currentTeam.name}</strong>. Only the Team Leader (<strong className="text-white">{currentTeam.lead}</strong>) can save drafts, upload files, or finalize for screening.
                        </span>
                      </div>
                    ) : null}

                    <form onSubmit={handleSaveSubmission} className="space-y-5 text-xs">
                      {/* SECTION 1: PROJECT INFORMATION */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                          PROJECT INFORMATION
                        </span>

                        <div>
                          <label className="text-slate-300 font-medium block mb-1">
                            Project Title *
                          </label>
                          <input
                            type="text"
                            required
                            disabled={isFinalized || !isLeader}
                            value={formValues.projectTitle}
                            onChange={(e) => updateFormField("projectTitle", e.target.value)}
                            placeholder="e.g. ResilientQueue Engine"
                            className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-300 font-medium block mb-1">
                            Short Description / Pitch
                          </label>
                          <textarea
                            rows={3}
                            disabled={isFinalized || !isLeader}
                            value={formValues.projectDescription}
                            onChange={(e) => updateFormField("projectDescription", e.target.value)}
                            placeholder="Summary of architecture, solution overview, and core innovations..."
                            className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* SUBTLE SEPARATOR */}
                      <div className="border-t border-slate-800/60" />

                      {/* SECTION 2: LINKS */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                          LINKS
                        </span>

                        <div>
                          <label className="text-slate-300 font-medium block mb-1">
                            GitHub Repository *
                          </label>
                          <input
                            type="url"
                            required
                            disabled={isFinalized || !isLeader}
                            value={formValues.repositoryUrl}
                            onChange={(e) => updateFormField("repositoryUrl", e.target.value)}
                            placeholder="https://github.com/team/project"
                            className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-lg px-3 py-2 font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-300 font-medium block mb-1">
                            Live Demo
                          </label>
                          <input
                            type="url"
                            disabled={isFinalized || !isLeader}
                            value={formValues.liveDemoUrl}
                            onChange={(e) => updateFormField("liveDemoUrl", e.target.value)}
                            placeholder="https://project.vercel.app"
                            className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-lg px-3 py-2 font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* SUBTLE SEPARATOR */}
                      <div className="border-t border-slate-800/60" />

                      {/* SECTION 3: FILES (AWS S3 ARCHITECTURE) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                            FILES
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            AWS S3 Architecture Ready
                          </span>
                        </div>

                        {/* File list without nested box cards */}
                        <div className="space-y-1">
                          {formValues.submissionFiles && formValues.submissionFiles.length > 0 ? (
                            <div className="divide-y divide-slate-800/40">
                              {formValues.submissionFiles.map((file) => (
                                <div
                                  key={file.id}
                                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono font-bold shrink-0">
                                      PDF
                                    </span>
                                    <div className="min-w-0">
                                      <span className="text-slate-200 font-medium truncate block">
                                        {file.name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        {file.category} • {formatBytes(file.size)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] font-mono">
                                      ☁ S3 Ready
                                    </span>
                                    {!isFinalized && isLeader && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveFile(file.id)}
                                        className="text-slate-500 hover:text-rose-400 px-1 transition-colors"
                                        title="Remove file"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-3 text-slate-500 text-center text-xs italic">
                              No documentation files attached yet.
                            </div>
                          )}
                        </div>

                        {/* File upload controls */}
                        {!isFinalized && isLeader && (
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <select
                              value={selectedFileCategory}
                              onChange={(e) => setSelectedFileCategory(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                            >
                              <option value="System Documentation">System Documentation</option>
                              <option value="Presentation / PDF">Presentation / PDF</option>
                              <option value="Architecture Assets">Architecture Assets</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                              + Attach File
                            </button>

                            <div className="flex items-center gap-2 ml-auto text-[11px] text-slate-400">
                              <button
                                type="button"
                                onClick={() => handleAddSampleFile("System_Architecture_Overview.pdf", "System Documentation", 2800000)}
                                className="hover:text-emerald-400 transition-colors"
                              >
                                + Sample Doc
                              </button>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => handleAddSampleFile("SlideDeck_Final_Demo.pdf", "Presentation / PDF", 4500000)}
                                className="hover:text-emerald-400 transition-colors"
                              >
                                + Sample Deck
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SUBTLE SEPARATOR */}
                      <div className="border-t border-slate-800/60" />

                      {/* SECTION 4: ACTIONS */}
                      <div>
                        {isFinalized ? (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-mono">
                              Status: <strong className="text-emerald-400">Locked for Screening</strong>
                            </span>
                            <button
                              type="button"
                              disabled
                              className="px-4 py-2 bg-slate-800 text-slate-500 font-semibold rounded-lg text-xs cursor-not-allowed"
                            >
                              ✓ Finalized & Locked
                            </button>
                          </div>
                        ) : isLeader ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <button
                              type="submit"
                              className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors text-xs shadow-sm"
                            >
                              Save Draft
                            </button>

                            <button
                              type="button"
                              onClick={handleOpenFinalizeModal}
                              className="w-full sm:w-auto px-4 py-2 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-semibold rounded-lg transition-colors text-xs shadow-sm"
                            >
                              Freeze & Finalize for Screening
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              Only the Team Leader ({currentTeam.lead}) can save or finalize this submission.
                            </span>
                            <button
                              type="button"
                              disabled
                              className="px-4 py-2 bg-slate-800 text-slate-500 rounded-lg text-xs cursor-not-allowed"
                            >
                              Leader Actions Only
                            </button>
                          </div>
                        )}
                      </div>
                    </form>
                  </>
                )}
              </div>
            </section>

            {/* 2. MY HACKATHONS (SECONDARY CONTEXT) */}
            <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800/70 flex items-center justify-between bg-slate-900/80">
                <div>
                  <h2 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                    MY HACKATHONS
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
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

              <div className="p-5">
                {registeredHackathons.length === 0 ? (
                  <div className="py-6 text-center space-y-2.5">
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
                  <div className="divide-y divide-slate-800/50">
                    {registeredHackathons.map((h) => {
                      const isSelected = activeSprint?.id === h.id;
                      const teamForH = getUserTeamForHackathon(userEmail, h.id);

                      return (
                        <div
                          key={h.id}
                          className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/20">
                                {h.registrationStatus || "Registration Verified"}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">{h.dates}</span>
                              {isSelected && (
                                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                  ● Active Workspace
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-white">{h.title}</h3>
                            <div className="text-xs text-slate-400">
                              Track: <span className="text-slate-300">{h.track}</span>
                              <span className="text-slate-600 mx-1.5">•</span>
                              Squad:{" "}
                              <span className={teamForH ? "text-emerald-400 font-medium" : "text-amber-400"}>
                                {teamForH ? teamForH.name : "No squad formed"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {registeredHackathons.length > 1 && !isSelected && (
                              <button
                                onClick={() => setSelectedHackathonId(h.id)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 rounded transition-colors"
                              >
                                Select Sprint
                              </button>
                            )}
                            <Link
                              to={`/hackathons/${h.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                            >
                              <span>Specifications</span>
                              <Icons.ArrowRight />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* Right Column (5 cols): My Team & Milestones (Secondary & Tertiary) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 3. MY TEAM (SECONDARY CONTEXT) */}
            <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800/70 flex items-center justify-between bg-slate-900/80">
                <div>
                  <h2 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                    MY TEAM
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {activeSprint ? `Roster for ${activeSprint.title}` : "Team management"}
                  </p>
                </div>
                {currentTeam && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
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
                    {/* Team Info & Invite Code (Clean Row) */}
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-sm font-bold text-white">{currentTeam.name}</span>
                        <span className="text-[11px] text-slate-400">Leader: {currentTeam.lead}</span>
                      </div>

                      <div className="py-2.5 flex items-center justify-between border-y border-slate-800/50">
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono block">INVITE CODE</span>
                          <span className="text-sm font-mono font-bold text-emerald-400 tracking-wider">
                            {currentTeam.code}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyCode(currentTeam.code)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-200 transition-colors"
                        >
                          {copied ? "✓ Copied" : "Copy Code"}
                        </button>
                      </div>
                    </div>

                    {/* Roster List (Clean Rows without nested cards) */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] font-mono text-slate-400 block font-semibold uppercase tracking-wider">
                        ROSTER
                      </span>
                      <div className="divide-y divide-slate-800/40">
                        {currentTeam.members?.map((m, idx) => {
                          const mName = typeof m === 'string' ? m : m.name;
                          const mRole = typeof m === 'object' && m.role ? m.role : "Member";
                          const mStatus = typeof m === 'object' && m.status ? m.status : "Active";

                          return (
                            <div
                              key={idx}
                              className="py-2 flex items-center justify-between text-xs"
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
                  <div className="py-4 px-3 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl space-y-3">
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
                  <span className="text-[10px] font-mono text-slate-400 block font-semibold uppercase tracking-wider">
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
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition-colors"
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

            {/* 4. UPCOMING MILESTONES (TERTIARY CONTEXT) */}
            <section className="bg-slate-900/40 border border-slate-800/70 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-900/60">
                <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  UPCOMING MILESTONES
                </h2>
              </div>

              <div className="p-4 space-y-3">
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
                      <span className="text-slate-300 font-medium block leading-tight">{dl.label}</span>
                      <span className="text-[10px] font-mono text-slate-500">{dl.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

        </div>

      </div>

      {/* FREEZE & FINALIZE CONFIRMATION MODAL */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
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

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
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
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
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
    </DashboardLayout>
  );
}
