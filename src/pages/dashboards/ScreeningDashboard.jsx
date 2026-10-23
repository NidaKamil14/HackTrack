import React, { useState, useMemo, useEffect } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Inbox,
  KeyRound,
  Layers,
  Link2Off,
  ListChecks,
  MessageSquareText,
  MousePointerClick,
  ScanSearch,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Textarea,
  cn,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { getFinalizedSubmissions, updateScreeningDecision } from '../../utils/submissionService.js';
import {
  getStoredHackathons,
  getUserAssignedHackathonIds,
  redeemAccessCode
} from '../../utils/hackathonService.js';
import { addNotification } from '../../utils/notificationService.js';
import { subscribeToDataSync } from '../../utils/syncService.js';
import api from '../../utils/api.js';

/* ------------------------------------------------------------------------- */
/* Review-workspace pattern. Kept visually identical in JudgeDashboard and    */
/* ScreeningDashboard so both reviewer roles feel like one product.           */
/* ------------------------------------------------------------------------- */
const TONE_TILE = {
  accent: 'bg-accent/15 text-accent-text ring-accent/25',
  success: 'bg-success/10 text-success ring-success/25',
  warning: 'bg-warning/10 text-warning ring-warning/25',
  danger: 'bg-danger/10 text-danger ring-danger/25',
  info: 'bg-info/10 text-info ring-info/25',
};

function IconTile({ icon: Icon, tone = 'accent', size = 'md' }) {
  const lg = size === 'lg';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center ring-1 ring-inset',
        lg ? 'h-11 w-11 rounded-xl' : 'h-8 w-8 rounded-lg',
        TONE_TILE[tone] || TONE_TILE.accent
      )}
    >
      <Icon className={lg ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
    </span>
  );
}

function SectionTitle({ icon, tone, title, description, aside, as: Heading = 'h3' }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0">
          <Heading className="text-sm font-semibold text-fg">{title}</Heading>
          {description && <p className="text-xs text-fg-muted">{description}</p>}
        </div>
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </div>
  );
}

function ProgressBar({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RoleBanner({ icon, title, action, children }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={icon} />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-fg">{title}</p>
            <p className="text-sm leading-relaxed text-fg-muted">{children}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardContent>
    </Card>
  );
}

/* Header band at the top of the review panel for the selected item. */
function ReviewBand({ eyebrow, title, subtitle, badges, aside }) {
  return (
    <div className="surface-hero flex flex-col gap-5 rounded-t-xl border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="relative min-w-0 space-y-2">
        {eyebrow && <p className="eyebrow truncate">{eyebrow}</p>}
        <h2 className="break-words text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h2>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
        {badges && <div className="flex flex-wrap items-center gap-2 pt-1">{badges}</div>}
      </div>
      {aside && <div className="relative shrink-0">{aside}</div>}
    </div>
  );
}

function QueueList({ icon, title, count, progress, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <IconTile icon={icon} />
            <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
          </div>
          <span className="shrink-0 rounded-md border border-line bg-raised px-2 py-0.5 text-xs tabular-nums text-fg-muted">
            {count}
          </span>
        </div>
        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs text-fg-subtle">
              <span>{progress.label}</span>
              <span className="tabular-nums">{progress.value} / {progress.max}</span>
            </div>
            <ProgressBar value={progress.value} max={progress.max} label={progress.label} />
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

function QueueItem({ selected, onSelect, title, badge, meta }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'relative flex w-full flex-col gap-1.5 px-5 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
          selected ? 'bg-accent/10' : 'hover:bg-raised/50'
        )}
      >
        <span
          className={cn('absolute inset-y-0 left-0 w-0.5 transition-colors', selected ? 'bg-accent' : 'bg-transparent')}
          aria-hidden="true"
        />
        <span className="flex items-center justify-between gap-3">
          <span className={cn('truncate text-sm font-medium', selected ? 'text-fg' : 'text-fg/90')}>{title}</span>
          {badge}
        </span>
        {meta && <span className="truncate text-xs text-fg-subtle">{meta}</span>}
      </button>
    </li>
  );
}

