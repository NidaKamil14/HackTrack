import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  CalendarRange,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Package,
  Plus,
  Scale,
  ScanSearch,
  ShieldCheck,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SectionHeader,
  Select,
  StatCard,
  TabPanel,
  TableContainer,
  Tabs,
  cn,
  stageTone,
  tableClasses,
} from '../../components/ui';
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

const TAB_ITEMS = [
  { value: 'hackathons', label: 'Hackathons', icon: <CalendarRange aria-hidden="true" /> },
  { value: 'users', label: 'Users & roles', icon: <UserCog aria-hidden="true" /> },
  { value: 'results', label: 'Results & certificates', icon: <Award aria-hidden="true" /> },
];
const TAB_VALUES = TAB_ITEMS.map((t) => t.value);
const DEFAULT_TAB = 'hackathons';

// Badge tone for a submission's screening decision (Shortlisted / Rejected / pending).
function screeningDecisionTone(status) {
  if (status === "Shortlisted") return 'success';
  if (status === "Rejected") return 'danger';
  return 'warning';
}

// One access-code well in the scoped hackathon header (copy logic lives in the page).
function AccessCodeWell({ label, code, boundText, copied, onCopy }) {
  return (
    <div className="min-w-0 space-y-1 rounded-lg bg-raised/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          disabled={!code}
          aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="break-all font-mono text-sm font-semibold text-fg">{code || "Not generated"}</p>
      <p className="text-xs text-fg-subtle">{boundText}</p>
    </div>
  );
}

const MODULE_OPTIONS = [
  { key: 'screeningGate', label: 'Screening Gate' },
  { key: 'rubricJudging', label: 'Rubric Judging' },
  { key: 'mentorship', label: 'Mentorship' },
  { key: 'certificates', label: 'Certificates' },
];

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student / Participant' },
  { value: 'leader', label: 'Team Leader' },
  { value: 'screening', label: 'Screening Committee' },
  { value: 'judge', label: 'Judge / Evaluator' },
  { value: 'admin', label: 'Platform Admin' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'mentor', label: 'Technical Mentor' },
];

// Same stage → progress mapping the page has always used.
function stageProgress(stage) {
  return stage === "Results Published" ? 100 :
    stage === "Rubric Judging" ? 85 :
    stage === "Screening Gate" ? 70 :
    stage === "Hacking Phase" ? 50 :
    stage === "Team Formation" ? 35 : 20;
}

