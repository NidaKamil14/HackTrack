import React, { useState, useMemo, useId } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Gavel,
  Inbox,
  KeyRound,
  Link2,
  Link2Off,
  ListChecks,
  MessageSquareText,
  MousePointerClick,
  SlidersHorizontal,
  Trophy,
  Users,
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
import { MOCK_JUDGE_DATA } from '../../data/mockDashboardData';
import { useAuth } from '../../context/AuthContext';
import {
  getStoredHackathons,
  getUserAssignedHackathonIds,
  redeemAccessCode
} from '../../utils/hackathonService';
import { getShortlistedSubmissions } from '../../utils/submissionService';
import { getEvaluations, saveEvaluation, isResultsPublished } from '../../utils/evaluationService';

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

/* Radial indicator for the selected team's total (value comes from computeTotal). */
function ScoreRing({ value, max = 100 }) {
  const gradientId = useId();
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'rgb(var(--accent))' }} />
            <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-2))' }} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-raised" />
        {pct > 0 && (
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${pct} 100`}
            stroke={`url(#${gradientId})`}
            className="transition-[stroke-dasharray] duration-300 ease-out"
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-accent-text">
        <Trophy className="h-5 w-5" />
      </span>
    </div>
  );
}

export default function JudgeDashboard() {
  const { user } = useAuth();
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

  const [selectedHackathonFilter, setSelectedHackathonFilter] = useState("all");
  const [saveNotice, setSaveNotice] = useState(null);

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
      setSelectedHackathonFilter(res.hackathonId);
      setAccessCodeInput("");
      setShowCodeModal(false);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setCodeNotice(null), 4500);
    } else {
      setCodeNotice({ type: 'error', text: res.error });
      setTimeout(() => setCodeNotice(null), 4500);
    }
  };

  // Combine static shortlisted teams with dynamically shortlisted submissions from submissionService
  const dynamicShortlisted = getShortlistedSubmissions();
  const existingEvaluations = getEvaluations();

  const combinedTeams = useMemo(() => {
    const list = [...MOCK_JUDGE_DATA.shortlistedTeams];

    // Add any dynamic submission that passed screening and is not yet in list
    dynamicShortlisted.forEach((sub) => {
      const alreadyInList = list.some(
        (t) => t.id === sub.submissionId || (t.name && sub.teamName && t.name.toLowerCase() === sub.teamName.toLowerCase())
      );
      if (!alreadyInList) {
        list.push({
          id: sub.submissionId,
          teamCode: sub.teamId,
          name: sub.teamName,
          hackathon: sub.hackathonTitle || sub.hackathonId,
          hackathonId: sub.hackathonId,
          track: sub.track,
          repo: sub.repositoryUrl || "#",
          demo: sub.liveDemoUrl || "#",
          status: "Pending Evaluation",
          screeningScore: "Screening Gate Cleared [4/4]",
          scores: { architecture: 0, usability: 0, innovation: 0, completeness: 0 },
          feedback: ""
        });
      }
    });

    // Merge persistent saved evaluations
    return list.map((t) => {
      const matchEval = existingEvaluations.find(
        (e) =>
          (e.teamId && t.teamCode && e.teamId.toUpperCase() === t.teamCode.toUpperCase()) ||
          (e.teamName && t.name && e.teamName.toLowerCase() === t.name.toLowerCase()) ||
          e.evaluationId === `eval-${t.id}`
      );
      if (matchEval) {
        return {
          ...t,
          status: "Evaluated",
          scores: matchEval.scores || t.scores,
          feedback: matchEval.feedback || t.feedback
        };
      }
      return t;
    });
  }, [dynamicShortlisted, existingEvaluations]);

  const [teamsState, setTeamsState] = useState(combinedTeams);
  const [selectedTeamId, setSelectedTeamId] = useState(teamsState[0]?.id || "");

  const filteredTeams = teamsState.filter((t) => {
    if (selectedHackathonFilter === "all") return true;
    return t.hackathonId === selectedHackathonFilter || t.hackathon?.toLowerCase().includes(selectedHackathonFilter);
  });

  const selectedTeam = filteredTeams.find((t) => t.id === selectedTeamId) || filteredTeams[0] || teamsState[0];

  // Dynamically resolve rubrics configured for the active hackathon
  // (plain derivation: cheap lookup, recomputed every render)
  const activeHackathon = selectedHackathonFilter !== "all"
    ? (allHackathons.find((h) => h.id === selectedHackathonFilter) || assignedHackathons[0])
    : (allHackathons.find((h) => h.id === selectedTeam?.hackathonId) || assignedHackathons[0]);

  const currentRubrics = useMemo(() => {
    if (activeHackathon?.rubrics && activeHackathon.rubrics.length > 0) {
      return activeHackathon.rubrics.map((r, i) => {
        const weightNum = parseInt(r.weight || '25', 10) || 25;
        const legacyKeys = ['architecture', 'usability', 'innovation', 'completeness'];
        return {
          key: `crit_${i}`,
          legacyKey: legacyKeys[i] || `crit_${i}`,
          name: r.name,
          weight: r.weight || `${weightNum}%`,
          max: weightNum,
          desc: r.desc || r.description || ''
        };
      });
    }
    return MOCK_JUDGE_DATA.rubrics.map((r) => ({
      ...r,
      legacyKey: r.key,
      max: r.max || 25
    }));
  }, [activeHackathon]);

  const handleScoreChange = (rubricKey, val, maxVal = 35) => {
    const num = Math.max(0, Math.min(maxVal, Number(val) || 0));
    setTeamsState((prev) =>
      prev.map((t) => {
        if (t.id === selectedTeam?.id) {
          return {
            ...t,
            scores: {
              ...t.scores,
              [rubricKey]: num
            }
          };
        }
        return t;
      })
    );
  };

  const handleFeedbackChange = (text) => {
    setTeamsState((prev) =>
      prev.map((t) => (t.id === selectedTeam?.id ? { ...t, feedback: text } : t))
    );
  };

  const computeTotal = (scores) => {
    return Object.values(scores || {}).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  };

  const handleSaveEvaluation = (e) => {
    e.preventDefault();
    if (!selectedTeam) return;

    const res = saveEvaluation({
      teamId: selectedTeam.teamCode || selectedTeam.id,
      teamName: selectedTeam.name,
      hackathonId: selectedTeam.hackathonId || "devpulse-2026",
      hackathonTitle: selectedTeam.hackathon,
      track: selectedTeam.track,
      judgeEmail: user?.email || "judge@hacktrack.io",
      judgeName: user?.fullName || "Prof. Elena Rostova",
      scores: selectedTeam.scores,
      feedback: selectedTeam.feedback
    });

    if (res.success) {
      setTeamsState((prev) =>
        prev.map((t) => (t.id === selectedTeam.id ? { ...t, status: "Evaluated" } : t))
      );
      setSaveNotice(`Certified score (${computeTotal(selectedTeam.scores)} / 100) saved and securely recorded for ${selectedTeam.name}.`);
      setTimeout(() => setSaveNotice(null), 4500);
    }
  };

  const evaluatedCount = teamsState.filter((t) => t.status === "Evaluated").length;
  const pendingCount = teamsState.length - evaluatedCount;
  const resultsPublished = selectedTeam?.hackathonId ? isResultsPublished(selectedTeam.hackathonId) : false;

  return (
    <DashboardLayout
      portalTitle="Judge & Evaluation Panel"
      roleBadgeText="JUDGE / EVALUATOR"
    >
      <div className="space-y-8">
        <PageHeader
          icon={Gavel}
          eyebrow={`Judging panel · ${user?.university || "ACM Expert Review Panel"}`}
          title="Evaluation Chamber"
          description="Score pre-screened finalists across standardized rubrics."
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard tone="accent" label="Assigned sprints" value={assignedHackathons.length} icon={Trophy} />
          <StatCard
            tone="cyan"
            label="Finalist teams"
            value={teamsState.length}
            icon={Users}
            hint={`${filteredTeams.length} in current view`}
          />
          <StatCard
            tone="success"
            label="Completed"
            value={evaluatedCount}
            icon={CheckCircle2}
            hint={`${evaluatedCount} of ${teamsState.length} scored`}
          />
          <StatCard
            tone="warning"
            label="Pending"
            value={pendingCount}
            icon={Clock}
            hint={pendingCount === 0 ? "All finalists scored" : "Awaiting rubric scores"}
          />
        </div>

        {/* Role explanation */}
        <RoleBanner
          icon={Gavel}
          title="Judge / Evaluator role"
          action={
            <Button type="button" variant="secondary" onClick={() => setShowCodeModal(true)}>
              <KeyRound aria-hidden="true" />
              Enter judge access code
            </Button>
          }
        >
          You evaluate <strong className="font-medium text-fg">only shortlisted teams</strong> that passed the initial
          screening gate. Your scores directly compile into the final certified rankings according to this
          hackathon&apos;s specific rubrics.
        </RoleBanner>

        {codeNotice && (
          <Alert
            tone={codeNotice.type === 'success' ? 'success' : 'danger'}
            title={codeNotice.type === 'success' ? 'Access code verified' : 'Access code not accepted'}
          >
            {codeNotice.text}
          </Alert>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-end sm:justify-between">
          <Field label="Active hackathon" className="w-full sm:max-w-xs">
            <Select
              value={selectedHackathonFilter}
              onChange={(e) => setSelectedHackathonFilter(e.target.value)}
              className="font-medium"
            >
              <option value="all">All assigned competitions ({assignedHackathons.length})</option>
              {assignedHackathons.map((h) => (
                <option key={h.id} value={h.id}>{h.title}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info" className="tabular-nums">
              Rubrics: {(activeHackathon?.rubrics || []).length} criteria configured
            </Badge>
            <Badge tone="success" dot>Screening-cleared finalists only</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Queue */}
          <div className="min-w-0">
            <QueueList
              icon={ListChecks}
              title="Assigned teams"
              count={`${filteredTeams.length} teams`}
              progress={{ label: "Scored overall", value: evaluatedCount, max: teamsState.length }}
            >
              {filteredTeams.length === 0 ? (
                <EmptyState
                  illustration="review"
                  icon={Inbox}
                  title="No finalists assigned"
                  description="No shortlisted finalists for this sprint yet. Teams appear here once screening clears them."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {filteredTeams.map((t) => {
                    const isEvaluated = t.status === "Evaluated";
                    return (
                      <QueueItem
                        key={t.id}
                        selected={selectedTeam?.id === t.id}
                        onSelect={() => setSelectedTeamId(t.id)}
                        title={t.name}
                        badge={
                          isEvaluated ? (
                            <Badge tone="success" dot className="tabular-nums">{computeTotal(t.scores)} pts</Badge>
                          ) : (
                            <Badge tone="warning" dot>Pending</Badge>
                          )
                        }
                        meta={[t.hackathon, t.track].filter(Boolean).join(' · ')}
                      />
                    );
                  })}
                </ul>
              )}
            </QueueList>
          </div>

          {/* Review panel */}
          <div className="min-w-0 lg:col-span-2">
            {selectedTeam ? (
              <Card>
                <ReviewBand
                  eyebrow={`Rubric evaluation · ${selectedTeam.hackathon}`}
                  title={selectedTeam.name}
                  subtitle={`Track: ${selectedTeam.track}`}
                  badges={
                    <>
                      <Badge tone={selectedTeam.status === "Evaluated" ? "success" : "warning"} dot>
                        {selectedTeam.status}
                      </Badge>
                      <Badge tone="success">Gate cleared 4/4</Badge>
                    </>
                  }
                  aside={
                    <div className="flex items-center gap-4">
                      <ScoreRing value={computeTotal(selectedTeam.scores)} max={100} />
                      <div>
                        <p className="text-xs text-fg-subtle">Total score</p>
                        <p className="text-4xl font-semibold tabular-nums tracking-tight text-fg">
                          {computeTotal(selectedTeam.scores)}
                          <span className="text-base font-normal text-fg-subtle"> / 100</span>
                        </p>
                      </div>
                    </div>
                  }
                />

                <CardContent className="space-y-6">
                  <section className="space-y-3">
                    <SectionTitle
                      icon={Link2}
                      title="Submission"
                      description="Open the team's repository and live demo before scoring."
                    />
                    <div className="flex flex-wrap gap-2 rounded-lg bg-raised/50 p-3">
                      <LinkButton href={selectedTeam.repo}>Repository</LinkButton>
                      <LinkButton href={selectedTeam.demo}>Live demo</LinkButton>
                    </div>
                  </section>

                  {resultsPublished ? (
                    <Alert tone="info" title="Results published">
                      Scores for this hackathon are visible to participants. Evaluator: {user?.fullName || "ACM Judge"}.
                    </Alert>
                  ) : (
                    <Alert tone="warning" title="Confidential">
                      Scores stay private until an admin releases results. Evaluator: {user?.fullName || "ACM Judge"}.
                    </Alert>
                  )}

                  {saveNotice && <Alert tone="success" title="Evaluation saved">{saveNotice}</Alert>}

                  <form id="judge-evaluation-form" onSubmit={handleSaveEvaluation} className="space-y-6">
                    <fieldset className="space-y-3">
                      <legend className="sr-only">Score breakdown</legend>
                      <SectionTitle
                        icon={SlidersHorizontal}
                        title="Score breakdown"
                        description="Drag a slider or type a value for each criterion."
                        aside={
                          <span className="rounded-md border border-accent/25 bg-accent/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-accent-text">
                            {computeTotal(selectedTeam.scores)}
                            <span className="font-normal text-fg-subtle"> / 100</span>
                          </span>
                        }
                      />
                      <ProgressBar value={computeTotal(selectedTeam.scores)} max={100} label="Running total" />
                      <div className="divide-y divide-line rounded-lg border border-line bg-raised/40 px-4">
                        {currentRubrics.map((r, idx) => {
                          const currentVal = selectedTeam.scores[r.key] !== undefined
                            ? selectedTeam.scores[r.key]
                            : (selectedTeam.scores[r.legacyKey] || 0);

                          return (
                            <div key={r.key} className="flex gap-3 py-4">
                              <span
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-raised text-xs font-medium tabular-nums text-fg-muted ring-1 ring-inset ring-line"
                                aria-hidden="true"
                              >
                                {idx + 1}
                              </span>
                              <Field
                                label={
                                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                    <span>{r.name}</span>
                                    <span className="text-xs font-normal tabular-nums text-fg-subtle">
                                      Weight {r.weight} · max {r.max} pts
                                    </span>
                                  </span>
                                }
                                className="min-w-0 flex-1"
                              >
                                {r.desc && <p className="text-xs text-fg-muted">{r.desc}</p>}
                                <div className="flex items-center gap-3 pt-1 sm:gap-4">
                                  <input
                                    type="range"
                                    min={0}
                                    max={r.max}
                                    value={currentVal}
                                    onChange={(e) => handleScoreChange(r.key, e.target.value, r.max)}
                                    aria-label={`${r.name} slider`}
                                    className="h-2 min-w-0 flex-1 cursor-pointer accent-accent"
                                  />
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={r.max}
                                      value={currentVal}
                                      onChange={(e) => handleScoreChange(r.key, e.target.value, r.max)}
                                      className="w-16 text-center font-mono tabular-nums"
                                    />
                                    <span className="w-8 text-xs tabular-nums text-fg-subtle">/ {r.max}</span>
                                  </div>
                                </div>
                              </Field>
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>

                    <section className="space-y-3">
                      <SectionTitle
                        icon={MessageSquareText}
                        title="Feedback"
                        description="Shared with the team when results are released."
                      />
                      <Field label="Constructive feedback & notes">
                        <Textarea
                          rows={3}
                          value={selectedTeam.feedback || ""}
                          onChange={(e) => handleFeedbackChange(e.target.value)}
                          placeholder="Add specific comments on architecture, implementation, and strengths..."
                        />
                      </Field>
                    </section>
                  </form>
                </CardContent>

                <CardFooter className="sticky bottom-0 z-10 flex-wrap justify-between gap-3 rounded-b-xl bg-surface/95 py-3 backdrop-blur-sm">
                  <span className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                    Status
                    <Badge tone={selectedTeam.status === "Evaluated" ? "success" : "warning"} dot>{selectedTeam.status}</Badge>
                    <span className="tabular-nums">
                      Total <span className="font-semibold text-fg">{computeTotal(selectedTeam.scores)}</span> / 100
                    </span>
                  </span>
                  <Button type="submit" form="judge-evaluation-form">
                    <Gavel aria-hidden="true" />
                    Commit & certify score
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={MousePointerClick}
                  title="Select a submission"
                  description="Choose a finalist from the queue to open its rubric."
                />
              </Card>
            )}
          </div>
        </div>

        {/* Modal: Enter Judge Access Code */}
        <Dialog
          open={showCodeModal}
          onClose={() => setShowCodeModal(false)}
          title="Enter judge access code"
          description="Hackathon organizers generate unique judge access codes. Enter your assigned code once to unlock and evaluate submissions for that hackathon."
        >
          <form onSubmit={handleRedeemCode} className="space-y-5">
            <Field
              label="Access code"
              hint="e.g. JUDGE-DEVPULSE-7X9K"
              error={codeNotice?.type === 'error' ? codeNotice.text : undefined}
              required
            >
              <Input
                type="text"
                required
                autoComplete="off"
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. JUDGE-DEVPULSE-7X9K"
                className="font-mono font-semibold uppercase tracking-wider"
              />
            </Field>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowCodeModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <KeyRound aria-hidden="true" />
                Verify & unlock hackathon
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