function LinkButton({ href, children }) {
  // Submissions without a URL are stored as "#" — show that plainly instead of a dead link.
  if (!href || href === "#") {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line px-3 text-xs text-fg-subtle">
        <Link2Off className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {children}: not provided
      </span>
    );
  }
  return (
    <Button as="a" href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
      <ExternalLink aria-hidden="true" />
      {children}
    </Button>
  );
}

// Pending and under review are both "awaiting a decision" (warning); the icon tells them apart.
const statusTone = (status) =>
  status === "Shortlisted" ? "success" : status === "Rejected" ? "danger" : "warning";

const statusIcon = (status) =>
  status === "Shortlisted" ? CheckCircle2 : status === "Rejected" ? XCircle : status === "Under Review" ? Eye : Clock;

const STATUS_PANEL = {
  success: 'border-success/25 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-danger/25 bg-danger/10 text-danger',
};

function StatusBadge({ status }) {
  const iconClass = "h-3.5 w-3.5";
  return (
    <Badge tone={statusTone(status)}>
      {status === "Shortlisted" ? (
        <CheckCircle2 className={iconClass} aria-hidden="true" />
      ) : status === "Rejected" ? (
        <XCircle className={iconClass} aria-hidden="true" />
      ) : status === "Under Review" ? (
        <Eye className={iconClass} aria-hidden="true" />
      ) : (
        <Clock className={iconClass} aria-hidden="true" />
      )}
      {status}
    </Badge>
  );
}

