import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowRight, Check, ClipboardCheck, Compass, Crown, Gavel, KeyRound,
  Rocket, Settings2, ShieldCheck, Trophy, UserPlus, Users,
} from 'lucide-react';
import HackathonCard from '../components/HackathonCard';
import EventCover from '../components/art/EventCover';
import FeatureArt from '../components/art/FeatureArt';
import HeroArtwork from '../components/art/HeroArtwork';
import ParticleField from '../components/art/ParticleField';
import { Button, Input, cn } from '../components/ui';
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
  { art: 'covers', title: 'Discover & register', body: 'Review tracks, rules and deadlines, then register for the event you want to compete in.' },
  { art: 'teams', title: 'Form your team', body: 'Leaders create a team and share its code. Members join instantly — no manual invites.' },
  { art: 'screening', title: 'Pass screening', body: 'A committee checks repository authenticity and working demos before anything reaches judges.' },
  { art: 'judging', title: 'Get judged', body: 'Judges score only shortlisted finalists against weighted rubrics and leave feedback.' },
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
      <section className="relative isolate overflow-hidden">
        {/* Hero atmosphere: particle field (fades out at the bottom so the hero
            blends into the next section) + spotlight behind the headline. */}
        <div className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(90deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.35)_40%,black_62%)]" aria-hidden="true">
          <ParticleField className="h-full w-full [mask-image:linear-gradient(180deg,black_55%,transparent)]" />
        </div>
        <div
          className="pointer-events-none absolute -left-40 top-0 -z-10 h-[34rem] w-[52rem] [background:radial-gradient(closest-side,rgb(var(--accent)/0.22),transparent)]"
          aria-hidden="true"
        />
        {/* Hero light: two soft colour fields behind the diagram (gradients, no blur filter). */}
        <div
          className="pointer-events-none absolute -right-40 top-0 h-[36rem] w-[48rem] [background:radial-gradient(closest-side,rgb(var(--accent)/0.28),transparent)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-40 h-[24rem] w-[30rem] [background:radial-gradient(closest-side,rgb(var(--accent-2)/0.14),transparent)]"
          aria-hidden="true"
        />
        <div className="container-page relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-medium text-fg-muted backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-accent-text to-accent-2" aria-hidden="true" />
              Hackathon management, end to end
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-display">
              Run the whole hackathon <span className="text-gradient">in one place.</span>
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

          {/* Illustration + lifecycle diagram */}
          <div className="relative">
            <HeroArtwork className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[150%] max-w-none -translate-x-1/2 -translate-y-[52%] lg:w-[158%] lg:-translate-x-[45%]" />
          <div className="surface-card relative rounded-2xl border border-line-strong p-2 !shadow-lg">
            <span className="hairline-gradient pointer-events-none absolute inset-x-10 -top-px h-px" aria-hidden="true" />
            <div className="flex items-center justify-between px-3 py-2.5">
              <p className="text-sm font-medium text-fg">Competition lifecycle</p>
              <p className="text-xs text-fg-subtle">Enforced by HackTrack</p>
            </div>
            <ol className="relative rounded-xl border border-line bg-sunken/80">
              {/* Connector running through the step icons */}
              <span className="pointer-events-none absolute bottom-6 left-8 top-6 w-px bg-gradient-to-b from-accent/70 via-accent-2/40 to-accent/10" aria-hidden="true" />
              {LIFECYCLE.map(({ icon: Icon, stage, actor, detail }, index) => (
                <li key={stage} className="relative flex items-center gap-3 border-b border-line/70 px-4 py-3 transition-colors last:border-0 hover:bg-raised/40">
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hi text-accent-text ring-1 ring-inset ring-accent/30">
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
        </div>
      </section>

      {/* Open hackathons */}
      <section id="hackathons" className="py-16 sm:py-20">
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

      {/* How it works — image-led, alternating rows */}
      <section id="how-it-works" className="section-band scroll-mt-14 py-20 sm:py-28">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">A structured path from kickoff to certified scores</h2>
          </div>

          <ol className="mt-12 space-y-12 sm:space-y-16">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
                <div className={cn('surface-card relative overflow-hidden rounded-2xl border border-line', index % 2 === 1 && 'md:order-last')}>
                  {step.art === 'covers' ? (
                    <div className="relative aspect-[3/2]">
                      {/* Generated covers of the real open events, fanned out */}
                      {featured.slice(0, 3).map((h, i) => (
                        <div
                          key={h.id}
                          className={cn(
                            'absolute w-[74%] overflow-hidden rounded-xl border border-line-strong shadow-lg',
                            ['left-[6%] top-[7%] -rotate-3', 'left-[20%] top-[34%] rotate-2', 'left-[10%] top-[60%] -rotate-1'][i]
                          )}
                        >
                          <EventCover hackathon={h} className="aspect-[5/2]" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <FeatureArt variant={step.art} className="aspect-[3/2] w-full" />
                  )}
                </div>
                <div>
                  <p className="text-gradient font-mono text-4xl font-semibold leading-none tabular-nums">0{index + 1}</p>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-muted sm:text-base">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="relative isolate scroll-mt-14 py-16 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(rgb(var(--line-strong)/0.8)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_45%,black,transparent_75%)]"
          aria-hidden="true"
        />
        <div className="container-page">
          <h2 className="text-2xl font-semibold tracking-tight">Built for every role</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Each of the {SYSTEM_ROLES.length} roles gets a workspace with only the tools it needs.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role.id] || Compass;
              return (
                <article key={role.id} className="surface-card rounded-xl border border-line p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent-text ring-1 ring-inset ring-accent/25">
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

      {/* Closing call to action */}
      <section className="pb-20">
        <div className="container-page">
          <div className="surface-hero flex flex-col items-start gap-6 rounded-2xl border border-line-strong p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="relative max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready for your next hackathon?</h2>
              <p className="mt-2 text-sm text-fg-muted sm:text-base">
                Browse open competitions, or create an account to register, build your team and submit.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <Button as={Link} to="/register" size="lg">
                Create an account
                <ArrowRight aria-hidden="true" />
              </Button>
              <Button as={Link} to="/hackathons" size="lg" variant="secondary">Browse hackathons</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
