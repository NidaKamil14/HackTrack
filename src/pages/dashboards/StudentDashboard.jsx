import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, Bell, CalendarDays, Check, CheckCircle2, ClipboardCheck, Clock, Compass, Copy, FileText, Flag, FolderOpen, Gavel, KeyRound, Link2, Lock, LockOpen, Paperclip, Printer, Rocket, ShieldCheck, Trophy, Upload, UserPlus, Users, X, Mail } from 'lucide-react';
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
import { getUserRegistrations, registerForHackathon, isUserRegistered, normalizeHackathonId } from '../../utils/registrationService';
import { triggerDataSync } from '../../utils/syncService';
import api from '../../utils/api';
import {
  getUserTeamForHackathon,
  createTeam,
  saveTeam,
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
import { getUserNotifications, markAsRead, markAllAsRead, addNotification } from '../../utils/notificationService';
import { subscribeToDataSync } from '../../utils/syncService';

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

/** Robust hackathon identity matching across canonical IDs, slug aliases, and titles */
function matchHackathon(idA, idB, titleA, titleB) {
  if (!idA && !idB) return false;
  if (idA && idB) {
    if (String(idA).toLowerCase().trim() === String(idB).toLowerCase().trim()) return true;
    const normA = normalizeHackathonId(idA);
    const normB = normalizeHackathonId(idB);
    if (normA && normB && normA.toLowerCase() === normB.toLowerCase()) return true;
    const cleanA = String(idA).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanB = String(idB).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanA && cleanB && cleanA === cleanB) return true;
    if (cleanA && cleanB && cleanA.length >= 6 && cleanB.length >= 6) {
      if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    }
  }
  if (titleA && titleB) {
    const cleanTitleA = String(titleA).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitleB = String(titleB).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTitleA && cleanTitleB && cleanTitleA === cleanTitleB) return true;
    if (cleanTitleA && cleanTitleB && cleanTitleA.length >= 6 && cleanTitleB.length >= 6) {
      if (cleanTitleA.includes(cleanTitleB) || cleanTitleB.includes(cleanTitleA)) return true;
    }
  }
  if (idA && titleB) {
    const cleanA = String(idA).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanB = String(titleB).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanA && cleanB && cleanA === cleanB) return true;
    if (cleanA && cleanB && cleanA.length >= 6 && cleanB.length >= 6) {
      if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    }
  }
  if (titleA && idB) {
    const cleanA = String(titleA).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanB = String(idB).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanA && cleanB && cleanA === cleanB) return true;
    if (cleanA && cleanB && cleanA.length >= 6 && cleanB.length >= 6) {
      if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    }
  }
  return false;
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

  // Active dashboard tab (synced to ?tab=, falls back to role-appropriate initialTab)
  const isLeaderRole = user?.role === "leader";
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const allowedTabValues = isLeaderRole ? TAB_VALUES : TAB_VALUES.filter((t) => t !== "workspace");
  const defaultTab = isLeaderRole ? initialTab : (initialTab === "workspace" ? "roster" : initialTab);
  const activeTab = allowedTabValues.includes(tabParam) ? tabParam : defaultTab;
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

  useEffect(() => {
    return subscribeToDataSync(() => {
      setRefreshKey((k) => k + 1);
    });
  }, []);

  // Notifications state and server merging
  const [serverNotifications, setServerNotifications] = useState([]);

  useEffect(() => {
    if (!api.getToken() || !user) return;
    let cancelled = false;
    api.getNotifications()
      .then((res) => {
        if (!cancelled && Array.isArray(res?.notifications)) {
          setServerNotifications(
            res.notifications.map((n) => ({
              id: n.id,
              userEmail: userEmail,
              title: n.title,
              message: n.message,
              type: n.category === 'announcement' ? 'info' : n.type === 'error' ? 'warning' : 'success',
              date: new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              read: n.isRead,
              link: n.link || '/dashboard/student',
              isServer: true,
            }))
          );
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, userEmail, refreshKey]);

  const notifications = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    const local = getUserNotifications(user || userEmail);
    const merged = [...serverNotifications];
    local.forEach((loc) => {
      const exists = merged.some(
        (m) => m.id === loc.id || (m.title === loc.title && m.message === loc.message)
      );
      if (!exists) merged.push(loc);
    });
    return merged;
  }, [user, userEmail, refreshKey, serverNotifications]);
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  // Certificates
  const certificates = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    return getUserCertificates(userEmail);
  }, [userEmail, refreshKey]);

  // Server hackathons state
  const [serverHackathons, setServerHackathons] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.getHackathons()
      .then((res) => {
        if (!cancelled && Array.isArray(res?.hackathons)) {
          setServerHackathons(res.hackathons);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  // All hackathons from service & backend API
  const allHackathons = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    const local = getStoredHackathons();
    if (!serverHackathons.length) return local;

    const combined = [...local];
    serverHackathons.forEach((sh) => {
      const idx = combined.findIndex((h) => h.id === sh.id || h.title?.toLowerCase() === sh.title?.toLowerCase());
      const normalized = {
        id: sh.id,
        title: sh.title,
        headline: sh.tagLine || `${sh.title} Innovation Sprint`,
        deadline: sh.submissionDeadline ? new Date(sh.submissionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "TBD",
        dates: `${sh.startDate ? new Date(sh.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} - ${sh.endDate ? new Date(sh.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`,
        stage: sh.isRegistrationClosed ? "Registration Closed" : "Registration Open",
        status: sh.status,
        isRegistrationClosed: sh.isRegistrationClosed,
        registrationDeadline: sh.registrationDeadline,
        submissionDeadline: sh.submissionDeadline,
        track: sh.track || "General Track",
        category: sh.category || "Full-Stack",
        teamSize: `${sh.minTeamSize || 1} - ${sh.maxTeamSize || 4} Members`,
        summary: sh.description || sh.summary || `Official ${sh.title} competition.`,
      };
      if (idx >= 0) {
        combined[idx] = { ...combined[idx], ...normalized, id: sh.id };
      } else {
        combined.push(normalized);
      }
    });
    return combined;
  }, [refreshKey, serverHackathons]);

  // Available open hackathons for team creation & discovery
  const availableOpenHackathons = useMemo(() => {
    return allHackathons.filter((h) => {
      if (h.status && h.status !== 'published') return false;
      if (h.isRegistrationClosed) return false;
      if (h.registrationDeadline && new Date() > new Date(h.registrationDeadline)) return false;
      return true;
    });
  }, [allHackathons]);

  // Registrations
  const registrations = useMemo(() => {
    if (refreshKey) { /* trigger re-eval */ }
    return getUserRegistrations(userEmail);
  }, [userEmail, refreshKey]);

  const [selectedHackathonId, setSelectedHackathonId] = useState(null);

  // New team formation state
  const [newTeamName, setNewTeamName] = useState("");
  const [createTeamHackathonId, setCreateTeamHackathonId] = useState("");
  const [teamActionFeedback, setTeamActionFeedback] = useState(null);
  const [teamActionLoading, setTeamActionLoading] = useState(false);

  // Join team state
  const [joinCode, setJoinCode] = useState("");

  // Backend API teams & pending requests
  const [apiTeamsData, setApiTeamsData] = useState({ teams: [], pendingRequests: [], loaded: false });

  useEffect(() => {
    if (!api.getToken()) return;
    let isMounted = true;
    api.getMyTeams()
      .then((data) => {
        if (isMounted && data) {
          setApiTeamsData({
            teams: data.teams || [],
            pendingRequests: data.pendingRequests || [],
            loaded: true,
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load teams from API:', err.message);
      });
    return () => { isMounted = false; };
  }, [refreshKey, userEmail]);

  // Combine user registration records with hackathons metadata
  const registeredHackathons = useMemo(() => {
    return registrations.map((reg) => {
      const meta = allHackathons.find((h) =>
        matchHackathon(h.id, reg.hackathonId, h.title, reg.hackathonTitle)
      ) || {
        id: normalizeHackathonId(reg.hackathonId) || reg.hackathonId,
        title: reg.hackathonTitle || reg.hackathonId,
        track: "General Track",
        dates: "Dates Announced Soon",
        deadline: "TBD"
      };
      const team = getUserTeamForHackathon(userEmail, meta.id) || getUserTeamForHackathon(userEmail, reg.hackathonId);
      return {
        ...meta,
        registrationStatus: reg.status,
        registrationDate: reg.registrationDate,
        team
      };
    });
  }, [registrations, allHackathons, userEmail]);

  const activeSprint = useMemo(() => {
    if (selectedHackathonId) {
      const foundInReg = registeredHackathons.find((h) =>
        matchHackathon(h.id, selectedHackathonId, h.title)
      );
      if (foundInReg) return foundInReg;

      const foundInAll = allHackathons.find((h) =>
        matchHackathon(h.id, selectedHackathonId, h.title)
      );
      if (foundInAll) return foundInAll;
    }
    return registeredHackathons[0] || allHackathons[0] || null;
  }, [selectedHackathonId, registeredHackathons, allHackathons]);

  // 1. Backend team from MySQL API
  const backendTeam = useMemo(() => {
    if (!activeSprint || !apiTeamsData.loaded) return null;
    return apiTeamsData.teams.find((t) =>
      matchHackathon(t.hackathonId, activeSprint.id, t.hackathonTitle, activeSprint.title)
    );
  }, [activeSprint, apiTeamsData]);

  // 2. Pending join request for this sprint
  const pendingJoinRequest = useMemo(() => {
    if (!activeSprint || !apiTeamsData.loaded) return null;
    return apiTeamsData.pendingRequests.find((p) =>
      matchHackathon(p.hackathonId, activeSprint.id, p.hackathonTitle, activeSprint.title)
    );
  }, [activeSprint, apiTeamsData]);

  // Local fallback
  const localTeam = useMemo(() => {
    if (refreshKey) { /* trigger re-eval on sync */ }
    if (!activeSprint) return null;
    return (
      getUserTeamForHackathon(userEmail, activeSprint.id) ||
      getUserTeamForHackathon(userEmail, normalizeHackathonId(activeSprint.id))
    );
  }, [activeSprint, userEmail, refreshKey]);

  const currentTeam = useMemo(() => {
    if (backendTeam) {
      const activeMembers = (backendTeam.members || []).filter(
        (m) => m.status === 'accepted' || m.role === 'leader'
      );
      const pendingMembers = (backendTeam.members || []).filter(
        (m) => m.status === 'pending'
      );
      const leaderMember = backendTeam.members?.find((m) => m.role === 'leader');
      const resolvedLeadName = leaderMember?.userName || backendTeam.lead || user?.fullName || 'Team Leader';
      const resolvedLeadEmail = leaderMember?.userEmail || backendTeam.leadEmail || userEmail;

      const resolvedMembers = activeMembers.length > 0 ? activeMembers.map((m) => ({
        id: m.id,
        name: m.userName || m.name,
        email: m.userEmail || m.email,
        role: m.role === 'leader' ? 'Team Leader' : 'Member',
        status: 'Active',
        university: m.userUniversity || '',
      })) : [
        {
          id: user?.id || 'usr-leader',
          name: resolvedLeadName,
          email: resolvedLeadEmail,
          role: 'Team Leader',
          status: 'Active',
          university: user?.university || '',
        }
      ];

      return {
        id: backendTeam.id,
        name: backendTeam.teamName || backendTeam.name,
        code: backendTeam.teamCode || backendTeam.code,
        hackathon: backendTeam.hackathonTitle || activeSprint?.title,
        hackathonId: backendTeam.hackathonId,
        track: backendTeam.track || activeSprint?.track || 'General Track',
        lead: resolvedLeadName,
        leadEmail: resolvedLeadEmail,
        leaderId: backendTeam.leaderId,
        rosterLocked: Boolean(backendTeam.rosterLocked),
        members: resolvedMembers,
        pendingRequests: pendingMembers.map((m) => ({
          id: m.id,
          name: m.userName || m.name,
          email: m.userEmail || m.email,
          university: m.userUniversity || '',
          requestedAt: m.requestedAt,
          status: 'pending',
        })),
        capacity: `${Math.max(1, resolvedMembers.length)} / 4 Members`,
        isOpen: !backendTeam.rosterLocked,
      };
    }
    return localTeam;
  }, [backendTeam, localTeam, activeSprint, user, userEmail]);

  // Team-based submission resolution
  const teamSubmission = (currentTeam && activeSprint)
    ? getSubmissionByTeamAndHackathon(currentTeam.code, activeSprint.id)
    : null;

  const isLeader = isLeaderRole && Boolean(
    currentTeam && user && (
      (backendTeam && backendTeam.leaderId === user.id) ||
      currentTeam.leadEmail?.toLowerCase() === userEmail ||
      currentTeam.leaderId === user.id ||
      isUserTeamLeader(currentTeam, user)
    )
  );
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

  const handleCreateTeamSubmit = async (e) => {
    e.preventDefault();
    const targetHackathonId = createTeamHackathonId || activeSprint?.id || availableOpenHackathons[0]?.id;
    if (!newTeamName.trim() || !targetHackathonId) return;

    if (!isLeaderRole) {
      setTeamActionFeedback({
        type: "error",
        text: "Only users with the Team Leader role are authorized to create a team (FR-12, BR-1)."
      });
      return;
    }

    const targetHackathon = allHackathons.find(
      (h) => matchHackathon(h.id, targetHackathonId, h.title)
    ) || activeSprint;

    // Check if leader is registered for this hackathon (do not silently auto-register)
    const isRegistered =
      isUserRegistered(userEmail, targetHackathonId) ||
      isUserRegistered(userEmail, targetHackathon?.id) ||
      registeredHackathons.some((r) => matchHackathon(r.id, targetHackathonId, r.title));

    if (!isRegistered) {
      setTeamActionFeedback({
        type: "error",
        text: `You must register for "${targetHackathon?.title || 'this competition'}" before creating a team. Please register for the hackathon first.`
      });
      return;
    }

    setTeamActionLoading(true);
    try {
      const canonicalId = targetHackathon?.id || targetHackathonId;
      const targetTitle = targetHackathon?.title || canonicalId;

      if (api.getToken()) {
        const res = await api.createTeam({
          hackathonId: canonicalId,
          teamName: newTeamName.trim(),
          track: targetHackathon?.track || 'General',
        });

        const createdTeam = res.team;
        const normalizedCreated = {
          ...createdTeam,
          hackathonTitle: targetTitle,
          lead: user?.fullName || 'Team Leader',
          leadEmail: userEmail,
          leaderId: user?.id,
          members: [
            {
              id: user?.id || 'usr-leader',
              userName: user?.fullName || 'Team Leader',
              userEmail: userEmail,
              role: 'leader',
              status: 'accepted',
              userUniversity: user?.university || '',
            }
          ]
        };

        // 1. Immediately update apiTeamsData so currentTeam resolves immediately
        setApiTeamsData((prev) => {
          const filtered = (prev.teams || []).filter(
            (t) => !matchHackathon(t.hackathonId, canonicalId, t.hackathonTitle, targetTitle)
          );
          return {
            ...prev,
            teams: [normalizedCreated, ...filtered],
            loaded: true,
          };
        });

        // 2. Also save to teamService for persistent fallback across refreshes
        saveTeam({
          name: createdTeam.teamName,
          hackathon: targetTitle,
          hackathonId: canonicalId,
          track: createdTeam.track || targetHackathon?.track || 'General',
          lead: user?.fullName || 'Team Leader',
          leadEmail: userEmail,
          code: createdTeam.teamCode,
          members: [
            { name: `${user?.fullName || 'Team Leader'} (Lead)`, role: 'Team Leader', email: userEmail, status: 'Active' }
          ],
          capacity: '1 / 4 Members',
          isOpen: true,
          rosterLocked: false
        });

        // 3. Switch selected competition to the created hackathon
        setSelectedHackathonId(canonicalId);
        setCreateTeamHackathonId(canonicalId);
        setNewTeamName("");

        // 4. Set persistent success notice (DO NOT clear via timeout)
        setTeamActionFeedback({
          type: "success",
          text: `Your team "${createdTeam.teamName}" is ready! Share the Team Code ${createdTeam.teamCode} with your teammates so they can join your team.`,
          teamCode: createdTeam.teamCode,
        });

        addNotification({
          userEmail: user.email,
          title: "Team Created Successfully",
          message: `Team "${createdTeam.teamName}" created with Invite Code: ${createdTeam.teamCode}.`,
          type: "success",
          link: "/dashboard/student?tab=roster"
        });

        triggerDataSync("team_created");
        setRefreshKey((k) => k + 1);
      } else {
        const res = createTeam({
          name: newTeamName.trim(),
          hackathonId: canonicalId,
          hackathonTitle: targetTitle,
          track: targetHackathon?.track,
          leadName: user?.fullName || "Team Lead",
          leadEmail: userEmail,
          user
        });

        if (res.success) {
          setSelectedHackathonId(canonicalId);
          setCreateTeamHackathonId(canonicalId);
          setNewTeamName("");
          setTeamActionFeedback({
            type: "success",
            text: `Your team "${res.team.name}" is ready! Share the Team Code ${res.team.code} with your teammates so they can join your team.`,
            teamCode: res.team.code,
          });
          triggerDataSync("team_created");
          setRefreshKey((k) => k + 1);
        } else {
          setTeamActionFeedback({
            type: "error",
            text: res.error
          });
        }
      }
    } catch (err) {
      setTeamActionFeedback({
        type: "error",
        text: err.data?.message || err.message || "Failed to create team."
      });
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleJoinTeam = async (e) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (!clean || !user) return;

    setTeamActionLoading(true);
    try {
      if (api.getToken()) {
        await api.joinTeam(clean);
        addNotification({
          userEmail: user.email,
          title: "Join Request Submitted",
          message: `Your request to join squad (Team Code: ${clean}) was sent to the Team Leader.`,
          type: "info",
          link: "/dashboard/student?tab=roster"
        });
        setTeamActionFeedback({
          type: "success",
          text: `✓ Join request submitted successfully! Awaiting approval from the Team Leader.`,
        });
        setJoinCode("");
        setRefreshKey((k) => k + 1);
      } else {
        const res = await joinTeamWithCode(clean, user);
        if (res.success) {
          setTeamActionFeedback({
            type: "success",
            text: res.message || `✓ Join request submitted for "${res.team?.name || clean}"!`,
          });
          setJoinCode("");
          setRefreshKey((k) => k + 1);
        } else {
          setTeamActionFeedback({
            type: "error",
            text: res.error,
          });
        }
      }
    } catch (err) {
      setTeamActionFeedback({
        type: "error",
        text: err.data?.message || err.message || "Failed to submit join request.",
      });
    } finally {
      setTeamActionLoading(false);
      setTimeout(() => setTeamActionFeedback(null), 5000);
    }
  };

  const handleRespondRequest = async (requestId, action) => {
    if (!currentTeam || !user || !isLeader) return;
    setTeamActionLoading(true);
    try {
      if (api.getToken() && currentTeam.id) {
        await api.respondToJoinRequest(currentTeam.id, requestId, action);
        addNotification({
          userEmail: user.email,
          title: action === 'accept' ? "Team Member Accepted" : "Join Request Declined",
          message: action === 'accept'
            ? `You accepted a new member into squad "${currentTeam.name || currentTeam.teamName}".`
            : `You declined a membership request for squad "${currentTeam.name || currentTeam.teamName}".`,
          type: action === 'accept' ? "success" : "info",
          link: "/dashboard/student?tab=roster"
        });
      } else {
        respondToTeamJoinRequest(currentTeam.code, requestId, action, user);
      }
      setTeamActionFeedback({
        type: "success",
        text: `✓ Join request ${action === 'accept' ? 'accepted' : 'rejected'} successfully. Roster updated.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setTeamActionFeedback({
        type: "error",
        text: err.data?.message || err.message || `Failed to ${action} join request.`,
      });
    } finally {
      setTeamActionLoading(false);
      setTimeout(() => setTeamActionFeedback(null), 5000);
    }
  };

  const handleToggleRosterLock = async () => {
    if (!currentTeam || !user || !isLeader) return;
    try {
      const willLock = !currentTeam.rosterLocked;
      if (api.getToken() && currentTeam.id) {
        await api.toggleTeamRosterLock(currentTeam.id, willLock);
      }
      if (willLock) lockTeamRoster(currentTeam.code, user);
      else unlockTeamRoster(currentTeam.code, user);

      setTeamActionFeedback({
        type: "success",
        text: willLock ? "✓ Team roster locked! No further members may join." : "✓ Team roster unlocked. Teammates can now join.",
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setTeamActionFeedback({
        type: "error",
        text: err.data?.message || err.message || "Failed to update roster lock state.",
      });
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

  const handleSaveSubmission = async (e) => {
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

    if (api.getToken() && currentTeam.id) {
      try {
        await api.submitProject({
          teamId: currentTeam.id,
          projectTitle: formValues.projectTitle.trim() || 'Untitled Project',
          abstract: formValues.projectDescription.trim() || 'Project abstract description',
          track: activeSprint.track || 'General',
          repoUrl: formValues.repositoryUrl.trim(),
          demoUrl: formValues.liveDemoUrl.trim(),
        });
      } catch (err) {
        console.warn('Backend draft sync notice:', err.message);
      }
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

  const handleConfirmFinalize = async () => {
    if (!isLeader) {
      setSubmissionNotice({
        type: "error",
        text: `Only the Team Leader (${currentTeam?.lead || "Leader"}) can finalize the project submission.`
      });
      setTimeout(() => setSubmissionNotice(null), 4500);
      return;
    }

    if (api.getToken() && currentTeam.id) {
      try {
        const subRes = await api.submitProject({
          teamId: currentTeam.id,
          projectTitle: formValues.projectTitle.trim() || 'Untitled Project',
          abstract: formValues.projectDescription.trim() || 'Final submission abstract',
          track: activeSprint.track || 'General',
          repoUrl: formValues.repositoryUrl.trim(),
          demoUrl: formValues.liveDemoUrl.trim(),
        });
        if (subRes.submission?.id) {
          await api.request(`/submissions/${subRes.submission.id}/lock`, { method: 'PATCH' });
        }
      } catch (err) {
        console.warn('Backend finalize lock sync notice:', err.message);
      }
    }

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
    ...(isLeaderRole
      ? [
          {
            value: "workspace",
            label: "Project submission",
            icon: <Rocket aria-hidden="true" />,
            badge: isFinalized ? <Badge tone="success">Submitted</Badge> : null
          }
        ]
      : []),
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
      portalTitle={isLeaderRole ? "Team Leader Portal" : "Student Participant Portal"}
      roleBadgeText={isLeaderRole ? "TEAM LEADER" : "STUDENT PARTICIPANT"}
    >
      <div className="space-y-8">

        {/* HEADER */}
        <PageHeader
          icon={Rocket}
          eyebrow={isLeaderRole ? "Team leader workspace" : "Participant workspace"}
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
              <Badge tone={isLeaderRole ? "accent" : "neutral"}>{isLeaderRole ? "Team Leader" : "Participant"}</Badge>
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
        {/* TAB 1: WORKSPACE & PROJECT SUBMISSION (LEADER ONLY) */}
        {/* ========================================================= */}
        {isLeaderRole && (
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
                    description={
                      isLeaderRole
                        ? "Deliverables belong to a team. Create a new team in the Team & roster tab."
                        : "Deliverables belong to a team. Enter an invite code in the Team & roster tab to join an existing team."
                    }
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

                      {isLeader ? (
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
                      ) : (
                        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between text-sm text-fg-muted">
                          <p>
                            Status: <span className="font-medium text-fg">{isFinalized ? "Locked" : "Draft"}</span>
                          </p>
                          <p className="text-xs text-fg-subtle">
                            Submission controls are restricted to the Team Leader ({currentTeam?.lead || "Leader"}).
                          </p>
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
                        {pendingJoinRequest
                          ? `Your request to join ${pendingJoinRequest.teamName} is pending approval from the Team Leader.`
                          : `No team formed for ${activeSprint?.title || "this hackathon"}.`}
                      </p>
                      <Button size="sm" onClick={() => setActiveTab("roster")}>
                        {pendingJoinRequest ? <Clock aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                        {pendingJoinRequest ? "View pending request" : "Form or join a team"}
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
        )}

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
                    <CardTitle as="h2">Team Details & Roster</CardTitle>
                    <CardDescription>
                      {currentTeam ? `${currentTeam.name} · ${activeSprint?.title || currentTeam.hackathon}` : `No team formed for ${activeSprint?.title || "this hackathon"}`}
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
                    {/* Clear instruction alert */}
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-fg">Your team is ready!</p>
                        <p className="text-fg-muted mt-0.5">
                          Share the Team Code below with your teammates so they can join your team.
                        </p>
                      </div>
                    </div>

                    {/* Prominent Team Code display with copy button */}
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

                    {/* Team Details Summary Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-line bg-surface/50 p-4">
                      <div>
                        <p className="eyebrow">Team Name</p>
                        <p className="mt-1 font-semibold text-fg text-sm truncate">{currentTeam.name}</p>
                      </div>
                      <div>
                        <p className="eyebrow">Competition</p>
                        <p className="mt-1 font-semibold text-fg text-sm truncate">{activeSprint?.title || currentTeam.hackathon}</p>
                      </div>
                      <div>
                        <p className="eyebrow">Team Leader</p>
                        <p className="mt-1 font-semibold text-fg text-sm truncate">{currentTeam.lead || user?.fullName}</p>
                      </div>
                      <div>
                        <p className="eyebrow">Roster Status</p>
                        <div className="mt-1">
                          <Badge tone={currentTeam.members?.length > 1 ? "success" : "warning"} dot>
                            {currentTeam.members?.length > 1 ? `Active (${currentTeam.members.length} members)` : "Waiting for members"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Leader Review: Pending Join Requests */}
                    {isLeader && currentTeam.pendingRequests && currentTeam.pendingRequests.length > 0 && (
                      <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
                            <h3 className="text-sm font-semibold text-fg">
                              Pending join requests
                            </h3>
                          </div>
                          <Badge tone="warning">
                            {currentTeam.pendingRequests.length} awaiting approval
                          </Badge>
                        </div>
                        <p className="text-xs text-fg-subtle">
                          Participants who entered your team invite code. Accept to add them as active members and update the roster, or reject the request.
                        </p>
                        {currentTeam.rosterLocked && (
                          <Alert tone="warning" className="text-xs">
                            Team roster is locked. Unlock the roster above to accept new applicants into the team.
                          </Alert>
                        )}
                        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                          {currentTeam.pendingRequests.map((req) => (
                            <li key={req.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold ring-1 ring-inset ring-line-strong text-fg-muted"
                                  aria-hidden="true"
                                >
                                  {initialsOf(req.name)}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-fg">{req.name}</span>
                                    <Badge tone="warning">Pending Request</Badge>
                                  </div>
                                  <p className="mt-0.5 truncate font-mono text-xs text-fg-subtle">
                                    {req.email} {req.university && `· ${req.university}`}
                                  </p>
                                  {req.requestedAt && (
                                    <p className="mt-0.5 text-[11px] text-fg-subtle">
                                      Requested: {new Date(req.requestedAt).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={teamActionLoading || currentTeam.rosterLocked}
                                  onClick={() => handleRespondRequest(req.id, 'accept')}
                                  title={currentTeam.rosterLocked ? "Unlock roster to accept" : "Accept applicant into roster"}
                                >
                                  <Check aria-hidden="true" />
                                  Accept
                                </Button>
                                <Button
                                  variant="danger-ghost"
                                  size="sm"
                                  disabled={teamActionLoading}
                                  onClick={() => handleRespondRequest(req.id, 'reject')}
                                >
                                  <X aria-hidden="true" />
                                  Reject
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

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
                ) : pendingJoinRequest ? (
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <IconTile icon={Clock} tone="warning" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-fg">
                            Join request pending approval
                          </h3>
                          <Badge tone="warning" dot>Pending leader review</Badge>
                        </div>
                        <p className="mt-1 text-sm text-fg-muted">
                          You requested to join <span className="font-semibold text-fg">{pendingJoinRequest.teamName}</span> (<code className="font-mono text-accent-text">{pendingJoinRequest.teamCode}</code>).
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-line bg-surface p-4 text-xs text-fg-subtle space-y-1.5">
                      <p>
                        <span className="font-medium text-fg">Requested on:</span> {new Date(pendingJoinRequest.requestedAt).toLocaleString()}
                      </p>
                      <p>
                        <span className="font-medium text-fg">Membership status:</span> Pending Team Leader approval. You are not yet an active member.
                      </p>
                      <p className="text-accent-text font-medium pt-1">
                        An email notification will be sent to your registered address once the Team Leader accepts or rejects your request.
                      </p>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    illustration="team"
                    icon={Users}
                    title="No team yet"
                    description={
                      isLeaderRole
                        ? `No team formed for ${activeSprint?.title || "this hackathon"}. Create a new team below to get started.`
                        : `No team joined yet for ${activeSprint?.title || "this hackathon"}. Enter an invite code below to join an existing team.`
                    }
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {!currentTeam && isLeaderRole && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <IconTile icon={UserPlus} />
                      <CardTitle as="h2">Create a team</CardTitle>
                    </div>
                    <CardDescription>
                      Start a team for <span className="text-fg">{activeSprint?.title || "an open hackathon"}</span>. You will be the team leader.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
                      {availableOpenHackathons.length > 0 && (
                        <Field label="Competition" required>
                          <Select
                            value={activeSprint?.id || createTeamHackathonId || (availableOpenHackathons[0]?.id || "")}
                            onChange={(e) => {
                              setCreateTeamHackathonId(e.target.value);
                              setSelectedHackathonId(e.target.value);
                            }}
                          >
                            {availableOpenHackathons.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.title}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}
                      <Field label="Team name" required>
                        <Input
                          type="text"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="e.g. ApexInnovators"
                        />
                      </Field>
                      <Button type="submit" className="w-full" loading={teamActionLoading}>
                        <UserPlus aria-hidden="true" />
                        Create team
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {currentTeam && isLeaderRole && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <IconTile icon={CheckCircle2} tone="accent" />
                        <CardTitle as="h2">Team formed</CardTitle>
                      </div>
                      <Badge tone="success" dot>Active squad</Badge>
                    </div>
                    <CardDescription>
                      You have formed a team for <span className="font-semibold text-fg">{activeSprint?.title}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {availableOpenHackathons.length > 1 && (
                      <Field label="Competition" hint="Switch competition to view or manage teams across hackathons.">
                        <Select
                          value={activeSprint?.id || selectedHackathonId || ""}
                          onChange={(e) => {
                            setSelectedHackathonId(e.target.value);
                            setCreateTeamHackathonId(e.target.value);
                          }}
                        >
                          {availableOpenHackathons.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.title}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}

                    <div className="space-y-1">
                      <p className="eyebrow">Formed team name</p>
                      <p className="text-base font-semibold text-fg">{currentTeam.name}</p>
                    </div>

                    <div className="rounded-lg border border-line bg-surface p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-fg-muted">Team Code</span>
                        <code className="font-mono text-sm font-bold text-accent-text">{currentTeam.code}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-fg-muted">Team Leader</span>
                        <span className="text-xs font-semibold text-fg">{currentTeam.lead || user?.fullName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-fg-muted">Roster Status</span>
                        <Badge tone={currentTeam.members?.length > 1 ? "success" : "warning"}>
                          {currentTeam.members?.length > 1 ? `${currentTeam.members.length} members` : "Waiting for members"}
                        </Badge>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCopyCode(currentTeam.code)}
                    >
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      {copied ? "Copied code" : "Copy team code"}
                    </Button>

                    <p className="text-xs text-fg-subtle">
                      Duplicate team creation for {activeSprint?.title || "this competition"} is disabled. You are the registered leader of {currentTeam.name}.
                    </p>
                  </CardContent>
                </Card>
              )}

              {!currentTeam && !isLeaderRole && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-fg">Participant Membership</p>
                      <p className="text-fg-muted mt-0.5">
                        As a Participant, you can join an existing team using a Team Code shared by your Team Leader. Only users with the Team Leader role can create new teams.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!isLeaderRole && (
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
              )}
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
                    description={
                      isLeaderRole
                        ? "Submit deliverables first to enter the screening gateway."
                        : "Your Team Leader will submit project deliverables to enter the screening gateway."
                    }
                    action={
                      isLeaderRole ? (
                        <Button variant="secondary" onClick={() => setActiveTab("workspace")}>
                          Go to project submission
                        </Button>
                      ) : null
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
