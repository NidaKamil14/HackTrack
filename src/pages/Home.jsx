import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowRight, Check, ClipboardCheck, Compass, Crown, Gavel, KeyRound,
  Rocket, Settings2, ShieldCheck, Trophy, UserPlus, Users,
} from 'lucide-react';
import HackathonCard from '../components/HackathonCard';
import { Button, Input } from '../components/ui';
import { getStoredHackathons } from '../utils/hackathonService';
import { SYSTEM_ROLES } from '../data/roles';

// The competition lifecycle HackTrack enforces, and who acts at each stage.
const LIFECYCLE = [
  { icon: UserPlus, stage: 'Registration', actor: 'Students', detail: 'Sign up for an event and its track' },
  { icon: Users, stage: 'Team formation', actor: 'Team leaders', detail: 'Create a team and share its invite code' },
  { icon: Rocket, stage: 'Submission', actor: 'Team leaders', detail: 'Repository, demo and docs, locked at the deadline' },
  { icon: ShieldCheck, stage: 'Screening', actor: 'Committee', detail: 'Eligibility and working-demo checks' },
  { icon: Gavel, stage: 'Judging', actor: 'Judges', detail: 'Weighted rubric scores and feedback' },
  { icon: Trophy, stage: 'Results', actor: 'Organizers', detail: 'Leaderboard published, certificates issued' },
];

const STEPS = [
  { title: 'Discover & register', body: 'Review tracks, rules and deadlines, then register for the event you want to compete in.' },
  { title: 'Form your team', body: 'Leaders create a team and share its code. Members join instantly — no manual invites.' },
  { title: 'Pass screening', body: 'A committee checks repository authenticity and working demos before anything reaches judges.' },
  { title: 'Get judged', body: 'Judges score only shortlisted finalists against weighted rubrics and leave feedback.' },
];

const ROLE_ICONS = {
  students: Compass,
  leaders: Crown,
  screening: ClipboardCheck,
  judges: Gavel,
  organizers: Settings2,
  admins: ShieldCheck,
};

export default function Home({
  onOpenTeamModal: propOpenTeamModal,
  setTeamCodeInput: propSetTeamCodeInput
}) {
  const outletContext = useOutletContext() || {};
  const onOpenTeamModal = propOpenTeamModal || outletContext.onOpenTeamModal || (() => {});
  const setTeamCodeInput = propSetTeamCodeInput || outletContext.setTeamCodeInput || (() => {});

  const [heroInput, setHeroInput] = useState("");
  const [featured] = useState(() => getStoredHackathons().slice(0, 3));

  const handleHeroSubmit = (e) => {
    e.preventDefault();
    if (heroInput.trim()) {
      setTeamCodeInput(heroInput.trim().toUpperCase());
      onOpenTeamModal(heroInput.trim().toUpperCase());
    } else {
      setTeamCodeInput("HT-DEV-42");
      onOpenTeamModal("HT-DEV-42");
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(var(--line))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--line))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top_left,black_20%,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="container-page relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow">Hackathon management, end to end</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-display">
              Run the whole hackathon in one place.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
              Registrations, team invite codes, submission locks, committee screening and rubric judging —
              one workflow for students, judges and organizers.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} to="/hackathons" size="lg">
                Browse hackathons
                <ArrowRight aria-hidden="true" />
              </Button>
              <Button as={Link} to="/register" size="lg" variant="secondary">
                Create an account
              </Button>
            </div>

            <form onSubmit={handleHeroSubmit} className="mt-10 max-w-md">
              <label htmlFor="hero-team-code" className="text-sm font-medium text-fg">
                Already have a team code?
              </label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                  <Input
                    id="hero-team-code"
                    placeholder="HT-DEV-42"
                    value={heroInput}
                    onChange={(e) => setHeroInput(e.target.value.toUpperCase())}
                    autoComplete="off"
                    spellCheck={false}
                    className="pl-9 font-mono uppercase tracking-wider"
                    aria-describedby="hero-team-code-hint"
                  />
                </div>
                <Button type="submit" variant="secondary">Join team</Button>
              </div>
              <p id="hero-team-code-hint" className="mt-2 text-xs text-fg-subtle">
                Demo codes: <span className="font-mono text-fg-muted">HT-DEV-42</span> or <span className="font-mono text-fg-muted">HT-AI-99</span>
              </p>
            </form>
          </div>

          {/* Lifecycle diagram */}
          <div className="rounded-2xl border border-line bg-surface p-2 shadow-lg">
            <div className="flex items-center justify-between px-3 py-2.5">
              <p className="text-sm font-medium text-fg">Competition lifecycle</p>
              <p className="text-xs text-fg-subtle">Enforced by HackTrack</p>
            </div>
            <ol className="rounded-xl border border-line bg-sunken">
              {LIFECYCLE.map(({ icon: Icon, stage, actor, detail }, index) => (
                <li key={stage} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent-text">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 text-sm font-medium text-fg">
                      <span className="font-mono text-xs text-fg-subtle">{String(index + 1).padStart(2, '0')}</span>
                      {stage}
                    </p>
                    <p className="text-xs text-fg-subtle sm:truncate">{detail}</p>
                  </div>
                  <span className="hidden shrink-0 rounded-md bg-raised px-2 py-0.5 text-xs text-fg-muted sm:inline">{actor}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Open hackathons */}
      <section id="hackathons" className="border-b border-line py-16 sm:py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Open hackathons</h2>
              <p className="mt-1 text-sm text-fg-muted">Pick a competition to read its rules or register your team.</p>
            </div>
            <Button as={Link} to="/hackathons" variant="ghost" size="sm">
              View all
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {featured.map((h) => (
              <HackathonCard key={h.id} hackathon={h} variant="featured" />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-14 border-b border-line py-16 sm:py-20">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-1 text-sm text-fg-muted">A structured path from kickoff to certified scores.</p>

          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative border-t border-line pt-5">
                <span className="absolute -top-px left-0 h-px w-12 bg-accent" aria-hidden="true" />
                <p className="font-mono text-xs text-accent-text">Step {index + 1}</p>
                <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-14 py-16 sm:py-20">
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">Built for every role</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Each of the {SYSTEM_ROLES.length} roles gets a workspace with only the tools it needs.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role.id] || Compass;
              return (
                <article key={role.id} className="bg-surface p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent-text">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-semibold">{role.title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-fg-muted">{role.summary}</p>
                  <ul className="mt-4 space-y-2">
                    {role.points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm text-fg-muted">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