const COMPLIANCE_CHECKS = [
  { key: "gitFreshness", label: "Git freshness" },
  { key: "endpointsLive", label: "HTTPS live" },
  { key: "envConfigured", label: ".env.example" },
  { key: "licenseMIT", label: "Open license" },
];

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

  useEffect(() => {
    return subscribeToDataSync(() => {
      setRefreshKey((k) => k + 1);
      setSubmissions(loadSubmissions());
    });
  }, []);

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

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    const cleanCode = accessCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    if (api.getToken()) {
      try {
        await api.redeemCode(cleanCode);
      } catch (err) {
        console.warn("[ScreeningDashboard] Backend code redemption warning:", err.message);
      }
    }

    const res = redeemAccessCode(cleanCode, user);
    if (res.success) {
      addNotification({
        userEmail: user?.email,
        title: "Screening Access Granted",
        message: res.message || "Access verified for screening committee panel.",
        type: "success",
        link: "/dashboard/screening"
      });
      setCodeNotice({ type: 'success', text: res.message });
      setFilterHackathon(res.hackathonId);
      setAccessCodeInput("");
      setShowCodeModal(false);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setCodeNotice(null), 4500);
    } else {
      setCodeNotice({ type: 'error', text: res.error || "Invalid or unavailable access code." });
      setTimeout(() => setCodeNotice(null), 4500);
    }
  };

  // Which queue row is open in the review panel (presentation only)
  const [selectedId, setSelectedId] = useState(null);

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

      addNotification({
        userEmail: user?.email,
        title: `Screening Decision: ${newStatus}`,
        message: `Decision recorded for "${target.teamName}": ${newStatus}. Synced with team & judges.`,
        type: newStatus === "Shortlisted" ? "success" : "info",
        link: "/dashboard/screening"
      });

      setFeedbackNotice({
        type: newStatus === "Shortlisted" ? "success" : newStatus === "Rejected" ? "error" : "info",
        text: `Decision recorded: "${target.teamName}" set to ${newStatus}. Synced with team & judge views.`
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

  const selected = filtered.find((s) => s.id === selectedId) || filtered[0] || null;
  const activeRemarks = selected
    ? (remarksState[selected.id] !== undefined ? remarksState[selected.id] : selected.screeningRemarks)
    : "";

  const noticeTone = feedbackNotice?.type === "success" ? "success" : feedbackNotice?.type === "error" ? "danger" : "info";

  return (
    <DashboardLayout
      portalTitle="Screening Committee Review Portal"
      roleBadgeText="SCREENING COMMITTEE"
    >
      <div className="space-y-8">
        <PageHeader
          icon={ScanSearch}
          eyebrow={`Screening gateway · ${user?.university || "Review Board"}`}
          title="Screening Review Queue"
          description="Verify compliance rules and add remarks before forwarding entries to judges."
        />

        {feedbackNotice && <Alert tone={noticeTone}>{feedbackNotice.text}</Alert>}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            tone="accent"
            label="Finalized entries"
            value={total}
            icon={Layers}
            hint={`${filtered.length} match current filters`}
          />
          <StatCard
            tone="warning"
            label="Pending review"
            value={pendingCount}
            icon={Clock}
            hint={`${pendingCount} of ${total} awaiting a decision`}
          />
          <StatCard tone="success" label="Shortlisted" value={shortlistedCount} icon={CheckCircle2} hint="Forwarded to judges" />
          <StatCard tone="danger" label="Rejected" value={rejectedCount} icon={XCircle} hint="Did not pass screening" />
        </div>

        {/* Role explanation + access code entry */}
        <RoleBanner
          icon={ShieldCheck}
          title="Screening Committee (Gatekeeper)"
          action={
            <Button variant="secondary" onClick={() => setShowCodeModal(true)}>
              <KeyRound aria-hidden="true" />
              Enter Screening Access Code
            </Button>
          }
        >
          You review <strong className="font-medium text-fg">all raw submissions</strong> right after the deadline. Verify commit freshness, live URL health, and documentation to mark entries as <strong className="font-medium text-fg">Shortlisted</strong> (which sends them to Judges) or <strong className="font-medium text-fg">Rejected</strong>.
        </RoleBanner>

        {codeNotice && (
          <Alert tone={codeNotice.type === 'success' ? 'success' : 'danger'}>{codeNotice.text}</Alert>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid w-full grid-cols-1 gap-3 sm:max-w-lg sm:grid-cols-2">
            <Field label="Active hackathon">
              <Select value={filterHackathon} onChange={(e) => setFilterHackathon(e.target.value)}>
                <option value="all">All Assigned Competitions ({assignedHackathons.length})</option>
                {assignedHackathons.map((h) => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Under Review">Under Review</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Rejected">Rejected</option>
              </Select>
            </Field>
          </div>
          <p className="shrink-0 text-xs tabular-nums text-fg-subtle">
            Showing {filtered.length} of {total} submissions
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Queue */}
          <div className="min-w-0">
            <QueueList
              icon={ListChecks}
              title="Submissions"
              count={`${filtered.length} in queue`}
              progress={{ label: "Decided overall", value: shortlistedCount + rejectedCount, max: total }}
            >
              {filtered.length === 0 ? (
                <EmptyState
                  illustration="review"
                  icon={Inbox}
                  title={total === 0 ? "Nothing to screen yet" : "No matches"}
                  description={
                    total === 0
                      ? "Finalized submissions will appear here for compliance review."
                      : "No submissions match the selected filters."
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((sub) => (
                    <QueueItem
                      key={sub.id}
                      selected={selected?.id === sub.id}
                      onSelect={() => setSelectedId(sub.id)}
                      title={sub.teamName}
                      badge={<StatusBadge status={sub.status} />}
                      meta={`${sub.projectTitle} · ${sub.hackathonTitle}`}
                    />
                  ))}
                </ul>
              )}
            </QueueList>
          </div>

          {/* Review panel */}
          <div className="min-w-0 lg:col-span-2">
            {selected ? (
              <Card>
                <ReviewBand
                  eyebrow={`${selected.hackathonTitle} · ${selected.track}`}
                  title={selected.teamName}
                  subtitle={
                    <>
                      <span className="font-medium text-fg">{selected.projectTitle}</span> · Lead: {selected.lead}
                    </>
                  }
                  badges={
                    <>
                      <Badge tone={statusTone(selected.status)} dot>{selected.status}</Badge>
                      <Badge tone="neutral" className="tabular-nums">{selected.submissionDate}</Badge>
                    </>
                  }
                  aside={
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-4 py-3',
                        STATUS_PANEL[statusTone(selected.status)]
                      )}
                    >
                      <IconTile icon={statusIcon(selected.status)} tone={statusTone(selected.status)} size="lg" />
                      <div>
                        <p className="text-xs text-fg-subtle">Screening status</p>
                        <p className="text-base font-semibold">{selected.status}</p>
                      </div>
                    </div>
                  }
                />

                <CardContent className="space-y-6">
                  {selected.status === "Shortlisted" && (
                    <Alert tone="success" title="Shortlisted">
                      This entry has been forwarded to the judging panel.
                    </Alert>
                  )}
                  {selected.status === "Rejected" && (
                    <Alert tone="danger" title="Rejected">
                      {selected.rejectionReason ? `Reason: ${selected.rejectionReason}` : "This entry did not pass screening."}
                    </Alert>
                  )}
                  {selected.status !== "Rejected" && selected.rejectionReason && (
                    <Alert tone="danger" title="Rejection reason">{selected.rejectionReason}</Alert>
                  )}

                  <section className="space-y-3">
                    <SectionTitle
                      icon={FileText}
                      title="Submission details"
                      description="What the team finalized for review."
                    />
                    <div className="space-y-4 rounded-lg border border-line bg-raised/40 p-4">
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        {[
                          { label: "Project", value: selected.projectTitle },
                          { label: "Team", value: selected.teamName },
                          { label: "Lead", value: selected.lead },
                          { label: "Hackathon", value: selected.hackathonTitle },
                          { label: "Track", value: selected.track },
                          { label: "Submitted", value: selected.submissionDate },
                        ].map((item) => (
                          <div key={item.label} className="min-w-0">
                            <dt className="text-xs text-fg-subtle">{item.label}</dt>
                            <dd className="break-words font-medium text-fg">{item.value}</dd>
                          </div>
                        ))}
                      </dl>

                      {selected.projectDescription && (
                        <p className="border-t border-line pt-4 text-sm leading-relaxed text-fg-muted">
                          {selected.projectDescription}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                        <LinkButton href={selected.repoUrl}>Inspect repository</LinkButton>
                        <LinkButton href={selected.demoUrl}>Live deployment</LinkButton>
                        {selected.submissionFiles && selected.submissionFiles.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {selected.submissionFiles.map((f, fIdx) => (
                              <Badge key={fIdx} tone="neutral" className="max-w-full font-mono">
                                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{f.name}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <fieldset className="space-y-3">
                    <legend className="sr-only">Compliance checklist</legend>
                    <SectionTitle
                      icon={ShieldCheck}
                      title="Compliance checklist"
                      description="Select a gate to toggle pass / fail."
                      aside={
                        <Badge
                          tone={COMPLIANCE_CHECKS.every(({ key }) => selected.checks[key]) ? "success" : "danger"}
                          className="tabular-nums"
                        >
                          {COMPLIANCE_CHECKS.filter(({ key }) => selected.checks[key]).length} / {COMPLIANCE_CHECKS.length} passed
                        </Badge>
                      }
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {COMPLIANCE_CHECKS.map(({ key, label }) => {
                        const passed = Boolean(selected.checks[key]);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleCheck(selected.id, key)}
                            aria-pressed={passed}
                            className={cn(
                              'flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                              passed
                                ? 'border-success/25 bg-success/10 hover:border-success/40'
                                : 'border-danger/25 bg-danger/10 hover:border-danger/40'
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={cn(
                                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                                  passed ? 'bg-success/15 text-success ring-success/30' : 'bg-danger/15 text-danger ring-danger/30'
                                )}
                              >
                                {passed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
                              </span>
                              <span className="truncate font-medium text-fg">{label}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className={cn('text-xs font-semibold', passed ? 'text-success' : 'text-danger')}>
                                {passed ? "Pass" : "Fail"}
                              </span>
                              <span
                                className={cn(
                                  'relative h-5 w-9 rounded-full transition-colors',
                                  passed ? 'bg-success/70' : 'bg-danger/40'
                                )}
                                aria-hidden="true"
                              >
                                <span
                                  className={cn(
                                    'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                                    passed ? 'translate-x-4' : 'translate-x-0'
                                  )}
                                />
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <section className="space-y-3">
                    <SectionTitle
                      icon={MessageSquareText}
                      title="Remarks"
                      description="Saved with your decision and shared with the team and judges."
                    />
                    <Field label="Screening remarks & evaluator notes">
                      <Input
                        type="text"
                        value={activeRemarks}
                        onChange={(e) => handleRemarkChange(selected.id, e.target.value)}
                        placeholder="e.g. Clean commit tree verified; endpoints respond under 200ms latency ceiling."
                      />
                    </Field>
                  </section>
                </CardContent>

                <CardFooter className="sticky bottom-0 z-10 flex-col items-stretch gap-3 rounded-b-xl bg-surface/95 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="secondary" onClick={() => handleDecision(selected.id, "Under Review", activeRemarks)}>
                    <Eye aria-hidden="true" />
                    Mark under review
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <Button
                      variant="danger-ghost"
                      className="border border-danger/25"
                      onClick={() => openRejectModal(selected)}
                    >
                      <XCircle aria-hidden="true" />
                      Reject entry
                    </Button>
                    <Button onClick={() => handleDecision(selected.id, "Shortlisted", activeRemarks)}>
                      <CheckCircle2 aria-hidden="true" />
                      Shortlist team
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={MousePointerClick}
                  title="Select a submission"
                  description="Pick an entry from the queue to review its compliance and record a decision."
                />
              </Card>
            )}
          </div>
        </div>

        {/* Rejection reason dialog */}
        <Dialog
          open={Boolean(rejectModalTarget)}
          onClose={() => setRejectModalTarget(null)}
          title={rejectModalTarget ? `Reject submission: ${rejectModalTarget.teamName}` : ""}
          description="Select the non-compliance reason for rejecting this project."
        >
          <div className="space-y-4">
            <Field label="Rejection category" required>
              <Select value={rejectionReasonSelect} onChange={(e) => setRejectionReasonSelect(e.target.value)}>
                <option value="Pre-dated private commits before kickoff window">Pre-dated commits before kickoff window</option>
                <option value="Missing working live deployment endpoint">Missing working live deployment endpoint (5xx or offline)</option>
                <option value="Incomplete repository or missing .env.example">Incomplete repository or missing .env.example</option>
                <option value="Non-permissive or missing open source license">Non-permissive or missing open source license</option>
                <option value="Rule violation or plagiarism detection">Rule violation or plagiarism detection</option>
                <option value="Other">Other (Custom explanation)</option>
              </Select>
            </Field>

            {rejectionReasonSelect === "Other" && (
              <Field label="Specific reason details" required>
                <Textarea
                  rows={2}
                  value={rejectionCustomText}
                  onChange={(e) => setRejectionCustomText(e.target.value)}
                  placeholder="Explain the compliance failure..."
                />
              </Field>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setRejectModalTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmRejection}>
                <XCircle aria-hidden="true" />
                Confirm rejection
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Enter Screening Access Code dialog */}
        <Dialog
          open={showCodeModal}
          onClose={() => setShowCodeModal(false)}
          title="Enter Screening Access Code"
          description="Hackathon organizers create unique screening access codes. Enter your assigned code once to unlock and review submissions for that hackathon."
        >
          <form onSubmit={handleRedeemCode} className="space-y-4">
            <p className="text-sm text-fg-muted">
              Example: <span className="break-all font-mono text-fg">SCREEN-DEVPULSE-3M2P</span>
            </p>

            {codeNotice?.type === 'error' && <Alert tone="danger">{codeNotice.text}</Alert>}

            <Field label="Access code" required>
              <Input
                type="text"
                required
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. SCREEN-DEVPULSE-3M2P"
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase tracking-wider"
              />
            </Field>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setShowCodeModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <KeyRound aria-hidden="true" />
                Verify & Unlock Hackathon
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
