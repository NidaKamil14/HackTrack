import React, { useState, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, Bell, CalendarDays, Check, ClipboardCheck, Compass, Copy, FileText, Flag, FolderOpen, Gavel, KeyRound, Link2, Lock, LockOpen, Paperclip, Printer, Rocket, ShieldCheck, Trophy, Upload, UserPlus, Users, X, Mail } from 'lucide-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import EmailActivity from '../../components/notifications/EmailActivity';
import EventCover from '../../components/art/EventCover';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  TabPanel,
  Tabs,
  Textarea,
  cn,
  STAGE_ORDER,
  stagePhase,
  stageProgress,
  stageTone
} from '../../components/ui';
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

const TAB_VALUES = ["workspace", "roster", "results", "certificates", "notifications", "discover"];

const NOTICE_TONES = { success: "success", info: "info", error: "danger" };

// Feedback strings from the handlers carry a leading check glyph; strip it for display.
function noticeText(text) {
  return String(text || "").replace(/^✓\s*/, "");
}

const SCREENING_CHECKS = [
  { key: "gitFreshness", label: "Git freshness" },
  { key: "endpointsLive", label: "HTTPS endpoint live" },
  { key: "envConfigured", label: ".env.example documentation" },
  { key: "licenseMIT", label: "Open source license" }
];

const RUBRIC_CRITERIA = [
  { key: "architecture", label: "Architecture", max: 30 },
  { key: "usability", label: "Usability & UX", max: 25 },
  { key: "innovation", label: "Innovation", max: 25 },
  { key: "completeness", label: "Completeness", max: 20 }
];

function screeningTone(status) {
  if (status === "Shortlisted") return "success";
  if (status === "Rejected") return "danger";
  return "warning";
}

const STAGE_PHASE_LABELS = { upcoming: "Upcoming", active: "In progress", completed: "Completed" };

const TILE_TONES = {
  accent: "bg-accent/15 text-accent-text ring-accent/25",
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-danger/10 text-danger ring-danger/25",
  info: "bg-info/10 text-info ring-info/25",
  neutral: "bg-raised text-fg-muted ring-line"
};

