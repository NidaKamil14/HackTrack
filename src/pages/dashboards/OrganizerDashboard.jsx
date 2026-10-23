import React, { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import EventCover from '../../components/art/EventCover';
import { useAuth } from '../../context/AuthContext';
import {
  getStoredHackathons,
  createNewHackathon,
  advanceHackathonStage,
  updateHackathon,
  generateHackathonCode,
  getHackathonCommittee,
  saveUserHackathonAssignment
} from '../../utils/hackathonService';
import { getAllTeams } from '../../utils/teamService';
import { getSubmissions } from '../../utils/submissionService';
import { addNotification } from '../../utils/notificationService';
import { getRegistrations } from '../../utils/registrationService';
import { subscribeToDataSync } from '../../utils/syncService';
import api from '../../utils/api';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  CalendarRange,
  Check,
  Copy,
  FileText,
  KeyRound,
  Layers,
  ListChecks,
  Megaphone,
  Plus,
  RefreshCw,
  Scale,
  Settings,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, PageHeader, Select, StatCard, Textarea, cn, stageTone, stageProgress, stagePhase, STAGE_ORDER, toneStyles } from '../../components/ui';

const phaseAccent = {
  active: "before:bg-gradient-to-b before:from-accent before:to-accent-2",
  upcoming: "before:bg-info/60",
  completed: "before:bg-line-strong",
};

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to live cross-dashboard changes
  useEffect(() => {
    return subscribeToDataSync(() => {
      setRefreshKey((k) => k + 1);
    });
  }, []);

  // Fetch hackathons
  const allHackathons = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getStoredHackathons();
  }, [refreshKey]);

  const userEmail = (user?.email || "organizer@hacktrack.io").toLowerCase().trim();
  const userId = user?.id;

  // Organizer Data Isolation: only show hackathons created by or assigned to this Organizer
  const displayedHackathons = useMemo(() => {
    return allHackathons.filter((h) => {
      const hEmail = (h.organizerEmail || "").toLowerCase().trim();
      if (hEmail && hEmail === userEmail) return true;
      if (userId && (h.createdBy === userId || (Array.isArray(h.assignedOrganizers) && h.assignedOrganizers.includes(userId)))) return true;
      if (h.organizers && h.organizers.some((o) => typeof o === 'string' && o.toLowerCase().includes(userEmail))) return true;
      if (userEmail === "organizer@hacktrack.io" && (h.id === "devpulse-2026" || h.id === "hack-001")) return true;
      return false;
    });
  }, [allHackathons, userEmail, userId]);

  const myHackathonIds = useMemo(() => new Set(displayedHackathons.map((h) => h.id)), [displayedHackathons]);

  const teams = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getAllTeams();
  }, [refreshKey]);

  const submissions = useMemo(() => {
    if (refreshKey) { /* trigger */ }
    return getSubmissions();
  }, [refreshKey]);

  // Data isolation: filter participant teams strictly to the Organizer's own hackathons
  const teamsList = useMemo(() => {
    return Object.entries(teams)
      .map(([code, t]) => ({ ...t, code }))
      .filter((t) => myHackathonIds.has(t.hackathonId));
  }, [teams, myHackathonIds]);

  // Data isolation: filter submissions strictly to the Organizer's own hackathons
  const mySubmissions = useMemo(() => {
    return submissions.filter((s) => myHackathonIds.has(s.hackathonId));
  }, [submissions, myHackathonIds]);

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
  const [judgeAssignEmail, setJudgeAssignEmail] = useState("judge@hacktrack.io");
  const [judgeAssignNotice, setJudgeAssignNotice] = useState(null);

  const openManageModal = (hackathon) => {
    setManageTarget(hackathon);
    setCopiedCode(null);
    setJudgeAssignNotice(null);
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

  const handleAssignJudge = (e) => {
    e.preventDefault();
    if (!manageTarget || !judgeAssignEmail.trim()) return;
    const cleanEmail = judgeAssignEmail.trim().toLowerCase();

    // Check if already bound
    const currentCommittee = getHackathonCommittee(manageTarget.id);
    const isAlreadyJudge = currentCommittee.judges.some((j) => (j.email || j.userId || '').toLowerCase() === cleanEmail);
    if (isAlreadyJudge) {
      setJudgeAssignNotice({ type: 'error', text: `Judge ${cleanEmail} is already assigned to this hackathon.` });
      return;
    }

    // Generate secure access code tied to judge role and hackathon
    const res = generateHackathonCode(manageTarget.id, 'judge', user?.email || "organizer@hacktrack.io");
    if (res.success) {
      // Save user assignment directly
      saveUserHackathonAssignment(cleanEmail, manageTarget.id);

      // Send private persisted notification to the intended Judge
      addNotification({
        userEmail: cleanEmail,
        title: `Judging Assignment: ${manageTarget.title}`,
        message: `You have been assigned by ${user?.fullName || "Organizer"} to evaluate submissions for "${manageTarget.title}". Your secure access code is: ${res.codeRecord.code}.`,
        type: "info",
        link: "/dashboard/judge"
      });

      setRefreshKey((k) => k + 1);
      setJudgeAssignNotice({
        type: 'success',
        text: `✓ Assigned ${cleanEmail} as Judge! Code ${res.codeRecord.code} sent via private notification.`
      });
      setNotice(`Judge ${cleanEmail} assigned to ${manageTarget.title}.`);
      setTimeout(() => setNotice(null), 4000);
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
    setNotice(`Evaluation rubrics updated for "${rubricTarget.title}".`);
    setTimeout(() => setNotice(null), 4000);
  };

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("all");
  const [notice, setNotice] = useState(null);

  // Presentation-only: drive Button `loading` while the async handlers run.
  const [creating, setCreating] = useState(false);
  const [savingRubrics, setSavingRubrics] = useState(false);

  const handleCreateHackathon = async (e) => {
    e.preventDefault();
    if (!newHackathon.title.trim()) return;

    const organizerEmail = user?.email || "organizer@hacktrack.io";
    const organizerName = user?.fullName || "Hackathon Organizer";
    const organizerUniversity = user?.university || "Host Institution";

    let backendHackathon = null;
    // 1. Try creating on backend API if authenticated
    if (api.getToken()) {
      try {
        const apiRes = await api.createHackathon({
          title: newHackathon.title.trim(),
          tagLine: newHackathon.headline.trim() || `${newHackathon.track} Innovation Sprint`,
          description: newHackathon.summary.trim(),
          status: 'published',
          registrationDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
          submissionDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
          minTeamSize: newHackathon.minTeamSize,
          maxTeamSize: newHackathon.maxTeamSize,
          hasScreeningRound: newHackathon.enabledModules.screeningGate,
          hasMentorship: newHackathon.enabledModules.mentorship,
        });
        if (apiRes?.hackathon) {
          backendHackathon = apiRes.hackathon;
          try {
            await api.publishHackathon(backendHackathon.id);
          } catch {
            // Already published
          }
        }
      } catch (err) {
        console.warn("API createHackathon fallback to local store:", err.message);
      }
    }

    // 2. Create in local persistent store with canonical backend ID
    const res = createNewHackathon({
      id: backendHackathon?.id || undefined,
      title: newHackathon.title.trim(),
      headline: newHackathon.headline.trim() || `${newHackathon.track} Innovation Sprint`,
      track: newHackathon.track,
      category: newHackathon.category,
      stage: "Registration Open",
      status: "published",
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

    if (res.success) {
      addNotification({
        userEmail: user?.email,
        title: "Hackathon Created Successfully",
        message: `Competition "${res.hackathon?.title || 'New Hackathon'}" has been published. Tracks and rubrics are active.`,
        type: "success",
        link: `/hackathons/${res.hackathon?.id || ''}`
      });
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
      setNotice(`Successfully published new hackathon: "${res.hackathon.title}"!`);
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
    addNotification({
      userEmail: user?.email,
      title: "Competition Settings Updated",
      message: `Configuration and dates for "${configTarget.title}" have been saved.`,
      type: "info",
      link: "/dashboard/organizer"
    });
    setRefreshKey((k) => k + 1);
    setNotice(`Settings updated for "${configTarget.title}".`);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleBroadcastAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    const targetIds = announcementTarget === "all"
      ? Array.from(myHackathonIds)
      : [announcementTarget];

    // Collect participants strictly from the selected hackathon(s)
    const regs = getRegistrations().filter((r) => targetIds.includes(r.hackathonId));
    const targetEmails = new Set(regs.map((r) => r.userId.toLowerCase().trim()));

    teamsList
      .filter((t) => targetIds.includes(t.hackathonId))
      .forEach((t) => {
        if (t.leadEmail) targetEmails.add(t.leadEmail.toLowerCase().trim());
        if (Array.isArray(t.members)) {
          t.members.forEach((m) => {
            const em = typeof m === 'string' ? m : m.email || m.userId;
            if (em && em.includes('@')) targetEmails.add(em.toLowerCase().trim());
          });
        }
      });

    // Send targeted notification to participants of these hackathons
    targetEmails.forEach((email) => {
      addNotification({
        userEmail: email,
        title: `Announcement: ${user?.fullName || "Organizer"}`,
        message: announcementText.trim(),
        type: "info",
        link: "/dashboard/student"
      });
    });

    // If backend token exists, also dispatch to backend endpoint for persistence
    try {
      const token = localStorage.getItem("hacktrack_token");
      if (token && targetIds.length > 0) {
        for (const hId of targetIds) {
          await fetch("http://localhost:5050/api/v1/admin/announcements", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              hackathonId: hId,
              title: `Announcement: ${user?.fullName || "Organizer"}`,
              content: announcementText.trim(),
              targetRole: "all"
            })
          });
        }
      }
    } catch {
      // Local notifications already persisted
    }

    setNotice(`Announcement broadcast to participants of your managed competition(s).`);
    setAnnouncementText("");
    setTimeout(() => setNotice(null), 4000);
  };

  const totalWeight = computeTotalWeight();
  const weightIsValid = Math.abs(totalWeight - 100) <= 1;

  const closeRubricEditor = () => {
    setRubricTarget(null);
    setRubricDraft([]);
  };

  const submitCreateHackathon = async (e) => {
    setCreating(true);
    try {
      await handleCreateHackathon(e);
    } finally {
      setCreating(false);
    }
  };

  const submitRubrics = async (e) => {
    setSavingRubrics(true);
    try {
      await handleSaveRubrics(e);
    } finally {
      setSavingRubrics(false);
    }
  };

  const toggleModule = (key) => (e) =>
    setNewHackathon({
      ...newHackathon,
      enabledModules: { ...newHackathon.enabledModules, [key]: e.target.checked },
    });

  const userEmailLower = user?.email?.toLowerCase();

  // Committee & access codes for the hackathon open in the "Codes & committee" dialog.
  // Re-read on every render so regenerated codes (refreshKey bump) show immediately.
  const committee = manageTarget ? getHackathonCommittee(manageTarget.id) : null;
  const judgeCodeRecord = committee ? (committee.codes || []).find((c) => c.role === "judge") : undefined;
  const screeningCodeRecord = committee ? (committee.codes || []).find((c) => c.role === "screening") : undefined;

  return (
    <DashboardLayout
      portalTitle="Organizer Operations Console"
      roleBadgeText="HACKATHON ORGANIZER"
    >
      <div className="space-y-8">
        <PageHeader
          icon={CalendarRange}
          eyebrow={user?.university || "DevPulse Operations Committee"}
          title="Organizer workspace"
          description="Create hackathons, manage stages and rubrics, follow team formation, and broadcast updates to participants."
          meta={<span>Signed in as {user?.fullName || "Organizer"}</span>}
          actions={
            <Button size="lg" onClick={() => setShowCreateModal(true)}>
              <Plus aria-hidden="true" />
              Create hackathon
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            tone="accent"
            label="My hackathons"
            value={displayedHackathons.length}
            icon={Trophy}
            hint="Active managed competitions"
          />
          <StatCard tone="info" label="Registered teams" value={teamsList.length} icon={Users} hint="Across your hackathons" />
          <StatCard tone="success" label="Submissions logged" value={mySubmissions.length} icon={FileText} hint="Across your hackathons" />
          <StatCard tone="cyan" label="Evaluation stages" value={displayedHackathons.filter(h => h.stage === 'Rubric Judging' || h.stage === 'Screening Gate').length} icon={Layers} hint="Currently in review" />
        </div>

        {notice && (
          <Alert tone="success" className="items-center">
            <div className="flex items-center justify-between gap-3">
              <span className="text-fg">{notice}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setNotice(null)}
                aria-label="Dismiss notice"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </Alert>
        )}

        <div className="space-y-8">
          {/* Hackathons */}
          <section className="space-y-4" aria-labelledby="org-hackathons-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionHeading
                id="org-hackathons-heading"
                icon={CalendarRange}
                title="Hackathons"
                description="Lifecycle stages, rubrics and team allowances."
              />
              <Badge tone="accent">{displayedHackathons.length} managed</Badge>
            </div>

            {displayedHackathons.length === 0 ? (
              <Card>
                <EmptyState
                  illustration="calendar"
                  icon={Trophy}
                  title="No hackathons yet"
                  description="You haven't created any hackathons yet. Create one to open registration and start configuring rubrics."
                  action={
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus aria-hidden="true" />
                      Create your first hackathon
                    </Button>
                  }
                />
              </Card>
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Hackathon events">
                {displayedHackathons.map((h) => {
                  const sprintTeams = teamsList.filter((t) => t.hackathonId === h.id);
                  const sprintSubs = mySubmissions.filter((s) => s.hackathonId === h.id);

                  const isMine = (h.organizerEmail && h.organizerEmail.toLowerCase() === userEmailLower) ||
                                 (user?.email === "organizer@hacktrack.io" && h.id === "devpulse-2026");

                  // Presentation only: shared lifecycle helpers (same bar on every dashboard).
                  const stageIndex = STAGE_ORDER.indexOf(h.stage);
                  const progress = stageProgress(h.stage);
                  const phase = stagePhase(h.stage);
                  const completed = phase === "completed";

                  return (
                    <li key={h.id} className="min-w-0">
                      <Card
                        as="article"
                        aria-labelledby={`org-event-${h.id}`}
                        className={cn(
                          "relative flex h-full flex-col overflow-hidden",
                          "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:content-['']",
                          phaseAccent[phase],
                          completed && "bg-none bg-sunken/60"
                        )}
                      >
                        <EventCover hackathon={h} muted={completed} className="h-20 w-full border-b border-line" />
                        <div className="flex flex-1 flex-col gap-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1.5">
                              <h3
                                id={`org-event-${h.id}`}
                                className={cn(
                                  "break-words text-base font-semibold leading-snug",
                                  completed ? "text-fg-muted" : "text-fg"
                                )}
                              >
                                {h.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge>{h.category || h.track}</Badge>
                                {isMine && <Badge tone="accent">Managed by you</Badge>}
                              </div>
                            </div>
                            <Badge tone={stageTone(h.stage)} dot className="shrink-0">{h.stage}</Badge>
                          </div>

                          <p className="text-xs text-fg-subtle">
                            {h.organizerName || "Central Committee"} · Teams of {h.teamSize || "2 - 4"}
                          </p>

                          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line text-sm">
                            <div className="col-span-2 flex items-start gap-2 bg-raised/80 px-3 py-2.5">
                              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                              <div className="min-w-0">
                                <dt className="text-xs text-fg-subtle">Deadline</dt>
                                <dd className="font-medium text-fg">{h.deadline}</dd>
                                {h.dates && <dd className="text-xs text-fg-muted">{h.dates}</dd>}
                              </div>
                            </div>
                            <div className="bg-raised/80 px-3 py-2.5">
                              <dt className="text-xs text-fg-subtle">Teams</dt>
                              <dd className="text-lg font-semibold tabular-nums text-fg">{sprintTeams.length}</dd>
                            </div>
                            <div className="bg-raised/80 px-3 py-2.5">
                              <dt className="text-xs text-fg-subtle">Submissions</dt>
                              <dd className="text-lg font-semibold tabular-nums text-fg">{sprintSubs.length}</dd>
                            </div>
                          </dl>

                          <div className="mt-auto space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-fg-subtle">Lifecycle</span>
                              <span className="tabular-nums text-fg-muted">
                                {stageIndex > 0 ? `Stage ${stageIndex} of ${STAGE_ORDER.length - 1}` : "Not started"}
                              </span>
                            </div>
                            <div
                              className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
                              role="progressbar"
                              aria-label={`Lifecycle progress for ${h.title}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={progress}
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full transition-[width] duration-500",
                                  completed ? "bg-fg-subtle/50" : "bg-gradient-to-r from-accent to-accent-2"
                                )}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div
                          role="group"
                          aria-label={`Actions for ${h.title}`}
                          className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3"
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openManageModal(h)}
                            aria-label={`Codes & committee for ${h.title}`}
                            title="Manage judge & screening access codes"
                          >
                            <KeyRound aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setConfigTarget(h)}
                            aria-label={`Settings for ${h.title}`}
                            title="Settings"
                          >
                            <Settings aria-hidden="true" />
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => openRubricEditor(h)}>
                            <ListChecks aria-hidden="true" />
                            Rubrics <span className="tabular-nums">({(h.rubrics || []).length})</span>
                          </Button>
                          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => handleAdvance(h.id)}>
                            Advance stage
                            <ArrowRight aria-hidden="true" />
                          </Button>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Announcements + teams */}
          <div className="hairline-gradient" aria-hidden="true" />
          <aside className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start" aria-label="Communication and participants">
            <Card>
              <CardHeader className="flex-row items-start gap-3">
                <IconTile icon={Megaphone} tone="info" />
                <div className="min-w-0 space-y-0.5">
                  <CardTitle as="h2">Broadcast announcement</CardTitle>
                  <CardDescription>Pushed to participants' notifications in real time.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBroadcastAnnouncement} className="space-y-4">
                  <Field label="Target competition">
                    <Select
                      value={announcementTarget}
                      onChange={(e) => setAnnouncementTarget(e.target.value)}
                    >
                      <option value="all">All Managed Competitions</option>
                      {displayedHackathons.map((h) => (
                        <option key={h.id} value={h.id}>{h.title}</option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Message" required>
                    <Textarea
                      rows={4}
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="e.g. Submissions deadline has been extended by 2 hours. Screening starts promptly at 22:00 UTC."
                    />
                  </Field>

                  <Button type="submit" className="w-full">
                    <Megaphone aria-hidden="true" />
                    Send announcement
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start gap-3">
                <IconTile icon={Users} tone="cyan" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <CardTitle as="h2">Participant teams</CardTitle>
                  <CardDescription>Teams registered for your managed competitions.</CardDescription>
                </div>
                <Badge className="shrink-0 tabular-nums">{teamsList.length} registered</Badge>
              </CardHeader>
              <CardContent>
                {teamsList.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-fg-muted">No teams have registered yet.</p>
                ) : (
                  <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg bg-raised/50 px-3 py-2.5">
                    {teamsList.map((t) => (
                      <li key={t.code} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">{t.name}</p>
                          <p className="text-xs text-fg-subtle">
                            <span className="font-mono text-accent-text">{t.code}</span>
                            {t.capacity ? <> · {t.capacity}</> : null}
                          </p>
                        </div>
                        {t.hackathon && (
                          <span className="max-w-[40%] truncate text-xs text-fg-subtle" title={t.hackathon}>
                            {t.hackathon}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Dialog: Create New Hackathon */}
        <Dialog
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create hackathon"
          description={`Organizer: ${user?.fullName || "Kavita Rao"} (${user?.university || "DevPulse Operations"})`}
          size="xl"
        >
          <form onSubmit={submitCreateHackathon} className="space-y-6">
            <FormSection icon={FileText} title="Basics">
              <Field label="Hackathon title" required>
                <Input
                  type="text"
                  placeholder="e.g. NextGen FinTech Challenge 2026"
                  value={newHackathon.title}
                  onChange={(e) => setNewHackathon({ ...newHackathon, title: e.target.value })}
                />
              </Field>
              <Field label="Headline / tagline" hint="Defaults to the track name if left blank.">
                <Input
                  type="text"
                  placeholder="e.g. Autonomous Agents, Open Banking & Zero-Knowledge Verification"
                  value={newHackathon.headline}
                  onChange={(e) => setNewHackathon({ ...newHackathon, headline: e.target.value })}
                />
              </Field>
              <Field label="Summary / problem statement">
                <Textarea
                  rows={3}
                  placeholder="Describe the challenge goals, problem statements, and target deliverables..."
                  value={newHackathon.summary}
                  onChange={(e) => setNewHackathon({ ...newHackathon, summary: e.target.value })}
                />
              </Field>
            </FormSection>

            <FormSection icon={CalendarClock} title="Schedule & prize">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Registration deadline">
                  <Input
                    type="text"
                    placeholder="e.g. Nov 25, 2026"
                    value={newHackathon.registrationDeadline}
                    onChange={(e) => setNewHackathon({ ...newHackathon, registrationDeadline: e.target.value })}
                  />
                </Field>
                <Field label="Submission deadline" required>
                  <Input
                    type="text"
                    placeholder="e.g. Nov 30, 2026"
                    value={newHackathon.submissionDeadline}
                    onChange={(e) => setNewHackathon({ ...newHackathon, submissionDeadline: e.target.value })}
                  />
                </Field>
                <Field label="Prize pool">
                  <Input
                    type="text"
                    placeholder="$15,000 USD"
                    value={newHackathon.prize}
                    onChange={(e) => setNewHackathon({ ...newHackathon, prize: e.target.value })}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon={Users} title="Teams">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Min team size">
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    className="font-mono tabular-nums"
                    value={newHackathon.minTeamSize}
                    onChange={(e) => setNewHackathon({ ...newHackathon, minTeamSize: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Max team size">
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    className="font-mono tabular-nums"
                    value={newHackathon.maxTeamSize}
                    onChange={(e) => setNewHackathon({ ...newHackathon, maxTeamSize: Number(e.target.value) })}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon={Layers} title="Track & modules">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Domain / track" required>
                  <Select
                    value={newHackathon.track}
                    onChange={(e) => setNewHackathon({ ...newHackathon, track: e.target.value })}
                  >
                    <option value="Full-Stack & Cloud Systems">Full-Stack & Cloud Systems</option>
                    <option value="Applied Machine Learning & Agents">Applied Machine Learning & Agents</option>
                    <option value="IoT & Campus Optimization">IoT & Campus Optimization</option>
                    <option value="Cybersecurity & Zero Trust">Cybersecurity & Zero Trust</option>
                    <option value="FinTech & Decentralized Systems">FinTech & Decentralized Systems</option>
                    <option value="Open Innovation">Open Innovation</option>
                  </Select>
                </Field>
                <Field label="Category">
                  <Select
                    value={newHackathon.category}
                    onChange={(e) => setNewHackathon({ ...newHackathon, category: e.target.value })}
                  >
                    <option value="Full-Stack">Full-Stack</option>
                    <option value="AI & ML">AI & ML</option>
                    <option value="IoT">IoT</option>
                    <option value="FinTech">FinTech</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                  </Select>
                </Field>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-fg">Enabled lifecycle modules</legend>
                <p className="text-xs text-fg-subtle">Rubrics can be configured per hackathon after it is published.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ModuleCheckbox
                    label="Screening committee gate"
                    checked={newHackathon.enabledModules.screeningGate}
                    onChange={toggleModule("screeningGate")}
                  />
                  <ModuleCheckbox
                    label="Rubric judging"
                    checked={newHackathon.enabledModules.rubricJudging}
                    onChange={toggleModule("rubricJudging")}
                  />
                  <ModuleCheckbox
                    label="Mentor consultations"
                    checked={newHackathon.enabledModules.mentorship}
                    onChange={toggleModule("mentorship")}
                  />
                  <ModuleCheckbox
                    label="Automated certificates"
                    checked={newHackathon.enabledModules.certificates}
                    onChange={toggleModule("certificates")}
                  />
                </div>
              </fieldset>
            </FormSection>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Publish hackathon
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Dialog: Edit Settings */}
        <Dialog
          open={Boolean(configTarget)}
          onClose={() => setConfigTarget(null)}
          title={configTarget ? `Settings: ${configTarget.title}` : "Settings"}
          size="md"
        >
          {configTarget && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <FormSection icon={Settings} title="Prize & team rules">
                <Field label="Prize pool">
                  <Input
                    type="text"
                    value={configTarget.prizePool || ""}
                    onChange={(e) => setConfigTarget({ ...configTarget, prizePool: e.target.value })}
                  />
                </Field>
                <Field label="Team size allowance">
                  <Input
                    type="text"
                    value={configTarget.teamSize || ""}
                    onChange={(e) => setConfigTarget({ ...configTarget, teamSize: e.target.value })}
                  />
                </Field>
              </FormSection>
              <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setConfigTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          )}
        </Dialog>

        {/* Dialog: Rubric Editor */}
        <Dialog
          open={Boolean(rubricTarget)}
          onClose={closeRubricEditor}
          title="Evaluation rubrics"
          description={rubricTarget ? `Configure scoring criteria for ${rubricTarget.title}.` : undefined}
          size="xl"
          className="max-w-3xl"
        >
          {rubricTarget && (
            <form onSubmit={submitRubrics} className="space-y-5">
              {/* Weight summary */}
              <div className="space-y-2 rounded-lg bg-raised/50 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-fg-muted">Total weight</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      weightIsValid ? "text-success" : "text-danger"
                    )}
                  >
                    {totalWeight.toFixed(0)}% / 100%
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-sunken"
                  role="progressbar"
                  aria-label="Total rubric weight"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(Math.round(totalWeight), 100)}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      weightIsValid ? "bg-success" : totalWeight > 100 ? "bg-danger" : "bg-warning"
                    )}
                    style={{ width: `${Math.min(totalWeight, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-fg-subtle">Weights must add up to 100% before saving.</p>
              </div>

              {rubricError && <Alert tone="danger">{rubricError}</Alert>}

              {/* Criteria */}
              <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                <IconTile icon={ListChecks} size="sm" />
                Evaluation criteria
              </p>
              {rubricDraft.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-fg-muted">
                  No criteria yet. Add one below or start from a template.
                </p>
              ) : (
                <ol className="space-y-3">
                  {rubricDraft.map((r, idx) => (
                    <li key={r._key} className="space-y-3 rounded-lg bg-raised/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-fg-subtle">Criterion {idx + 1}</span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => moveRubricRow(idx, -1)}
                            disabled={idx === 0}
                            aria-label={`Move criterion ${idx + 1} up`}
                            title="Move up"
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => moveRubricRow(idx, 1)}
                            disabled={idx === rubricDraft.length - 1}
                            aria-label={`Move criterion ${idx + 1} down`}
                            title="Move down"
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            variant="danger-ghost"
                            size="icon-sm"
                            onClick={() => removeRubricRow(r._key)}
                            aria-label={`Delete criterion ${idx + 1}`}
                            title="Delete criterion"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <Field label="Name" required className="sm:col-span-5">
                          <Input
                            type="text"
                            value={r.name}
                            onChange={(e) => updateRubricRow(r._key, "name", e.target.value)}
                            placeholder="e.g. Technical Depth & Architecture"
                          />
                        </Field>
                        <Field label="Weight" required className="sm:col-span-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={r.weight}
                            onChange={(e) => updateRubricRow(r._key, "weight", e.target.value)}
                            placeholder="30%"
                            className="text-center font-mono tabular-nums"
                          />
                        </Field>
                        <Field label="Description" className="sm:col-span-5">
                          <Input
                            type="text"
                            value={r.desc}
                            onChange={(e) => updateRubricRow(r._key, "desc", e.target.value)}
                            placeholder="What judges should evaluate..."
                          />
                        </Field>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <Button variant="secondary" className="w-full" onClick={addRubricRow}>
                <Plus aria-hidden="true" />
                Add evaluation criterion
              </Button>

              {/* Preset templates */}
              <div className="space-y-2 border-t border-line pt-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <IconTile icon={Layers} size="sm" />
                  Quick templates
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRubricDraft([
                      { _key: "t1", name: "Innovation & Novelty", weight: "25%", desc: "Originality and creativity of the proposed solution." },
                      { _key: "t2", name: "Technical Execution", weight: "25%", desc: "Code quality, architecture, and technical completeness." },
                      { _key: "t3", name: "UI/UX Design", weight: "25%", desc: "User interface elegance, usability, and accessibility." },
                      { _key: "t4", name: "Real-world Feasibility", weight: "25%", desc: "Scalability, business viability, and practical impact." },
                    ])}
                  >
                    Standard (4 criteria × 25%)
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRubricDraft([
                      { _key: "a1", name: "Agent Autonomy & Intelligence", weight: "35%", desc: "Robustness of multi-step planning and tool usage." },
                      { _key: "a2", name: "Novelty & System Utility", weight: "25%", desc: "Uniqueness compared to existing commercial tools." },
                      { _key: "a3", name: "Execution & Engineering", weight: "25%", desc: "API resilience, error fallbacks, and response latency." },
                      { _key: "a4", name: "Responsible AI Standards", weight: "15%", desc: "Guardrails, toxicity filtering, dataset attribution." },
                    ])}
                  >
                    AI / ML focus
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRubricDraft([
                      { _key: "h1", name: "Hardware & Telemetry Quality", weight: "35%", desc: "Sensor fidelity, data transmission, battery efficiency." },
                      { _key: "h2", name: "Practical Impact", weight: "30%", desc: "Cost savings or tangible benefits to operations." },
                      { _key: "h3", name: "Dashboard & Interface Design", weight: "20%", desc: "Clarity of visualizations and alerting responsiveness." },
                      { _key: "h4", name: "Scalability & Viability", weight: "15%", desc: "Ease of deployment across environments." },
                    ])}
                  >
                    IoT / hardware
                  </Button>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={closeRubricEditor}>
                  Cancel
                </Button>
                <Button type="submit" loading={savingRubrics}>
                  Save rubrics
                </Button>
              </div>
            </form>
          )}
        </Dialog>

        {/* Dialog: Committee & Access Codes Management */}
        <Dialog
          open={Boolean(manageTarget)}
          onClose={() => setManageTarget(null)}
          title={manageTarget ? manageTarget.title : "Codes & committee"}
          description={manageTarget ? `Access codes & committee · ${manageTarget.stage}` : undefined}
          size="xl"
          className="max-w-3xl"
        >
          {manageTarget && committee && (
            <div className="space-y-5">
              {/* Explanatory banner: Screening vs Judges */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1 rounded-lg bg-raised/50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Screening Committee (Gatekeeper)
                  </p>
                  <p className="text-xs leading-relaxed text-fg-muted">
                    Operates <strong className="text-fg">first</strong> right after submission deadline. Verifies commit
                    authenticity, documentation, live URL. Makes binary decision:{" "}
                    <strong className="text-fg">Shortlist</strong> or <strong className="text-fg">Reject</strong>.
                  </p>
                </div>
                <div className="space-y-1 rounded-lg bg-raised/50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-info">
                    <Scale className="h-4 w-4" aria-hidden="true" />
                    Judges (Final Scoring)
                  </p>
                  <p className="text-xs leading-relaxed text-fg-muted">
                    Operates <strong className="text-fg">second</strong> after screening. Evaluates{" "}
                    <em>only shortlisted</em> teams against your configured rubrics (
                    {manageTarget.rubrics?.length || 4} criteria) to determine final rank and leaderboard.
                  </p>
                </div>
              </div>

              {/* Access code sections */}
              <AccessCodeSection
                icon={ShieldCheck}
                tone="warning"
                title="Screening committee access code"
                badge="Shortlisting"
                description="Share this code with committee reviewers. They enter it once on their dashboard to unlock this hackathon."
                code={screeningCodeRecord?.code}
                copied={Boolean(screeningCodeRecord?.code) && copiedCode === screeningCodeRecord?.code}
                onCopy={() => handleCopyCode(screeningCodeRecord?.code)}
                onRegenerate={() => handleRegenerateCode('screening')}
                rosterLabel="Bound screening reviewers"
                members={committee.screeners}
                fallbackName="Screening Reviewer"
                emptyText="No screeners have redeemed this code yet. Share the code above."
              />

              <AccessCodeSection
                icon={Scale}
                tone="info"
                title="Judge access code"
                badge="Final Rubric Scoring"
                description="Share this code with your evaluators. They enter it once on their Judge dashboard to score submissions against your rubrics."
                code={judgeCodeRecord?.code}
                copied={Boolean(judgeCodeRecord?.code) && copiedCode === judgeCodeRecord?.code}
                onCopy={() => handleCopyCode(judgeCodeRecord?.code)}
                onRegenerate={() => handleRegenerateCode('judge')}
                rosterLabel="Bound judges / evaluators"
                members={committee.judges}
                fallbackName="Judge Evaluator"
                emptyText="No judges have redeemed this code yet. Share the code above."
              />

              {/* Direct Judge Assignment Form */}
              <div className="rounded-lg border border-line bg-raised/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <IconTile icon={UserPlus} tone="info" size="sm" />
                  <div>
                    <h3 className="text-sm font-semibold text-fg">Assign Judge Directly</h3>
                    <p className="text-xs text-fg-muted">Invite a registered judge to evaluate submissions for this competition.</p>
                  </div>
                </div>

                {judgeAssignNotice && (
                  <Alert tone={judgeAssignNotice.type === 'error' ? 'danger' : 'success'}>
                    {judgeAssignNotice.text}
                  </Alert>
                )}

                <form onSubmit={handleAssignJudge} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field label="Judge email address" className="flex-1">
                    <Input
                      type="email"
                      value={judgeAssignEmail}
                      onChange={(e) => setJudgeAssignEmail(e.target.value)}
                      placeholder="e.g. judge@hacktrack.io"
                      required
                    />
                  </Field>
                  <Button type="submit">
                    <UserPlus aria-hidden="true" />
                    Assign & send code
                  </Button>
                </form>
              </div>

              {/* Footer controls */}
              <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const h = manageTarget;
                      setManageTarget(null);
                      openRubricEditor(h);
                    }}
                  >
                    <ListChecks aria-hidden="true" />
                    Edit rubrics <span className="tabular-nums">({(manageTarget.rubrics || []).length})</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const h = manageTarget;
                      setManageTarget(null);
                      setConfigTarget(h);
                    }}
                  >
                    <Settings aria-hidden="true" />
                    Hackathon rules & settings
                  </Button>
                </div>
                <Button onClick={() => setManageTarget(null)}>Done</Button>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

const sectionToneText = { warning: 'text-warning', info: 'text-info' };

/** One role's access code: copy / regenerate controls plus the roster of reviewers bound to it. */
function AccessCodeSection({
  icon: Icon,
  tone,
  title,
  badge,
  description,
  code,
  copied,
  onCopy,
  onRegenerate,
  rosterLabel,
  members,
  fallbackName,
  emptyText,
}) {
  return (
    <section className="space-y-3 rounded-lg border border-line p-4" aria-label={title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn('flex items-center gap-2 text-sm font-semibold', sectionToneText[tone])}>
              <IconTile icon={Icon} tone={tone} size="sm" />
              {title}
            </h3>
            <Badge tone={tone}>{badge}</Badge>
          </div>
          <p className="text-xs text-fg-muted">{description}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRegenerate} className="self-start">
          <RefreshCw aria-hidden="true" />
          Regenerate
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div
          className={cn(
            'min-w-0 flex-1 break-all rounded-lg border border-line bg-sunken px-3.5 py-2 font-mono text-sm font-semibold tracking-wider',
            code ? 'text-fg' : 'text-fg-subtle'
          )}
        >
          {code || "NOT GENERATED"}
        </div>
        <Button
          variant={copied ? "secondary" : "primary"}
          size="sm"
          onClick={onCopy}
          disabled={!code}
          title={code ? undefined : "Generate a code first"}
          className={cn('sm:h-auto', copied && 'text-success')}
          aria-label={copied ? `${title} copied` : `Copy ${title.toLowerCase()}`}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied!" : "Copy code"}
        </Button>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "Code copied to clipboard" : ""}
        </span>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          {rosterLabel} <span className="tabular-nums">({members.length})</span>
        </p>
        {members.length === 0 ? (
          <p className="text-xs italic text-fg-subtle">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg bg-raised/50">
            {members.map((m, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{m.fullName || fallbackName}</p>
                  <p className="break-all font-mono text-xs text-fg-subtle">{m.email}</p>
                </div>
                <Badge tone="success" dot>Active</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Small tinted icon tile used by every section heading on this page. */
function IconTile({ icon: Icon, tone = 'accent', size = 'md' }) {
  const t = toneStyles[tone] || toneStyles.accent;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center ring-1 ring-inset',
        size === 'sm' ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg',
        t.tile
      )}
      aria-hidden="true"
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  );
}

/** Page-level section heading: icon tile + title + one-line description. */
function SectionHeading({ id, icon, tone, title, description }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0 space-y-0.5">
        <h2 id={id} className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
    </div>
  );
}

/** Titled group of fields inside the create-hackathon / settings forms. */
function FormSection({ icon, title, children }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-4 flex w-full items-center gap-2 text-sm font-semibold text-fg">
        {icon && <IconTile icon={icon} size="sm" />}
        {title}
      </legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

/** Checkbox row for a lifecycle module toggle. */
function ModuleCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-raised/50 px-3 py-2.5 text-sm text-fg transition-colors hover:bg-raised">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-line accent-accent"
      />
      <span>{label}</span>
    </label>
  );
}
