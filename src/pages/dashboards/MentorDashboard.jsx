import React, { useState } from 'react';
import { ExternalLink, FileText, Inbox, Layers, Lightbulb, MessageSquare, MousePointerClick, PenLine, Send, Trophy, Users } from 'lucide-react';
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
  EmptyState,
  Field,
  PageHeader,
  StatCard,
  Textarea,
  cn,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { getAllTeams } from '../../utils/teamService';
import { getSubmissions } from '../../utils/submissionService';
import { getStoredHackathons } from '../../utils/hackathonService';
import { addNotification } from '../../utils/notificationService';

const STORAGE_MENTOR_KEY = "hacktrack_mentor_notes";

function getMentorNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_MENTOR_KEY);
    return raw ? JSON.parse(raw) : {
      "HT-DEV-42": "Focus on stress testing the dead-letter queue backoff strategy before final freeze.",
      "HT-AI-99": "Agent fallback loop is solid. Consider adding tracing telemetry for tool selection."
    };
  } catch {
    return {};
  }
}

function saveMentorNotes(notes) {
  try {
    localStorage.setItem(STORAGE_MENTOR_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error("Failed to save mentor notes:", err);
  }
}

/** Small icon tile used beside section headings. */
function IconTile({ icon: Icon, tone = 'accent' }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
        tone === 'success' ? 'bg-success/10 text-success ring-success/25' : 'bg-accent/15 text-accent-text ring-accent/25'
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/* Review-queue pattern (shared look with Judge and Screening dashboards) */
function QueueList({ title, count, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={Users} />
          <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{count}</span>
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
          selected ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-raised/50'
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className={cn('truncate text-sm font-medium', selected ? 'text-accent-text' : 'text-fg')}>{title}</span>
          {badge}
        </span>
        {meta && <span className="truncate text-xs text-fg-subtle">{meta}</span>}
      </button>
    </li>
  );
}

function LinkButton({ href, children }) {
  return (
    <Button as="a" href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
      <ExternalLink aria-hidden="true" />
      {children}
    </Button>
  );
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const hackathons = getStoredHackathons();
  const allTeams = getAllTeams();
  const submissions = getSubmissions();

  const [notesMap, setNotesMap] = useState(getMentorNotes);
  const [activeTeamCode, setActiveTeamCode] = useState(Object.keys(allTeams)[0] || "");
  const [currentNoteInput, setCurrentNoteInput] = useState("");
  const [notice, setNotice] = useState(null);

  const teamsList = Object.entries(allTeams).map(([code, t]) => ({ ...t, code }));
  const activeTeam = teamsList.find((t) => t.code === activeTeamCode) || teamsList[0];

  const activeSubmission = activeTeam
    ? submissions.find((s) => s.teamId === activeTeam.code || (s.teamName && s.teamName === activeTeam.name))
    : null;

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!activeTeam || !currentNoteInput.trim()) return;

    const updated = {
      ...notesMap,
      [activeTeam.code]: currentNoteInput.trim()
    };
    setNotesMap(updated);
    saveMentorNotes(updated);

    // Notify team leader
    if (activeTeam.leadEmail) {
      addNotification({
        userEmail: activeTeam.leadEmail,
        title: "New Mentoring Guidance Received",
        message: `${user?.fullName || "Technical Mentor"} posted guidance for squad "${activeTeam.name}": "${currentNoteInput.trim()}"`,
        type: "info",
        link: "/dashboard/student"
      });
    }

    addNotification({
      userEmail: user?.email,
      title: "Mentoring Guidance Dispatched",
      message: `You posted guidance for squad "${activeTeam.name}".`,
      type: "info",
      link: "/dashboard/mentor"
    });

    setNotice(`Mentoring note dispatched to squad ${activeTeam.name}.`);
    setCurrentNoteInput("");
    setTimeout(() => setNotice(null), 3500);
  };

  const isFinalized = activeSubmission?.status === 'finalized';

  return (
    <DashboardLayout
      portalTitle="Technical Mentor Guild"
      roleBadgeText="TECHNICAL MENTOR"
    >
      <div className="space-y-8">
        <PageHeader
          icon={Lightbulb}
          eyebrow={`Mentorship guild · ${user?.university || "Cloud & AI Guild"}`}
          title={`Welcome, ${user?.fullName || "Mentor"}`}
          description="Provide architectural guidance, review repository drafts, and conduct 1-on-1 check-ins."
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard tone="accent" label="Assigned sprints" value={hackathons.length} icon={Trophy} />
          <StatCard tone="cyan" label="Assigned squads" value={teamsList.length} icon={Users} />
          <StatCard
            tone="success"
            label="Notes dispatched"
            value={Object.keys(notesMap).length}
            icon={MessageSquare}
            hint={teamsList.length > 0 ? `${teamsList.filter((t) => notesMap[t.code]).length} of ${teamsList.length} squads advised` : undefined}
          />
          <StatCard
            tone="info"
            label="Deliverables staged"
            value={submissions.length}
            icon={Layers}
            hint={submissions.length > 0 ? `${submissions.filter((s) => s.status === 'finalized').length} finalized` : undefined}
          />
        </div>

        {notice && <Alert tone="success" title="Guidance sent">{notice}</Alert>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Queue */}
          <div>
            <QueueList title="Assigned squads" count={`${teamsList.length} squads`}>
              {teamsList.length === 0 ? (
                <EmptyState
                  illustration="team"
                  icon={Inbox}
                  title="No squads assigned"
                  description="Teams will appear here once they are formed for your hackathons."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {teamsList.map((t) => (
                    <QueueItem
                      key={t.code}
                      selected={activeTeam?.code === t.code}
                      onSelect={() => setActiveTeamCode(t.code)}
                      title={t.name}
                      badge={
                        notesMap[t.code] ? (
                          <Badge tone="success">Notes sent</Badge>
                        ) : (
                          <Badge tone="neutral">No notes</Badge>
                        )
                      }
                      meta={[t.hackathon, t.capacity].filter(Boolean).join(' · ')}
                    />
                  ))}
                </ul>
              )}
            </QueueList>
          </div>

          {/* Review panel */}
          <div className="lg:col-span-2">
            {activeTeam ? (
              <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <IconTile icon={Lightbulb} />
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-xs text-fg-subtle">{activeTeam.code}</p>
                      <CardTitle as="h2" className="text-lg">{activeTeam.name}</CardTitle>
                      <CardDescription>{activeTeam.hackathon} · Track: {activeTeam.track}</CardDescription>
                    </div>
                  </div>
                  <Badge tone="neutral">Leader: {activeTeam.lead}</Badge>
                </CardHeader>

                <CardContent className="space-y-5">
                  <section className="space-y-3" aria-labelledby="mentor-draft-heading">
                    <div className="flex items-center gap-3">
                      <IconTile icon={FileText} tone={isFinalized ? 'success' : 'accent'} />
                      <h3 id="mentor-draft-heading" className="text-sm font-semibold text-fg">Project draft</h3>
                    </div>
                    {activeSubmission ? (
                      <div className="space-y-3 rounded-lg border border-line bg-raised/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-fg">{activeSubmission.projectTitle || "Untitled Draft"}</h4>
                          <Badge tone={isFinalized ? "success" : "warning"} dot>
                            {isFinalized ? "Finalized" : "Draft"}
                          </Badge>
                        </div>
                        {activeSubmission.projectDescription && (
                          <p className="text-sm leading-relaxed text-fg-muted">{activeSubmission.projectDescription}</p>
                        )}
                        {(activeSubmission.repositoryUrl || activeSubmission.liveDemoUrl) && (
                          <div className="flex flex-wrap gap-2">
                            {activeSubmission.repositoryUrl && (
                              <LinkButton href={activeSubmission.repositoryUrl}>Inspect Git repo</LinkButton>
                            )}
                            {activeSubmission.liveDemoUrl && (
                              <LinkButton href={activeSubmission.liveDemoUrl}>Live demo</LinkButton>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        illustration="upload"
                        icon={FileText}
                        title="No deliverables yet"
                        description="This squad has not drafted a submission."
                        className="rounded-lg border border-dashed border-line py-8"
                      />
                    )}
                  </section>

                  {isFinalized && (
                    <Alert tone="info" title="Submission finalized">
                      This squad has locked its deliverables for review.
                    </Alert>
                  )}

                  {notesMap[activeTeam.code] && (
                    <section className="space-y-3" aria-labelledby="mentor-advisory-heading">
                      <div className="flex items-center gap-3">
                        <IconTile icon={MessageSquare} tone="success" />
                        <h3 id="mentor-advisory-heading" className="text-sm font-semibold text-fg">Current mentor advisory</h3>
                      </div>
                      <blockquote className="relative overflow-hidden rounded-lg bg-raised/50 py-4 pl-5 pr-4 text-sm leading-relaxed text-fg">
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-accent to-accent-2" aria-hidden="true" />
                        {notesMap[activeTeam.code]}
                      </blockquote>
                    </section>
                  )}

                  <form onSubmit={handleSaveNote} className="space-y-4 border-t border-line pt-5">
                    <div className="flex items-start gap-3">
                      <IconTile icon={PenLine} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-fg">Send guidance</h3>
                        <p className="mt-0.5 text-sm text-fg-muted">Your latest note replaces the current advisory for this squad.</p>
                      </div>
                    </div>
                    <Field
                      label="Post architectural guidance & office-hours advice"
                      hint={activeTeam.leadEmail ? "The team leader is notified when you send." : undefined}
                      required
                    >
                      <Textarea
                        rows={3}
                        value={currentNoteInput}
                        onChange={(e) => setCurrentNoteInput(e.target.value)}
                        placeholder="e.g. Recommended: add circuit breakers to handle API rate limits; clean up package dependencies..."
                      />
                    </Field>
                    <div className="flex justify-end">
                      <Button type="submit">
                        <Send aria-hidden="true" />
                        Dispatch guidance
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={MousePointerClick}
                  title="Select a squad"
                  description="Choose a team from the queue to review its draft and send guidance."
                />
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