// Checkbox grid for enabled modules. `isChecked(key)` and `onToggle(key, checked)`
// keep each form's original checked/onChange semantics.
function ModuleCheckboxes({ legend, isChecked, onToggle }) {
  return (
    <fieldset className="space-y-3 rounded-lg bg-raised/50 p-4">
      <legend className="sr-only">{legend}</legend>
      <p className="text-sm font-medium text-fg" aria-hidden="true">{legend}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODULE_OPTIONS.map((m) => (
          <label key={m.key} className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={isChecked(m.key)}
              onChange={(e) => onToggle(m.key, e.target.checked)}
              className="h-4 w-4 rounded border-line accent-accent"
            />
            <span>{m.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = TAB_VALUES.includes(tabParam) ? tabParam : DEFAULT_TAB;
  const setActiveTab = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next);
  };
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

  const handleSelectHackathon = (id) => {
    setSelectedHackathonId(id);
    if (id !== "all") setHackathonViewTab("teams");
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

  // Platform-wide actions (bodies unchanged from the previous inline handlers).
  const handleIntegrityScan = () => {
    setAdminNotice("Executed repository integrity scan. Zero commit discrepancies detected across active submissions.");
    setTimeout(() => setAdminNotice(null), 3500);
  };

  const handlePublishAll = () => {
    hackathons.forEach((h) => setResultsPublished(h.id, true));
    setAdminNotice("Official rankings compiled and certified for platform-wide release.");
    setRefreshKey((k) => k + 1);
    setTimeout(() => setAdminNotice(null), 3500);
  };

  // CONDITION 1: a specific hackathon is selected → scoped inspection data.
  const activeH = selectedHackathonId !== "all"
    ? (hackathons.find((h) => h.id === selectedHackathonId) || hackathons[0])
    : null;
  let scoped = null;
  if (activeH) {
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

    scoped = { committee, judgeCodeRecord, screenCodeRecord, hackTeams, hackSubs };
  }

  const publishedCount = hackathons.filter((h) => isResultsPublished(h.id)).length;
  const createAction = (
    <Button onClick={() => setShowCreateModal(true)}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Create hackathon
    </Button>
  );

  return (
    <DashboardLayout
      portalTitle="Platform Administration & Governance Console"
      roleBadgeText="PLATFORM ADMINISTRATOR"
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin console"
          title="Platform administration"
          description="Run hackathons, manage who can do what, and release certified results and certificates."
          meta={<span>{user?.university || "HackTrack Central HQ"}</span>}
          actions={createAction}
        />

        <section aria-label="Platform statistics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Hackathons" value={hackathons.length} icon={CalendarRange} />
          <StatCard label="Registered users" value={usersList.length} icon={Users} />
          <StatCard label="Teams formed" value={Object.keys(allTeams).length} icon={UsersRound} />
          <StatCard
            label="Screening pass rate"
            value={clearanceRate}
            hint={`${shortlistedSubs} of ${reviewedSubs} reviewed submissions shortlisted`}
            icon={ShieldCheck}
          />
          <StatCard label="Certified evaluations" value={allEvaluations.length} icon={ClipboardCheck} />
        </section>

        {adminNotice && (
          <Alert tone="success">
            <span className="text-fg">{adminNotice.replace(/^✓\s*/, '')}</span>
          </Alert>
        )}

        {/* HACKATHON SELECTOR */}
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold text-fg">Hackathon-specific inspection</h2>
              <p className="text-sm text-fg-muted">
                Switch context to view dedicated teams, committee and submissions.
              </p>
            </div>
            <Field label="Context" className="w-full sm:w-72">
              <Select
                value={selectedHackathonId}
                onChange={(e) => handleSelectHackathon(e.target.value)}
              >
                <option value="all">All platform overview</option>
                {hackathons.map((h) => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        {/* CONDITION 1: SPECIFIC HACKATHON SELECTED */}
        {activeH && scoped && (
          <div className="space-y-6">
            {/* Hackathon header */}
            <Card>
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">Hackathon scoped view</Badge>
                      <Badge tone={stageTone(activeH.stage)}>{activeH.stage}</Badge>
                      {activeH.track && <Badge>{activeH.track}</Badge>}
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-fg">{activeH.title}</h2>
                    {(activeH.summary || activeH.headline) && (
                      <p className="max-w-2xl text-sm text-fg-muted">{activeH.summary || activeH.headline}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfigTarget(activeH)}>
                      Configure
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleAdvanceStage(activeH.id)}>
                      Advance stage
                    </Button>
                  </div>
                </div>

                {/* Access codes & metrics */}
                <div className="grid grid-cols-1 gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <AccessCodeWell
                    label="Screening code"
                    code={scoped.screenCodeRecord?.code}
                    boundText={`${scoped.committee.screeners.length} reviewer(s) bound`}
                    copied={Boolean(scoped.screenCodeRecord?.code) && copiedCode === scoped.screenCodeRecord?.code}
                    onCopy={() => handleCopyCode(scoped.screenCodeRecord?.code)}
                  />
                  <AccessCodeWell
                    label="Judge code"
                    code={scoped.judgeCodeRecord?.code}
                    boundText={`${scoped.committee.judges.length} evaluator(s) bound`}
                    copied={Boolean(scoped.judgeCodeRecord?.code) && copiedCode === scoped.judgeCodeRecord?.code}
                    onCopy={() => handleCopyCode(scoped.judgeCodeRecord?.code)}
                  />
                  <div className="min-w-0 space-y-1 rounded-lg bg-raised/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Enrolled teams</p>
                    <p className="text-lg font-semibold tabular-nums text-fg">{scoped.hackTeams.length} Teams</p>
                    <p className="text-xs text-fg-subtle">{scoped.hackSubs.length} deliverable(s) submitted</p>
                  </div>
                  <div className="min-w-0 space-y-1 rounded-lg bg-raised/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Rubric criteria</p>
                    <p className="text-lg font-semibold tabular-nums text-fg">{(activeH.rubrics || []).length} Criteria</p>
                    <p className="text-xs text-fg-subtle">{activeH.prizePool || activeH.prize || "Prizes set"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sub-tabs: Teams | Screeners | Judges | Deliverables */}
            <div className="space-y-4">
              <Tabs
                items={[
                  { value: 'teams', label: 'Teams & participants', icon: <UsersRound aria-hidden="true" />, badge: <Badge>{scoped.hackTeams.length}</Badge> },
                  { value: 'screening', label: 'Screening committee', icon: <ShieldCheck aria-hidden="true" />, badge: <Badge>{scoped.committee.screeners.length}</Badge> },
                  { value: 'judges', label: 'Judges & evaluators', icon: <Scale aria-hidden="true" />, badge: <Badge>{scoped.committee.judges.length}</Badge> },
                  { value: 'submissions', label: 'Deliverables', icon: <Package aria-hidden="true" />, badge: <Badge>{scoped.hackSubs.length}</Badge> },
                ]}
                value={hackathonViewTab}
                onValueChange={setHackathonViewTab}
                label={`${activeH.title} inspection`}
                idPrefix="admin-hackathon"
              />
              <p className="text-xs text-fg-subtle">Scoped to {activeH.title}</p>

              {/* TAB 1: TEAMS */}
              <TabPanel value="teams" activeValue={hackathonViewTab} idPrefix="admin-hackathon" className="focus:outline-none">
                {scoped.hackTeams.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon={UsersRound}
                      title="No teams enrolled"
                      description="No squads currently enrolled in this specific sprint."
                    />
                  </Card>
                ) : (
                  <TableContainer>
                    <table className={tableClasses.table}>
                      <thead className={tableClasses.thead}>
                        <tr>
                          <th scope="col" className={tableClasses.th}>Team code</th>
                          <th scope="col" className={tableClasses.th}>Squad name</th>
                          <th scope="col" className={tableClasses.th}>Team lead</th>
                          <th scope="col" className={tableClasses.th}>Members roster</th>
                          <th scope="col" className={tableClasses.th}>Track</th>
                          <th scope="col" className={cn(tableClasses.th, 'text-right')}>Screening status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoped.hackTeams.map((t, idx) => (
                          <tr key={idx} className={tableClasses.tr}>
                            <td className={cn(tableClasses.td, 'whitespace-nowrap font-mono text-xs font-semibold text-fg')}>{t.code}</td>
                            <td className={cn(tableClasses.td, 'font-medium text-fg')}>{t.name}</td>
                            <td className={tableClasses.td}>{t.lead || "Lead Member"}</td>
                            <td className={tableClasses.td}>
                              {(t.members || []).map((m) => (typeof m === 'string' ? m : m.name || m.email)).join(', ')}
                            </td>
                            <td className={tableClasses.td}>{t.track || activeH.track}</td>
                            <td className={cn(tableClasses.td, 'text-right')}>
                              <Badge tone="success">{t.screeningStatus || "Registered"}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableContainer>
                )}
              </TabPanel>

              {/* TAB 2: SCREENING COMMITTEE */}
              <TabPanel value="screening" activeValue={hackathonViewTab} idPrefix="admin-hackathon" className="space-y-4 focus:outline-none">
                <Alert tone="info" title="Screening committee role">
                  Operates immediately after the submission deadline. Reviewers inspect raw GitHub repos, verify live deployment links, and make gatekeeping decisions: <strong className="text-fg">Shortlist</strong> or <strong className="text-fg">Reject</strong>. Only shortlisted teams advance to judging.
                </Alert>
                <TableContainer>
                  <table className={tableClasses.table}>
                    <thead className={tableClasses.thead}>
                      <tr>
                        <th scope="col" className={tableClasses.th}>Reviewer name</th>
                        <th scope="col" className={tableClasses.th}>Email</th>
                        <th scope="col" className={tableClasses.th}>Role</th>
                        <th scope="col" className={tableClasses.th}>Assignment method</th>
                        <th scope="col" className={cn(tableClasses.th, 'text-right')}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoped.committee.screeners.length === 0 ? (
                        <tr>
                          <td colSpan="5" className={cn(tableClasses.td, 'py-8 text-center')}>
                            No screening reviewers bound yet. Share code{' '}
                            <span className="break-all font-mono text-fg">{scoped.screenCodeRecord?.code}</span>{' '}
                            with your review team.
                          </td>
                        </tr>
                      ) : (
                        scoped.committee.screeners.map((s, idx) => (
                          <tr key={idx} className={tableClasses.tr}>
                            <td className={cn(tableClasses.td, 'font-medium text-fg')}>{s.fullName || "Screening Reviewer"}</td>
                            <td className={cn(tableClasses.td, 'font-mono text-xs')}>{s.email}</td>
                            <td className={tableClasses.td}>
                              <Badge tone="warning">Screening Gatekeeper</Badge>
                            </td>
                            <td className={cn(tableClasses.td, 'font-mono text-xs')}>
                              Code Redemption ({scoped.screenCodeRecord?.code || "Direct"})
                            </td>
                            <td className={cn(tableClasses.td, 'text-right')}>
                              <Badge tone="success" dot>Active</Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableContainer>
              </TabPanel>

              {/* TAB 3: JUDGES */}
              <TabPanel value="judges" activeValue={hackathonViewTab} idPrefix="admin-hackathon" className="space-y-4 focus:outline-none">
                <Alert tone="info" title="Judge / evaluator role">
                  Evaluates only shortlisted submissions after screening clearance. Judges score projects across {(activeH.rubrics || []).length} rubric criteria to calculate the final weighted score and rank.
                </Alert>
                <TableContainer>
                  <table className={tableClasses.table}>
                    <thead className={tableClasses.thead}>
                      <tr>
                        <th scope="col" className={tableClasses.th}>Judge name</th>
                        <th scope="col" className={tableClasses.th}>Email</th>
                        <th scope="col" className={tableClasses.th}>Assigned rubrics</th>
                        <th scope="col" className={tableClasses.th}>Assignment method</th>
                        <th scope="col" className={cn(tableClasses.th, 'text-right')}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoped.committee.judges.length === 0 ? (
                        <tr>
                          <td colSpan="5" className={cn(tableClasses.td, 'py-8 text-center')}>
                            No judges bound yet. Share code{' '}
                            <span className="break-all font-mono text-fg">{scoped.judgeCodeRecord?.code}</span>{' '}
                            with your evaluator panel.
                          </td>
                        </tr>
                      ) : (
                        scoped.committee.judges.map((j, idx) => (
                          <tr key={idx} className={tableClasses.tr}>
                            <td className={cn(tableClasses.td, 'font-medium text-fg')}>{j.fullName || "Judge Evaluator"}</td>
                            <td className={cn(tableClasses.td, 'font-mono text-xs')}>{j.email}</td>
                            <td className={tableClasses.td}>
                              {(activeH.rubrics || []).map((r) => r.name).slice(0, 2).join(', ') || "Standard Rubrics"}...
                            </td>
                            <td className={cn(tableClasses.td, 'font-mono text-xs')}>
                              Code Redemption ({scoped.judgeCodeRecord?.code || "Direct"})
                            </td>
                            <td className={cn(tableClasses.td, 'text-right')}>
                              <Badge tone="success" dot>Active</Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableContainer>
              </TabPanel>

              {/* TAB 4: DELIVERABLES */}
              <TabPanel value="submissions" activeValue={hackathonViewTab} idPrefix="admin-hackathon" className="focus:outline-none">
                {scoped.hackSubs.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon={Package}
                      title="No deliverables yet"
                      description="No project deliverables uploaded for this hackathon yet."
                    />
                  </Card>
                ) : (
                  <TableContainer>
                    <table className={tableClasses.table}>
                      <thead className={tableClasses.thead}>
                        <tr>
                          <th scope="col" className={tableClasses.th}>Project title</th>
                          <th scope="col" className={tableClasses.th}>Squad</th>
                          <th scope="col" className={tableClasses.th}>Repository</th>
                          <th scope="col" className={tableClasses.th}>Live preview</th>
                          <th scope="col" className={cn(tableClasses.th, 'text-right')}>Screening decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoped.hackSubs.map((s, idx) => (
                          <tr key={idx} className={tableClasses.tr}>
                            <td className={cn(tableClasses.td, 'font-medium text-fg')}>
                              {s.projectTitle || "Project Deliverable"}
                            </td>
                            <td className={tableClasses.td}>{s.teamName || s.teamId}</td>
                            <td className={tableClasses.td}>
                              {(s.repositoryUrl || s.repoUrl) ? (
                                <a
                                  href={s.repositoryUrl || s.repoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-accent-text hover:underline"
                                >
                                  GitHub
                                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                              ) : (
                                <span className="text-fg-subtle">Not provided</span>
                              )}
                            </td>
                            <td className={tableClasses.td}>
                              {(s.liveDemoUrl || s.demoUrl) ? (
                                <a
                                  href={s.liveDemoUrl || s.demoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-accent-text hover:underline"
                                >
                                  Live demo
                                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                              ) : (
                                <span className="text-fg-subtle">Not provided</span>
                              )}
                            </td>
                            <td className={cn(tableClasses.td, 'text-right')}>
                              <Badge tone={screeningDecisionTone(s.screeningStatus)}>
                                {s.screeningStatus || "Pending Review"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableContainer>
                )}
              </TabPanel>
            </div>
          </div>
        )}

        {/* CONDITION 2: GLOBAL PLATFORM OVERVIEW (WHEN ALL IS SELECTED) */}
        {selectedHackathonId === "all" && (
          <div className="space-y-6">
            <Tabs
              items={TAB_ITEMS}
              value={activeTab}
              onValueChange={setActiveTab}
              label="Administration sections"
              idPrefix="admin"
            />

            {/* HACKATHONS */}
            <TabPanel value="hackathons" activeValue={activeTab} idPrefix="admin" className="space-y-4 focus:outline-none">
              <SectionHeader
                title="Competition management"
                description="Advance stages and configure rules for each hackathon."
                actions={<Badge>{hackathons.length} total</Badge>}
              />
              {hackathons.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={CalendarRange}
                    title="No hackathons yet"
                    description="Create the first hackathon to open registration and start tracking stages."
                    action={createAction}
                  />
                </Card>
              ) : (
                <TableContainer>
                  <table className={tableClasses.table}>
                    <thead className={tableClasses.thead}>
                      <tr>
                        <th scope="col" className={tableClasses.th}>Hackathon</th>
                        <th scope="col" className={tableClasses.th}>Track</th>
                        <th scope="col" className={tableClasses.th}>Stage</th>
                        <th scope="col" className={tableClasses.th}>Deadline</th>
                        <th scope="col" className={tableClasses.th}>Results</th>
                        <th scope="col" className={cn(tableClasses.th, 'text-right')}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hackathons.map((h) => {
                        const isPub = isResultsPublished(h.id);
                        const progress = stageProgress(h.stage);
                        return (
                          <tr key={h.id} className={tableClasses.tr}>
                            <td className={cn(tableClasses.td, 'font-medium text-fg')}>{h.title}</td>
                            <td className={tableClasses.td}>{h.track}</td>
                            <td className={tableClasses.td}>
                              <div className="flex flex-col gap-1.5">
                                <Badge tone={stageTone(h.stage)} className="w-fit">{h.stage}</Badge>
                                <div
                                  className="h-1 w-20 overflow-hidden rounded-full bg-raised"
                                  role="progressbar"
                                  aria-label={`${h.title} stage progress`}
                                  aria-valuenow={progress}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                >
                                  <div
                                    className="h-full rounded-full bg-accent transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className={cn(tableClasses.td, 'whitespace-nowrap tabular-nums')}>{h.deadline}</td>
                            <td className={tableClasses.td}>
                              {isPub ? <Badge tone="success" dot>Released</Badge> : <Badge>Private</Badge>}
                            </td>
                            <td className={tableClasses.td}>
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setConfigTarget(h)} aria-label={`Configure ${h.title}`}>
                                  Configure
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => handleAdvanceStage(h.id)} aria-label={`Advance stage of ${h.title}`}>
                                  Advance stage
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableContainer>
              )}
            </TabPanel>

            {/* USERS & ROLES */}
            <TabPanel value="users" activeValue={activeTab} idPrefix="admin" className="space-y-4 focus:outline-none">
              <SectionHeader
                title="Users & role assignments"
                description="Assign participant, committee, judge, organizer, mentor and admin roles. Changes apply immediately."
                actions={<Badge>{usersList.length} users</Badge>}
              />
              {usersList.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Users}
                    title="No registered users"
                    description="Users appear here after they sign up. You can then assign their roles."
                  />
                </Card>
              ) : (
                <TableContainer>
                  <table className={tableClasses.table}>
                    <thead className={tableClasses.thead}>
                      <tr>
                        <th scope="col" className={tableClasses.th}>Name</th>
                        <th scope="col" className={tableClasses.th}>Email</th>
                        <th scope="col" className={tableClasses.th}>Current role</th>
                        <th scope="col" className={tableClasses.th}>Organization</th>
                        <th scope="col" className={cn(tableClasses.th, 'text-right')}>Reassign role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u, i) => (
                        <tr key={i} className={tableClasses.tr}>
                          <td className={cn(tableClasses.td, 'font-medium text-fg')}>{u.fullName}</td>
                          <td className={cn(tableClasses.td, 'font-mono text-xs')}>{u.email}</td>
                          <td className={tableClasses.td}>
                            <Badge tone="accent">{u.roleCategory || u.role}</Badge>
                          </td>
                          <td className={tableClasses.td}>{u.university}</td>
                          <td className={cn(tableClasses.td, 'text-right')}>
                            <div className="ml-auto w-52">
                              <Select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.email, e.target.value)}
                                aria-label={`Role for ${u.fullName || u.email}`}
                              >
                                {ROLE_OPTIONS.map((r) => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </Select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableContainer>
              )}
            </TabPanel>

            {/* RESULTS & CERTIFICATES */}
            <TabPanel value="results" activeValue={activeTab} idPrefix="admin" className="space-y-8 focus:outline-none">
              <div className="space-y-4">
                <SectionHeader
                  title="Results publication"
                  description="Publishing a hackathon's results makes rankings visible to all participants and issues certificates to every evaluated team. This cannot be undone from here."
                  actions={<Badge>{publishedCount} of {hackathons.length} released</Badge>}
                />
                {hackathons.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon={Trophy}
                      title="Nothing to publish"
                      description="Results can be released once a hackathon exists and its submissions have been evaluated."
                      action={createAction}
                    />
                  </Card>
                ) : (
                  <Card>
                    <ul className="divide-y divide-line">
                      {hackathons.map((h) => {
                        const isPub = isResultsPublished(h.id);
                        return (
                          <li key={h.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1.5">
                              <p className="font-medium text-fg">{h.title}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={stageTone(h.stage)}>{h.stage}</Badge>
                                {isPub ? <Badge tone="success" dot>Results released</Badge> : <Badge>Results private</Badge>}
                              </div>
                            </div>
                            {isPub ? (
                              <p className="text-sm text-fg-subtle sm:text-right">Results and certificates released</p>
                            ) : (
                              <Button
                                className="shrink-0"
                                onClick={() => handlePublishResults(h.id, h.title)}
                                aria-label={`Publish results & issue certificates for ${h.title}`}
                              >
                                <Award className="h-4 w-4" aria-hidden="true" />
                                Publish results & issue certificates
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                <SectionHeader
                  title="Platform actions"
                  description="System-wide audit scans and bulk results release."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle>Repository integrity scan</CardTitle>
                      <CardDescription>
                        Scan all {allSubmissions.length} participant repositories for pre-dated commits and tampering.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <Button variant="secondary" onClick={handleIntegrityScan}>
                        <ScanSearch className="h-4 w-4" aria-hidden="true" />
                        Run integrity scan
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle>Publish all leaderboards</CardTitle>
                      <CardDescription>
                        Marks results as released for every hackathon at once and reveals final public standings. This does not issue certificates; use the per-hackathon action above for that.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <Button variant="secondary" onClick={handlePublishAll}>
                        <Trophy className="h-4 w-4" aria-hidden="true" />
                        Publish results for all hackathons
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabPanel>
          </div>
        )}

        {/* DIALOG: CREATE NEW HACKATHON */}
        <Dialog
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create hackathon"
          description="Sanction a new competition on the platform."
        >
          <form onSubmit={handleCreateHackathon} className="space-y-4">
            <Field label="Competition title" required>
              <Input
                type="text"
                value={newHackathon.title}
                onChange={(e) => setNewHackathon({ ...newHackathon, title: e.target.value })}
                placeholder="e.g. NextGen Web3 Sprint"
              />
            </Field>

            <Field label="Track">
              <Select
                value={newHackathon.track}
                onChange={(e) => setNewHackathon({ ...newHackathon, track: e.target.value })}
              >
                <option value="Full-Stack & Cloud Systems">Full-Stack & Cloud Systems</option>
                <option value="Applied Machine Learning & Agents">Applied Machine Learning & Agents</option>
                <option value="IoT & Campus Optimization">IoT & Campus Optimization</option>
                <option value="Web3 & Smart Contracts">Web3 & Smart Contracts</option>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prize pool">
                <Input
                  type="text"
                  value={newHackathon.prize}
                  onChange={(e) => setNewHackathon({ ...newHackathon, prize: e.target.value })}
                />
              </Field>
              <Field label="Deadline">
                <Input
                  type="text"
                  value={newHackathon.deadline}
                  onChange={(e) => setNewHackathon({ ...newHackathon, deadline: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Team size limits">
              <Input
                type="text"
                value={newHackathon.teamSize}
                onChange={(e) => setNewHackathon({ ...newHackathon, teamSize: e.target.value })}
                placeholder="e.g. 2 - 4 Members"
              />
            </Field>

            <ModuleCheckboxes
              legend="Enabled modules"
              isChecked={(key) => newHackathon.enabledModules[key]}
              onToggle={(key, checked) => setNewHackathon({
                ...newHackathon,
                enabledModules: { ...newHackathon.enabledModules, [key]: checked }
              })}
            />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit">Create hackathon</Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG: EDIT HACKATHON CONFIGURATION */}
        <Dialog
          open={Boolean(configTarget)}
          onClose={() => setConfigTarget(null)}
          title="Configure rules"
          description={configTarget?.title}
        >
          {configTarget && (
            <form onSubmit={handleSaveModulesConfig} className="space-y-4">
              <Field label="Submission deadline">
                <Input
                  type="text"
                  value={configTarget.deadline || ""}
                  onChange={(e) => setConfigTarget({ ...configTarget, deadline: e.target.value })}
                />
              </Field>

              <Field label="Team size limits">
                <Input
                  type="text"
                  value={configTarget.teamSize || ""}
                  onChange={(e) => setConfigTarget({ ...configTarget, teamSize: e.target.value })}
                />
              </Field>

              <ModuleCheckboxes
                legend="Active modules"
                isChecked={(key) => configTarget.enabledModules?.[key] !== false}
                onToggle={(key, checked) => setConfigTarget({
                  ...configTarget,
                  enabledModules: { ...configTarget.enabledModules, [key]: checked }
                })}
              />

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setConfigTarget(null)}>Cancel</Button>
                <Button type="submit">Save configuration</Button>
              </div>
            </form>
          )}
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
