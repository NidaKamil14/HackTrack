import React, { useState, useMemo } from 'react';
import { ExternalLink, Gavel, Inbox, KeyRound, MousePointerClick, Users, CheckCircle2, Clock, Trophy } from 'lucide-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
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

/* Review-queue pattern (shared look with Screening and Mentor dashboards) */
function QueueList({ title, count, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <span className="text-xs tabular-nums text-fg-subtle">{count}</span>
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
          'flex w-full flex-col gap-1 border-l-2 px-5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
          selected ? 'border-accent bg-raised' : 'border-transparent hover:bg-raised/50'
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-fg">{title}</span>
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
    return <span className="inline-flex h-8 items-center text-sm text-fg-subtle">{children}: not provided</span>;
  }
  return (
    <Button as="a" href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
      <ExternalLink aria-hidden="true" />
      {children}
    </Button>
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
          eyebrow={`Judging panel · ${user?.university || "ACM Expert Review Panel"}`}
          title="Evaluation Chamber"
          description="Score pre-screened finalists across standardized rubrics."
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Assigned sprints" value={assignedHackathons.length} icon={Trophy} />
          <StatCard label="Finalist teams" value={teamsState.length} icon={Users} />
          <StatCard label="Completed" value={evaluatedCount} icon={CheckCircle2} />
          <StatCard label="Pending" value={pendingCount} icon={Clock} />
        </div>

        {/* Role explanation */}
        <Alert
          tone="info"
          title="Judge / Evaluator role"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowCodeModal(true)}>
              <KeyRound aria-hidden="true" />
              Enter judge access code
            </Button>
          }
        >
          You evaluate <strong className="font-medium text-fg">only shortlisted teams</strong> that passed the initial
          screening gate. Your scores directly compile into the final certified rankings according to this
          hackathon&apos;s specific rubrics.
        </Alert>

        {codeNotice && (
          <Alert
            tone={codeNotice.type === 'success' ? 'success' : 'danger'}
            title={codeNotice.type === 'success' ? 'Access code verified' : 'Access code not accepted'}
          >
            {codeNotice.text}
          </Alert>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
            <Badge tone="success">Screening-cleared finalists only</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Queue */}
          <div>
            <QueueList title="Assigned teams" count={`${filteredTeams.length} teams`}>
              {filteredTeams.length === 0 ? (
                <EmptyState
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
                            <Badge tone="success" className="tabular-nums">{computeTotal(t.scores)} pts</Badge>
                          ) : (
                            <Badge tone="warning">Pending</Badge>
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
          <div className="lg:col-span-2">
            {selectedTeam ? (
              <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-fg-subtle">Rubric evaluation · {selectedTeam.hackathon}</p>
                    <CardTitle as="h2" className="text-lg">{selectedTeam.name}</CardTitle>
                    <CardDescription>Track: {selectedTeam.track}</CardDescription>
                  </div>
                  <div className="rounded-lg bg-raised/50 px-3 py-2 text-right">
                    <p className="text-xs text-fg-subtle">Total score</p>
                    <p className="text-xl font-semibold tabular-nums text-fg">
                      {computeTotal(selectedTeam.scores)}
                      <span className="text-sm font-normal text-fg-subtle"> / 100</span>
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="success" dot>Gate cleared 4/4</Badge>
                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                      <LinkButton href={selectedTeam.repo}>Repository</LinkButton>
                      <LinkButton href={selectedTeam.demo}>Live demo</LinkButton>
                    </div>
                  </div>

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

                  <form id="judge-evaluation-form" onSubmit={handleSaveEvaluation} className="space-y-5">
                    <fieldset className="space-y-3">
                      <legend className="eyebrow mb-2">Score breakdown</legend>
                      <div className="divide-y divide-line rounded-lg bg-raised/50 px-4">
                        {currentRubrics.map((r) => {
                          const currentVal = selectedTeam.scores[r.key] !== undefined
                            ? selectedTeam.scores[r.key]
                            : (selectedTeam.scores[r.legacyKey] || 0);

                          return (
                            <Field
                              key={r.key}
                              label={r.name}
                              hint={`Weight ${r.weight} · max ${r.max} pts`}
                              className="py-3"
                            >
                              {r.desc && <p className="text-xs text-fg-muted">{r.desc}</p>}
                              <div className="flex items-center gap-4 pt-1">
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
                                  <span className="text-xs tabular-nums text-fg-subtle">/ {r.max}</span>
                                </div>
                              </div>
                            </Field>
                          );
                        })}
                      </div>
                    </fieldset>

                    <Field label="Constructive feedback & notes">
                      <Textarea
                        rows={3}
                        value={selectedTeam.feedback || ""}
                        onChange={(e) => handleFeedbackChange(e.target.value)}
                        placeholder="Add specific comments on architecture, implementation, and strengths..."
                      />
                    </Field>
                  </form>
                </CardContent>

                <CardFooter className="flex-wrap justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs text-fg-subtle">
                    Status
                    <Badge tone={selectedTeam.status === "Evaluated" ? "success" : "warning"}>{selectedTeam.status}</Badge>
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
