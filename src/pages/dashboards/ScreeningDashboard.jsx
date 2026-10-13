import React, { useState, useMemo } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Inbox,
  KeyRound,
  Layers,
  MousePointerClick,
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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

/* Review-queue pattern (shared look with Judge and Mentor dashboards) */
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

const statusTone = (status) =>
  status === "Shortlisted" ? "success" : status === "Rejected" ? "danger" : status === "Under Review" ? "info" : "warning";

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
          eyebrow={`Screening gateway · ${user?.university || "Review Board"}`}
          title="Screening Review Queue"
          description="Verify compliance rules and add remarks before forwarding entries to judges."
        />

        {feedbackNotice && <Alert tone={noticeTone}>{feedbackNotice.text}</Alert>}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Finalized entries" value={total} icon={Layers} />
          <StatCard label="Pending review" value={pendingCount} icon={Clock} />
          <StatCard label="Shortlisted" value={shortlistedCount} icon={CheckCircle2} />
          <StatCard label="Rejected" value={rejectedCount} icon={XCircle} />
        </div>

        {/* Role explanation + access code entry */}
        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-fg">Screening Committee (Gatekeeper)</p>
                <p className="text-sm leading-relaxed text-fg-muted">
                  You review <strong className="font-medium text-fg">all raw submissions</strong> right after the deadline. Verify commit freshness, live URL health, and documentation to mark entries as <strong className="font-medium text-fg">Shortlisted</strong> (which sends them to Judges) or <strong className="font-medium text-fg">Rejected</strong>.
                </p>
              </div>
            </div>
            <Button variant="secondary" className="shrink-0" onClick={() => setShowCodeModal(true)}>
              <KeyRound aria-hidden="true" />
              Enter Screening Access Code
            </Button>
          </CardContent>
        </Card>

        {codeNotice && (
          <Alert tone={codeNotice.type === 'success' ? 'success' : 'danger'}>{codeNotice.text}</Alert>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
          <p className="text-xs tabular-nums text-fg-subtle">
            Showing {filtered.length} of {total} submissions
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Queue */}
          <div>
            <QueueList title="Submissions" count={`${filtered.length} in queue`}>
              {filtered.length === 0 ? (
                <EmptyState
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
                      badge={<Badge tone={statusTone(sub.status)}>{sub.status}</Badge>}
                      meta={`${sub.projectTitle} · ${sub.hackathonTitle}`}
                    />
                  ))}
                </ul>
              )}
            </QueueList>
          </div>

          {/* Review panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-fg-subtle">
                      {selected.hackathonTitle} · {selected.track}
                    </p>
                    <CardTitle as="h2" className="text-lg">{selected.teamName}</CardTitle>
                    <CardDescription>
                      <span className="font-medium text-fg">{selected.projectTitle}</span> · Lead: {selected.lead}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge tone={statusTone(selected.status)} dot>{selected.status}</Badge>
                    <span className="text-xs text-fg-subtle">{selected.submissionDate}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
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

                  {selected.projectDescription && (
                    <p className="rounded-lg bg-raised/50 p-3 text-sm leading-relaxed text-fg-muted">
                      {selected.projectDescription}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <LinkButton href={selected.repoUrl}>Inspect repository</LinkButton>
                    <LinkButton href={selected.demoUrl}>Live deployment</LinkButton>
                    {selected.submissionFiles && selected.submissionFiles.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selected.submissionFiles.map((f, fIdx) => (
                          <Badge key={fIdx} tone="neutral" className="font-mono">
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            {f.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="eyebrow mb-2">Compliance checklist</legend>
                    <p className="text-xs text-fg-subtle">Select a gate to toggle pass / fail.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {COMPLIANCE_CHECKS.map(({ key, label }) => {
                        const passed = Boolean(selected.checks[key]);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleCheck(selected.id, key)}
                            aria-pressed={passed}
                            className={cn(
                              'flex min-h-10 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                              passed
                                ? 'border-success/25 bg-success/10 text-fg hover:border-success/40'
                                : 'border-danger/25 bg-danger/10 text-fg hover:border-danger/40'
                            )}
                          >
                            <span>{label}</span>
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', passed ? 'text-success' : 'text-danger')}>
                              {passed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
                              {passed ? "Pass" : "Fail"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <Field label="Screening remarks & evaluator notes">
                    <Input
                      type="text"
                      value={activeRemarks}
                      onChange={(e) => handleRemarkChange(selected.id, e.target.value)}
                      placeholder="e.g. Clean commit tree verified; endpoints respond under 200ms latency ceiling."
                    />
                  </Field>
                </CardContent>

                <CardFooter className="flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleDecision(selected.id, "Under Review", activeRemarks)}>
                    Mark under review
                  </Button>
                  <Button variant="danger-ghost" size="sm" onClick={() => openRejectModal(selected)}>
                    <XCircle aria-hidden="true" />
                    Reject entry
                  </Button>
                  <Button size="sm" onClick={() => handleDecision(selected.id, "Shortlisted", activeRemarks)}>
                    <CheckCircle2 aria-hidden="true" />
                    Shortlist team
                  </Button>
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

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setRejectModalTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmRejection}>
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

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
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
