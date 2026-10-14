import React, { useState } from 'react';
import { Link, useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CircleCheck, KeyRound, SearchX, ShieldCheck, Trophy, Users } from 'lucide-react';
import { getHackathonById, getStoredHackathons } from '../utils/hackathonService';
import EventCover from '../components/art/EventCover';
import { useAuth } from '../context/AuthContext';
import { isUserRegistered, registerForHackathon } from '../utils/registrationService';
import { Alert, Badge, Button, Card, DescriptionList, EmptyState, TabPanel, Tabs, stageTone } from '../components/ui';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'rules', label: 'Rules & eligibility' },
  { value: 'screening', label: 'Screening & judging' },
];

function BulletList({ items = [], icon: Icon = Check, iconClass = 'text-success' }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-fg-muted">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function HackathonDetail({
  hackathonId: propHackathonId,
  onOpenTeamModal: propOpenTeamModal,
  setTeamCodeInput: propSetTeamCodeInput
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const outletContext = useOutletContext() || {};
  const onOpenTeamModal = propOpenTeamModal || outletContext.onOpenTeamModal || (() => {});
  const setTeamCodeInput = propSetTeamCodeInput || outletContext.setTeamCodeInput || (() => {});

  const currentId = propHackathonId || id;
  const found = getHackathonById(currentId);
  // Only fall back to the first event when no id was requested at all.
  const hackathon = found || (currentId ? null : getStoredHackathons()[0]);
  const [activeTab, setActiveTab] = useState("overview");

  // Registration state
  const [registeredOverride, setRegisteredOverride] = useState(null);
  const [regFeedback, setRegFeedback] = useState(null);

  if (!hackathon) {
    return (
      <div className="container-page py-16">
        <EmptyState
          illustration="search"
          icon={SearchX}
          titleAs="h1"
          title="Hackathon not found"
          description="This event may have been removed, or the link is incorrect."
          action={<Button as={Link} to="/hackathons" variant="secondary">Browse hackathons</Button>}
        />
      </div>
    );
  }

  const isRegistered = registeredOverride !== null
    ? registeredOverride
    : (user?.email && hackathon?.id ? isUserRegistered(user.email, hackathon.id) : false);

  const handleRegisterClick = () => {
    // 1. If not authenticated, redirect to login and preserve target
    if (!isAuthenticated || !user) {
      navigate('/login', {
        state: {
          from: location,
          registerHackathonId: hackathon.id
        }
      });
      return;
    }

    // 2. Already registered
    if (isRegistered) {
      navigate('/dashboard/student');
      return;
    }

    // 3. Register user
    const res = registerForHackathon(user.email, hackathon.id);
    if (res.success) {
      setRegisteredOverride(true);
      setRegFeedback({
        type: "success",
        text: `You're registered for ${hackathon.title}. You can now create or join a team for this competition.`
      });
    } else {
      setRegFeedback({
        type: "info",
        text: res.error || "Registration completed."
      });
      if (res.alreadyRegistered) {
        setRegisteredOverride(true);
      }
    }
  };

  const openTeamCode = () => {
    const code = hackathon.id === "devpulse-2026" ? "HT-DEV-42" : "HT-AI-99";
    setTeamCodeInput(code);
    onOpenTeamModal(code);
  };

  return (
    <div className="container-page py-8 sm:py-10">
      <Button as={Link} to="/hackathons" variant="ghost" size="sm" className="-ml-3">
        <ArrowLeft aria-hidden="true" />
        All hackathons
      </Button>

      {/* Header */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-line shadow-md">
        <EventCover hackathon={hackathon} wide className="h-32 w-full sm:h-44" />
      <header className="surface-hero -mt-px p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={stageTone(hackathon.stage)} dot>{hackathon.stage}</Badge>
          {hackathon.category && <Badge>{hackathon.category}</Badge>}
          {isRegistered && (
            <Badge tone="success">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Registered
            </Badge>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{hackathon.title}</h1>
        <p className="mt-2 max-w-3xl text-base text-fg-muted">{hackathon.headline}</p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10">
          {[
            { icon: CalendarDays, label: 'Registration closes', value: hackathon.deadline },
            { icon: CalendarDays, label: 'Competition window', value: hackathon.dates },
            { icon: Users, label: 'Team size', value: hackathon.teamSize },
            { icon: Trophy, label: 'Prize pool', value: hackathon.prizePool },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <dt className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </header>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        {/* Main content */}
        <div className="min-w-0 lg:col-span-2">
          <Tabs items={TABS} value={activeTab} onValueChange={setActiveTab} label="Hackathon details" idPrefix="hackathon" />

          <TabPanel value="overview" activeValue={activeTab} idPrefix="hackathon" className="space-y-8 pt-6">
            <Section title="The challenge">
              <p className="text-sm leading-relaxed text-fg-muted sm:text-base">{hackathon.overview}</p>
              {hackathon.track && (
                <p className="text-sm text-fg-subtle">Track: <span className="text-fg-muted">{hackathon.track}</span></p>
              )}
            </Section>
            <Section title="What to submit">
              <BulletList items={hackathon.submissionReqs} />
            </Section>
            <Alert tone="info" title="For team leaders">
              Only team leaders can lock the roster and submit the repository before the deadline. Every member
              must have a HackTrack account by then.
            </Alert>
          </TabPanel>

          <TabPanel value="rules" activeValue={activeTab} idPrefix="hackathon" className="space-y-8 pt-6">
            <Section title="Who can take part">
              <BulletList items={hackathon.eligibility} />
            </Section>
            <Section title="Competition rules">
              <BulletList items={hackathon.rules} icon={ArrowRight} iconClass="text-fg-subtle" />
            </Section>
          </TabPanel>

          <TabPanel value="screening" activeValue={activeTab} idPrefix="hackathon" className="space-y-8 pt-6">
            <Section
              title="Screening checks"
              description="The screening committee verifies every submission before it reaches the judges."
            >
              <ol className="divide-y divide-line rounded-xl border border-line">
                {(hackathon.screeningReqs || []).map((req, i) => (
                  <li key={req} className="flex gap-3 px-4 py-3 text-sm text-fg-muted">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-xs text-fg-subtle">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{req}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="Judging rubric" description="Shortlisted projects are scored against these weighted criteria.">
              <ul className="divide-y divide-line rounded-xl border border-line">
                {(hackathon.rubrics || []).map((rubric) => {
                  const pct = Math.min(100, parseFloat(rubric.weight) || 0);
                  return (
                    <li key={rubric.name} className="px-4 py-3.5">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-sm font-medium text-fg">{rubric.name}</p>
                        <span className="font-mono text-sm tabular-nums text-fg">{rubric.weight}</span>
                      </div>
                      {rubric.desc && <p className="mt-0.5 text-sm text-fg-muted">{rubric.desc}</p>}
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          </TabPanel>
        </div>

        {/* Registration sidebar */}
        <aside className="order-first lg:order-none lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-fg">
              {isRegistered ? "You're registered" : "Join this competition"}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {isRegistered
                ? "Head to your dashboard to create a team or submit your project."
                : "Register to create a team, or join an existing team with its invite code."}
            </p>

            {regFeedback && (
              <Alert tone={regFeedback.type === "success" ? "success" : "warning"} className="mt-4">
                {regFeedback.text}
              </Alert>
            )}

            <div className="mt-5 space-y-2">
              {isRegistered ? (
                <Button className="w-full" size="lg" onClick={() => navigate('/dashboard/student')}>
                  Go to dashboard
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button className="w-full" size="lg" onClick={handleRegisterClick}>
                  {isAuthenticated ? "Register for this hackathon" : "Sign in to register"}
                </Button>
              )}
              <Button className="w-full" size="lg" variant="secondary" onClick={openTeamCode}>
                <KeyRound aria-hidden="true" />
                Join with team code
              </Button>
            </div>

            <DescriptionList
              className="mt-5 hidden border-t border-line pt-2 lg:block"
              items={[
                { label: 'Stage', value: hackathon.stage },
                { label: 'Deadline', value: hackathon.deadline },
                { label: 'Team size', value: hackathon.teamSize },
              ]}
            />
          </Card>

          {hackathon.organizerName && (
            <p className="mt-4 flex items-center gap-2 px-1 text-sm text-fg-subtle">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Organized by <span className="text-fg-muted">{hackathon.organizerName}</span>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