/** Small icon tile used beside section headings. */
function IconTile({ icon: Icon, tone = "accent", className }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
        TILE_TONES[tone] || TILE_TONES.accent,
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/** Slim gradient progress bar. */
function ProgressBar({ value, max, label, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-raised", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Initials for avatar circles (presentation only). */
function initialsOf(name) {
  const parts = String(name || "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Small labelled sub-section used inside cards. */
function FormSection({ title, description, actions, icon, children, className }) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <IconTile icon={icon} />}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export default function StudentDashboard({ initialTab = "workspace" }) {
  const { user } = useAuth();
  const userEmail = user?.email || "";

  // Active dashboard tab (synced to ?tab=, falls back to initialTab)
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = TAB_VALUES.includes(tabParam) ? tabParam : initialTab;
  const setActiveTab = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("tab", next);
      return params;
    });
  };

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

  const readOnlyForm = isFinalized || !isLeader;

  const tabItems = [
    {
      value: "workspace",
      label: "Project submission",
      icon: <Rocket aria-hidden="true" />,
      badge: isFinalized ? <Badge tone="success">Submitted</Badge> : null
    },
    {
      value: "roster",
      label: "Team & roster",
      icon: <Users aria-hidden="true" />,
      badge: currentTeam ? <Badge className="tabular-nums">{currentTeam.capacity}</Badge> : null
    },
    {
      value: "results",
      label: "Screening & judging",
      icon: <ClipboardCheck aria-hidden="true" />,
      badge: teamSubmission?.screeningStatus ? (
        <Badge tone={screeningTone(teamSubmission.screeningStatus)}>{teamSubmission.screeningStatus}</Badge>
      ) : null
    },
    {
      value: "certificates",
      label: "Certificates",
      icon: <Award aria-hidden="true" />,
      badge: certificates.length > 0 ? (
        <Badge tone="accent" className="tabular-nums">{certificates.length}</Badge>
      ) : null
    },
    {
      value: "notifications",
      label: "Notifications",
      icon: <Bell aria-hidden="true" />,
      badge: unreadNotifsCount > 0 ? (
        <Badge tone="danger" className="tabular-nums" aria-label={`${unreadNotifsCount} unread`}>
          {unreadNotifsCount}
        </Badge>
      ) : null
    },
    {
      value: "discover",
      label: "Discover",
      icon: <Compass aria-hidden="true" />
    }
  ];

  const copyButtonLabel = copied ? "Copied" : "Copy code";

  // Presentation only: position of the active hackathon in the lifecycle.
  const activeStageIndex = activeSprint?.stage ? STAGE_ORDER.indexOf(activeSprint.stage) : -1;

  return (
    <DashboardLayout
      portalTitle={isLeader ? "Team Leader Portal" : "Student Participant Portal"}
      roleBadgeText={isLeader ? "TEAM LEADER" : "STUDENT PARTICIPANT"}
    >
      <div className="space-y-8">

        {/* HEADER */}
        <PageHeader
          icon={Rocket}
          eyebrow={isLeader ? "Team leader workspace" : "Participant workspace"}
          title={`Welcome back, ${user?.fullName || "Developer"}`}
          description="Register for hackathons, build your team, submit your project and follow it through screening, judging and certificates."
          meta={
            <>
              <span>{user?.university || userEmail || "Active Participant"}</span>
              <span className="flex items-center gap-1.5">
                <span className="tabular-nums font-medium text-fg">{registeredHackathons.length}</span>
                {registeredHackathons.length === 1 ? "registration" : "registrations"}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden="true" />
                <span className="font-medium text-fg">{currentTeam ? currentTeam.name : "No team yet"}</span>
              </span>
              <Badge tone={isLeader ? "accent" : "neutral"}>{isLeader ? "Team leader" : "Member"}</Badge>
            </>
          }
          actions={
            activeTab !== "discover" ? (
              <Button variant="secondary" onClick={() => setActiveTab("discover")}>
                <Compass aria-hidden="true" />
                Discover hackathons
              </Button>
            ) : null
          }
        />

        <div className="space-y-4">
          {/* Current competition strip */}
          {activeSprint && (
            <section
              aria-labelledby="student-current-competition"
              className="surface-card relative isolate overflow-hidden rounded-xl border border-line p-4 sm:p-5 [&>div]:relative"
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-accent to-accent-2"
                aria-hidden="true"
              />
              {/* Event cover art fading in from the right (decorative) */}
              <span className="pointer-events-none absolute right-0 top-0 -z-10 hidden h-28 w-1/2 opacity-70 [mask-image:linear-gradient(to_left,black_30%,transparent)] md:block">
                <EventCover hackathon={activeSprint} className="h-full w-full" />
              </span>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <IconTile icon={Flag} />
                  <div className="min-w-0 space-y-1">
                    <p className="eyebrow">Current competition</p>
                    <h2 id="student-current-competition" className="text-base font-semibold leading-snug text-fg">
                      {activeSprint.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-fg-subtle">
                      {activeSprint.stage && (
                        <Badge tone={stageTone(activeSprint.stage)} dot>{activeSprint.stage}</Badge>
                      )}
                      {activeSprint.track && <span>{activeSprint.track}</span>}
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        Deadline: <span className="font-medium text-fg-muted">{activeSprint.deadline || "TBD"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Multi-hackathon context switcher */}
                {registeredHackathons.length > 1 && (
                  <Field label="Hackathon" hint="Submission, team and results below are for this hackathon." className="w-full lg:w-80">
                    <Select
                      value={activeSprint?.id || ""}
                      onChange={(e) => setSelectedHackathonId(e.target.value)}
                    >
                      {registeredHackathons.map((h) => (
                        <option key={h.id} value={h.id}>{h.title}</option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>

              {activeStageIndex >= 0 && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-fg-subtle">
                    <span>
                      Competition progress
                      <span className="text-fg-muted"> · {STAGE_PHASE_LABELS[stagePhase(activeSprint.stage)]}</span>
                    </span>
                    <span className="tabular-nums">{stageProgress(activeSprint.stage)}%</span>
                  </div>
                  <ProgressBar
                    value={stageProgress(activeSprint.stage)}
                    max={100}
                    label={`Competition stage: ${activeSprint.stage}`}
                  />
                  <ol className="hidden grid-cols-7 gap-2 text-xs lg:grid" aria-hidden="true">
                    {STAGE_ORDER.map((stage, i) => (
                      <li
                        key={stage}
                        className={cn(
                          "truncate",
                          i === activeStageIndex ? "font-medium text-accent-text" : i < activeStageIndex ? "text-fg-muted" : "text-fg-subtle"
                        )}
                      >
                        {stage}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          )}

          <Tabs
            items={tabItems}
            value={activeTab}
            onValueChange={setActiveTab}
            label="Participant dashboard sections"
            idPrefix="student"
          />

          {/* Global feedback notice */}
          {submissionNotice && (
            <Alert tone={NOTICE_TONES[submissionNotice.type] || "info"}>
              {noticeText(submissionNotice.text)}
            </Alert>
          )}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: WORKSPACE & PROJECT SUBMISSION */}
        {/* ========================================================= */}
        <TabPanel value="workspace" activeValue={activeTab} idPrefix="student" className="focus:outline-none">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Primary submission workspace */}
            <Card className={cn("lg:col-span-2", isFinalized && "border-success/30")}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <IconTile icon={isFinalized ? Lock : Rocket} tone={isFinalized ? "success" : "accent"} />
                  <div className="min-w-0 space-y-1">
                    <CardTitle as="h2">Project submission</CardTitle>
                    <CardDescription>
                      {activeSprint
                        ? `Deliverables for ${activeSprint.title}${currentTeam ? ` · Team ${currentTeam.name}` : ''}`
                        : "Select a hackathon to submit"}
                    </CardDescription>
                    {activeSprint && (
                      <p className="flex items-center gap-1.5 pt-1 text-xs text-fg-subtle">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        Deadline: <span className="font-medium text-fg-muted">{activeSprint.deadline || "TBD"}</span>
                      </p>
                    )}
                  </div>
                </div>
                {currentTeam && (
                  <Badge tone={isFinalized ? "success" : "warning"} dot>
                    {isFinalized && <Lock className="h-3 w-3" aria-hidden="true" />}
                    {isFinalized ? "Submitted · locked" : "Draft · not submitted"}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {!activeSprint ? (
                  <EmptyState
                    illustration="calendar"
                    icon={FolderOpen}
                    title="No hackathon selected"
                    description="Please select or register for a hackathon to manage project deliverables."
                    action={
                      <Button onClick={() => setActiveTab("discover")}>
                        <Compass aria-hidden="true" />
                        Discover hackathons
                      </Button>
                    }
                  />
                ) : !currentTeam ? (
                  <EmptyState
                    illustration="team"
                    icon={Users}
                    title="A team is required to submit"
                    description="Deliverables belong to a team. Create a new team or enter an invite code in the Team & roster tab."
                    action={
                      <Button onClick={() => setActiveTab("roster")}>
                        Go to team management
                      </Button>
                    }
                  />
                ) : (
                  <>
                    {isFinalized ? (
                      <Alert tone="success" title="Submission finalized and locked">
                        Deliverables are locked for Screening Committee review
                        {teamSubmission?.finalizedAt
                          ? ` (finalized ${new Date(teamSubmission.finalizedAt).toLocaleDateString()}).`
                          : "."}{" "}
                        Reopening requires an admin request.
                      </Alert>
                    ) : !isLeader ? (
                      <Alert tone="info" title="Read-only access">
                        You are a team member. Only team leader{" "}
                        <span className="font-medium text-fg">{currentTeam.lead}</span> can edit and finalize deliverables.
                      </Alert>
                    ) : null}

                    <form onSubmit={handleSaveSubmission} className="space-y-6">
                      <FormSection title="Project details" icon={FileText}>
                        <Field label="Project title" required>
                          <Input
                            type="text"
                            required={false}
                            disabled={readOnlyForm}
                            value={formValues.projectTitle}
                            onChange={(e) => updateFormField("projectTitle", e.target.value)}
                            placeholder="e.g. ResilientQueue Engine"
                          />
                        </Field>
                        <Field label="Elevator pitch / summary" hint="Describe the problem, architectural highlights and tech stack.">
                          <Textarea
                            rows={4}
                            disabled={readOnlyForm}
                            value={formValues.projectDescription}
                            onChange={(e) => updateFormField("projectDescription", e.target.value)}
                            placeholder="What does it do and how is it built?"
                          />
                        </Field>
                      </FormSection>

                      <FormSection title="Links" icon={Link2} className="border-t border-line pt-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Repository URL" required>
                            <Input
                              type="url"
                              required={false}
                              disabled={readOnlyForm}
                              value={formValues.repositoryUrl}
                              onChange={(e) => updateFormField("repositoryUrl", e.target.value)}
                              placeholder="https://github.com/org/repo"
                              className="font-mono"
                            />
                          </Field>
                          <Field label="Live demo URL">
                            <Input
                              type="url"
                              disabled={readOnlyForm}
                              value={formValues.liveDemoUrl}
                              onChange={(e) => updateFormField("liveDemoUrl", e.target.value)}
                              placeholder="https://demo.app"
                              className="font-mono"
                            />
                          </Field>
                        </div>
                      </FormSection>

                      <FormSection
                        title="Documentation & files"
                        icon={Paperclip}
                        description="System architecture PDFs, whitepapers or pitch decks (staged for AWS S3)."
                        className="border-t border-line pt-6"
                      >
                        {isLeader && !isFinalized && (
                          <div className="flex flex-col gap-3 rounded-lg bg-raised/50 p-3 sm:flex-row sm:items-end">
                            <Field label="File category" className="sm:flex-1">
                              <Select
                                value={selectedFileCategory}
                                onChange={(e) => setSelectedFileCategory(e.target.value)}
                              >
                                <option value="System Documentation">System Documentation</option>
                                <option value="Presentation / Pitch Deck">Pitch Deck</option>
                                <option value="Architecture Diagram">Architecture</option>
                              </Select>
                            </Field>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => handleAddSampleFile("Architecture_Design_v2.pdf", selectedFileCategory, 1850000)}
                              >
                                Add sample
                              </Button>
                              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                                <Upload aria-hidden="true" />
                                Upload file
                              </Button>
                            </div>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              className="hidden"
                              accept=".pdf,.png,.jpg,.jpeg,.zip"
                            />
                          </div>
                        )}

                        {formValues.submissionFiles && formValues.submissionFiles.length > 0 ? (
                          <ul className="divide-y divide-line rounded-lg border border-line">
                            {formValues.submissionFiles.map((file) => (
                              <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                <div className="flex min-w-0 items-center gap-3">
                                  <Paperclip className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-fg">{file.name}</p>
                                    <p className="text-xs text-fg-subtle">
                                      {file.category || "DOC"} · <span className="tabular-nums">{formatBytes(file.size)}</span>
                                    </p>
                                  </div>
                                </div>
                                {isLeader && !isFinalized && (
                                  <Button
                                    variant="danger-ghost"
                                    size="icon-sm"
                                    onClick={() => handleRemoveFile(file.id)}
                                    aria-label={`Remove ${file.name}`}
                                    title="Remove staged file"
                                  >
                                    <X aria-hidden="true" />
                                  </Button>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-fg-subtle">
                            No files attached yet. Attach your pitch deck or architecture documentation.
                          </p>
                        )}
                      </FormSection>

                      {isLeader && (
                        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-fg-subtle">
                            Status: <span className="font-medium text-fg">{isFinalized ? "Locked" : "Draft"}</span>
                          </p>
                          {!isFinalized ? (
                            <div className="flex flex-wrap gap-2">
                              <Button type="submit" variant="secondary">
                                Save draft
                              </Button>
                              <Button onClick={handleOpenFinalizeModal}>
                                <Lock aria-hidden="true" />
                                Finalize submission
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-fg-muted">
                              Submission certified and locked. Reopening requires admin request.
                            </p>
                          )}
                        </div>
                      )}
                    </form>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Aside: team snapshot & hackathon details */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconTile icon={Users} />
                    <CardTitle as="h2">Your team</CardTitle>
                  </div>
                  {currentTeam && (
                    <Badge className="font-mono tabular-nums">{currentTeam.capacity}</Badge>
                  )}
                </CardHeader>
                <CardContent>
                  {currentTeam ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-fg">{currentTeam.name}</p>
                        <p className="text-sm text-fg-muted">Leader: {currentTeam.lead}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/25 bg-accent/5 p-3">
                        <div className="min-w-0">
                          <p className="eyebrow">Invite code</p>
                          <p className="truncate font-mono text-sm font-semibold tracking-wider text-accent-text">{currentTeam.code}</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCopyCode(currentTeam.code)}
                          aria-live="polite"
                        >
                          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                          {copyButtonLabel}
                        </Button>
                      </div>
                      <Button variant="link" className="px-0" onClick={() => setActiveTab("roster")}>
                        Manage roster & permissions
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-center">
                      <p className="text-sm text-fg-muted">
                        No team formed for {activeSprint?.title || "this hackathon"}.
                      </p>
                      <Button size="sm" onClick={() => setActiveTab("roster")}>
                        <UserPlus aria-hidden="true" />
                        Form or join a team
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {activeSprint && (
                <Card>
                  <CardHeader className="flex-row items-center gap-3">
                    <IconTile icon={CalendarDays} />
                    <CardTitle as="h2">Hackathon details</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <DescriptionList
                      items={[
                        { label: "Track", value: activeSprint.track || "—" },
                        { label: "Dates", value: activeSprint.dates || "—" },
                        { label: "Deadline", value: activeSprint.deadline || "TBD" },
                        { label: "Registration", value: activeSprint.registrationStatus || "—" }
                      ]}
                    />
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </TabPanel>

        {/* ========================================================= */}
        {/* TAB 2: TEAM & ROSTER MANAGEMENT */}
        {/* ========================================================= */}
        <TabPanel value="roster" activeValue={activeTab} idPrefix="student" className="space-y-6 focus:outline-none">
          {teamActionFeedback && (
            <Alert tone={teamActionFeedback.type === "success" ? "success" : "danger"}>
              {noticeText(teamActionFeedback.text)}
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <IconTile icon={Users} />
                  <div className="min-w-0 space-y-1">
                    <CardTitle as="h2">Team roster</CardTitle>
                    <CardDescription>
                      {currentTeam ? `${currentTeam.name} · ${activeSprint?.title}` : "No team assigned"}
                    </CardDescription>
                  </div>
                </div>
                {currentTeam && (
                  <Badge tone={currentTeam.rosterLocked ? "warning" : "success"} dot>
                    {currentTeam.rosterLocked ? "Roster locked" : "Open for members"}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {currentTeam ? (
                  <>
                    <div className="flex flex-col gap-4 rounded-xl border border-accent/25 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <IconTile icon={KeyRound} />
                        <div className="min-w-0">
                          <p className="eyebrow">Shareable invite code</p>
                          <p className="mt-1 inline-block break-all rounded-md border border-line-strong bg-sunken px-3 py-1.5 font-mono text-xl font-semibold tracking-widest text-accent-text">
                            {currentTeam.code}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCopyCode(currentTeam.code)}
                          aria-live="polite"
                        >
                          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                          {copied ? "Copied" : "Copy team code"}
                        </Button>
                        {isLeader && (
                          <Button
                            variant={currentTeam.rosterLocked ? "secondary" : "ghost"}
                            size="sm"
                            onClick={handleToggleRosterLock}
                          >
                            {currentTeam.rosterLocked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
                            {currentTeam.rosterLocked ? "Unlock roster" : "Lock roster"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-fg">
                        Active members <span className="font-normal tabular-nums text-fg-subtle">({currentTeam.capacity})</span>
                      </h3>
                      <ul className="divide-y divide-line rounded-lg border border-line">
                        {currentTeam.members?.map((m, idx) => {
                          const mName = typeof m === 'string' ? m : m.name;
                          const mEmail = typeof m === 'object' && m.email ? m.email : "";
                          const mRole = typeof m === 'object' && m.role ? m.role : (mName.includes('(Lead)') ? 'Team Leader' : 'Member');
                          const isThisMemberLead = mRole === "Team Leader" || mName.includes('(Lead)');

                          return (
                            <li key={idx} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset",
                                    isThisMemberLead
                                      ? "bg-gradient-to-br from-accent to-accent-deep text-accent-fg ring-accent/40"
                                      : "bg-raised text-fg-muted ring-line-strong"
                                  )}
                                  aria-hidden="true"
                                >
                                  {initialsOf(mName)}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium text-fg">{mName}</span>
                                    <Badge tone={isThisMemberLead ? "accent" : "neutral"}>
                                      {isThisMemberLead ? "Leader" : "Member"}
                                    </Badge>
                                  </div>
                                  {mEmail && <p className="mt-0.5 truncate font-mono text-xs text-fg-subtle">{mEmail}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge tone="success">Active</Badge>
                                {isLeader && !isThisMemberLead && mEmail && (
                                  <Button
                                    variant="danger-ghost"
                                    size="sm"
                                    onClick={() => handleRemoveMember(mEmail)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    illustration="team"
                    icon={Users}
                    title="No team yet"
                    description={`No team formed for ${activeSprint?.title || "this hackathon"}. Create a new team or enter an invite code to join an existing one.`}
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {!currentTeam && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <IconTile icon={UserPlus} />
                      <CardTitle as="h2">Create a team</CardTitle>
                    </div>
                    <CardDescription>
                      Start a team for <span className="text-fg">{activeSprint?.title}</span>. You will be the team leader.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
                      <Field label="Team name" required>
                        <Input
                          type="text"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="e.g. ApexInnovators"
                        />
                      </Field>
                      <Button type="submit" className="w-full">
                        <UserPlus aria-hidden="true" />
                        Create team
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <IconTile icon={KeyRound} />
                    <CardTitle as="h2">Join with an invite code</CardTitle>
                  </div>
                  <CardDescription>
                    Enter the unique invite code provided by your team leader.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleJoinTeam} className="space-y-4">
                    <Field label="Invite code" required>
                      <Input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="e.g. HT-DEV-42"
                        className="font-mono uppercase"
                        autoComplete="off"
                      />
                    </Field>
                    <Button type="submit" variant="secondary" className="w-full">
                      Join team
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* ========================================================= */}
        {/* TAB 3: SCREENING & JUDGING RESULTS */}
        {/* ========================================================= */}
        <TabPanel value="results" activeValue={activeTab} idPrefix="student" className="focus:outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Stage 1: screening */}
            <Card>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <IconTile icon={ShieldCheck} tone={teamSubmission?.screeningStatus ? screeningTone(teamSubmission.screeningStatus) : "accent"} />
                  <div className="min-w-0 space-y-1">
                    <p className="eyebrow">Stage 1 · Screening</p>
                    <CardTitle as="h2">Automated & technical compliance</CardTitle>
                  </div>
                </div>
                <Badge tone={screeningTone(teamSubmission?.screeningStatus)} dot>
                  {teamSubmission?.screeningStatus || "Pending review"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-5">
                {teamSubmission ? (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-fg">Compliance criteria</h3>
                      <ul className="divide-y divide-line rounded-lg border border-line">
                        {SCREENING_CHECKS.map((check) => {
                          const passed = Boolean(teamSubmission.checks?.[check.key]);
                          return (
                            <li key={check.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                              <span className="text-fg">{check.label}</span>
                              <Badge tone={passed ? "success" : "danger"}>
                                {passed ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
                                {passed ? "Pass" : "Fail"}
                              </Badge>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {teamSubmission.screeningRemarks && (
                      <div className="relative space-y-1 overflow-hidden rounded-lg bg-raised/50 p-3 pl-4">
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
                        <p className="eyebrow">Reviewer remarks</p>
                        <p className="text-sm leading-relaxed text-fg-muted">{teamSubmission.screeningRemarks}</p>
                        {teamSubmission.screenedBy && (
                          <p className="text-xs text-fg-subtle">Reviewer: {teamSubmission.screenedBy}</p>
                        )}
                      </div>
                    )}

                    {teamSubmission.screeningStatus === "Rejected" && teamSubmission.rejectionReason && (
                      <Alert tone="danger" title="Non-compliance notice">
                        {teamSubmission.rejectionReason}
                      </Alert>
                    )}
                  </>
                ) : (
                  <EmptyState
                    illustration="review"
                    icon={ClipboardCheck}
                    title="Nothing to screen yet"
                    description="Submit deliverables first to enter the screening gateway."
                    action={
                      <Button variant="secondary" onClick={() => setActiveTab("workspace")}>
                        Go to project submission
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>

            {/* Stage 2: rubric judging */}
            <Card>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <IconTile icon={Gavel} tone={resultsReleased ? "success" : "accent"} />
                  <div className="min-w-0 space-y-1">
                    <p className="eyebrow">Stage 2 · Rubric evaluation</p>
                    <CardTitle as="h2">Judge panel scorecard</CardTitle>
                  </div>
                </div>
                <Badge tone={resultsReleased ? "success" : "neutral"} dot>
                  {resultsReleased ? "Officially released" : "Under evaluation"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-5">
                {resultsReleased && teamEvaluation ? (
                  <>
                    <div className="space-y-3 rounded-lg border border-success/25 bg-success/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="eyebrow">Certified total score</p>
                          <p className="text-4xl font-semibold tabular-nums tracking-tight text-fg sm:text-5xl">
                            {teamEvaluation.totalScore}
                            <span className="ml-1 text-base font-normal text-fg-subtle">/ 100</span>
                          </p>
                        </div>
                        <Badge tone="success">
                          <Trophy className="h-3 w-3" aria-hidden="true" />
                          Results published
                        </Badge>
                      </div>
                      <ProgressBar
                        value={Number(teamEvaluation.totalScore) || 0}
                        max={100}
                        label="Certified total score"
                      />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-fg">Criteria breakdown</h3>
                      <ul className="space-y-3">
                        {RUBRIC_CRITERIA.map((c) => {
                          const score = teamEvaluation.scores?.[c.key] || 0;
                          const pct = Math.min(100, Math.round((score / c.max) * 100));
                          return (
                            <li key={c.key} className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-fg-muted">{c.label}</span>
                                <span className="font-medium tabular-nums text-fg">
                                  {score} <span className="text-fg-subtle">/ {c.max}</span>
                                </span>
                              </div>
                              <div
                                className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
                                role="progressbar"
                                aria-label={c.label}
                                aria-valuenow={score}
                                aria-valuemin={0}
                                aria-valuemax={c.max}
                              >
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {teamEvaluation.feedback && (
                      <figure className="relative space-y-1 overflow-hidden rounded-lg bg-raised/50 p-3 pl-4">
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
                        <p className="eyebrow">Judge panel feedback</p>
                        <blockquote className="text-sm italic leading-relaxed text-fg-muted">
                          "{teamEvaluation.feedback}"
                        </blockquote>
                        <figcaption className="text-xs text-fg-subtle">
                          Evaluated by: {teamEvaluation.judgeName || "Expert Panel"}
                        </figcaption>
                      </figure>
                    )}
                  </>
                ) : (
                  <EmptyState
                    illustration="review"
                    icon={Trophy}
                    title="Judging and scoring in progress"
                    description="Evaluations are scored privately by assigned judges. Results and certificates will unlock here when officially certified by the Platform Administrator."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* ========================================================= */}
        {/* TAB 4: CERTIFICATES */}
        {/* ========================================================= */}
        <TabPanel value="certificates" activeValue={activeTab} idPrefix="student" className="space-y-4 focus:outline-none">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <IconTile icon={Award} />
              <div className="space-y-0.5">
                <h2 className="text-base font-semibold text-fg">Certificates</h2>
                <p className="text-sm text-fg-muted">Issued certificates of excellence and participation.</p>
              </div>
            </div>
            <span className="text-sm text-fg-subtle">
              <span className="tabular-nums">{certificates.length}</span> verified document(s)
            </span>
          </div>

          {certificates.length === 0 ? (
            <Card>
              <EmptyState
                illustration="award"
                icon={Award}
                title="No certificates available yet"
                description="Certificates are automatically generated upon official release of hackathon leaderboard results."
              />
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {certificates.map((cert) => (
                <li key={cert.certificateId}>
                  <Card as="article" className="relative flex h-full flex-col overflow-hidden p-5">
                    <span className="hairline-gradient absolute inset-x-0 top-0 h-px" aria-hidden="true" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent-2/10 text-accent-text ring-1 ring-inset ring-accent/30">
                        <Award className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <Badge tone="accent" className="whitespace-normal text-right">
                        {cert.awardTitle || "Certificate of Excellence"}
                      </Badge>
                    </div>

                    <h3 className="mt-4 text-base font-semibold leading-snug text-fg">{cert.hackathonTitle}</h3>
                    <p className="mt-0.5 text-sm text-fg-subtle">Track: {cert.track}</p>

                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                      <div className="min-w-0">
                        <dt className="eyebrow">Team</dt>
                        <dd className="mt-0.5 truncate text-fg">{cert.teamName}</dd>
                        <dd className="truncate text-xs text-fg-subtle">{cert.recipientName}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="eyebrow">Issued</dt>
                        <dd className="mt-0.5 whitespace-nowrap tabular-nums text-fg">{cert.issueDate}</dd>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <dt className="eyebrow">Certificate ID</dt>
                        <dd className="mt-1 break-all rounded-md bg-sunken px-2 py-1 font-mono text-xs text-fg-muted">
                          {cert.certificateId}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto flex justify-end pt-4">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewCert(cert)}
                        aria-label={`View certificate for ${cert.hackathonTitle}`}
                      >
                        View certificate
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        {/* ========================================================= */}
        {/* TAB 5: NOTIFICATIONS */}
        {/* ========================================================= */}
        <TabPanel value="notifications" activeValue={activeTab} idPrefix="student" className="focus:outline-none">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-4">
              <div className="flex min-w-0 items-start gap-3">
                <IconTile icon={Bell} />
                <div className="min-w-0 space-y-1">
                  <CardTitle as="h2">Notifications</CardTitle>
                  <CardDescription>Platform activity and competition updates. Select one to mark it as read.</CardDescription>
                </div>
              </div>
              {unreadNotifsCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { markAllAsRead(userEmail); setRefreshKey((k) => k + 1); }}
                >
                  <Check aria-hidden="true" />
                  Mark all as read
                </Button>
              )}
            </CardHeader>

            {notifications.length === 0 ? (
              <EmptyState
                illustration="inbox"
                icon={Bell}
                title="No notifications yet"
                description="Updates about your registrations, team and results will appear here."
              />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => { markAsRead(n.id); setRefreshKey((k) => k + 1); }}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors last:rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        !n.read ? "bg-raised/70 hover:bg-raised" : "hover:bg-raised/40"
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            !n.read ? "bg-accent ring-4 ring-accent/20" : "bg-line-strong"
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className={cn("text-sm text-fg", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
                            <span className="text-xs text-fg-subtle">{n.date}</span>
                          </div>
                          <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{n.message}</p>
                        </div>
                      </div>
                      {!n.read && <Badge tone="accent" className="shrink-0">New</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="mt-6">
            <CardHeader className="flex-row items-start gap-3 pb-4">
              <IconTile icon={Mail} />
              <div className="min-w-0 space-y-1">
                <CardTitle as="h2">Email delivery</CardTitle>
                <CardDescription>Notifications from the HackTrack server and whether each one was emailed to you.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <EmailActivity />
            </CardContent>
          </Card>
        </TabPanel>

        {/* ========================================================= */}
        {/* TAB 6: DISCOVER HACKATHONS */}
        {/* ========================================================= */}
        <TabPanel value="discover" activeValue={activeTab} idPrefix="student" className="space-y-4 focus:outline-none">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <IconTile icon={Compass} />
              <div className="space-y-0.5">
                <h2 className="text-base font-semibold text-fg">Discover hackathons</h2>
                <p className="text-sm text-fg-muted">Explore active and upcoming competitions and register in one click.</p>
              </div>
            </div>
            <Button as={Link} to="/hackathons" variant="link" className="px-0">
              Browse all public pages
            </Button>
          </div>

          {allHackathons.length === 0 ? (
            <Card>
              <EmptyState
                illustration="calendar"
                icon={Compass}
                title="No hackathons listed"
                description="New competitions will appear here as organizers publish them."
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allHackathons.map((h) => {
                const isReg = registrations.some((r) => r.hackathonId === h.id);

                return (
                  <Card key={h.id} className="flex h-full flex-col overflow-hidden">
                    <EventCover hackathon={h} className="h-24 w-full border-b border-line" />
                    <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={stageTone(h.stage)} dot>{h.stage}</Badge>
                      {h.category && <span className="text-xs text-fg-subtle">{h.category}</span>}
                    </div>
                    <h3 className="mt-4 text-base font-semibold leading-snug text-fg">{h.title}</h3>
                    {h.track && <p className="mt-0.5 text-sm text-fg-muted">{h.track}</p>}
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-fg-muted">{h.summary}</p>

                    <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-5 text-sm text-fg-subtle">
                      <div className="flex items-center gap-1.5">
                        <dt><CalendarDays className="h-4 w-4" aria-label="Deadline" /></dt>
                        <dd>{h.deadline}</dd>
                      </div>
                      {h.prizePool && (
                        <div className="flex items-center gap-1.5">
                          <dt><Trophy className="h-4 w-4" aria-label="Prize pool" /></dt>
                          <dd className="font-medium text-fg">{h.prizePool}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="mt-4 flex items-center justify-end border-t border-line pt-4">
                      {isReg ? (
                        <Badge tone="success">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          Registered
                        </Badge>
                      ) : (
                        <Button size="sm" onClick={() => handleRegisterDirect(h.id, h.title)}>
                          Register
                        </Button>
                      )}
                    </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabPanel>

      </div>

      {/* DIALOG: FINALIZE CONFIRMATION */}
      <Dialog
        open={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        title="Finalize project submission"
        description="Once finalized, your submission cannot be edited. Continue?"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-raised/50 px-3">
            <DescriptionList
              items={[
                { label: "Competition", value: activeSprint?.title || "—" },
                { label: "Team", value: currentTeam?.name || "—" },
                { label: "Project title", value: formValues.projectTitle },
                {
                  label: "Deliverable files",
                  value: <span className="tabular-nums">{formValues.submissionFiles?.length || 0} file(s) attached</span>
                }
              ]}
            />
          </div>

          <Alert tone="warning" title="This action is irreversible">
            All links and uploaded documentation will be locked and immediately forwarded to the Screening Committee review board.
          </Alert>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setShowFinalizeModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmFinalize}>
              <Lock aria-hidden="true" />
              Yes, finalize and lock
            </Button>
          </div>
        </div>
      </Dialog>

      {/* DIALOG: DIGITAL CERTIFICATE VIEWER */}
      <Dialog
        open={Boolean(previewCert)}
        onClose={() => setPreviewCert(null)}
        title="Certificate"
        size="xl"
      >
        {previewCert && (
          <div className="space-y-5">
            <div className="space-y-4 rounded-xl border-4 border-double border-line-strong bg-raised/50 p-6 text-center sm:p-8">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-accent-text">
                <Award className="h-6 w-6" aria-hidden="true" />
              </span>

              <div className="space-y-1">
                <p className="eyebrow">HackTrack certificate of accomplishment</p>
                <p className="text-2xl font-semibold tracking-tight text-fg">{previewCert.awardTitle}</p>
              </div>

              <p className="text-sm text-fg-muted">This official credential certifies that</p>

              <p className="text-xl font-semibold text-accent-text">{previewCert.recipientName}</p>

              <p className="mx-auto max-w-md text-sm leading-relaxed text-fg-muted">
                has successfully competed with team <strong className="text-fg">{previewCert.teamName}</strong> in the{" "}
                <strong className="text-fg">{previewCert.hackathonTitle}</strong> ({previewCert.track}) submitting project{" "}
                <strong className="text-fg">"{previewCert.projectTitle}"</strong>.
              </p>

              <dl className="grid gap-4 border-t border-line pt-4 text-left text-sm sm:grid-cols-3">
                <div>
                  <dt className="eyebrow">Issuance date</dt>
                  <dd className="mt-0.5 tabular-nums text-fg">{previewCert.issueDate}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Certificate ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-fg">{previewCert.certificateId}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Verification signature</dt>
                  <dd className="mt-0.5 text-fg">{previewCert.signedBy}</dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => window.print()}>
                <Printer aria-hidden="true" />
                Print / download PDF
              </Button>
            </div>
          </div>
        )}
      </Dialog>

    </DashboardLayout>
  );
}
