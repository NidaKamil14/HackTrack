import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Compass, Crown, Gavel, Lightbulb, Settings2, ShieldCheck } from 'lucide-react';
import { Alert, Button, Field, Input, Logo, cn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { DEMO_USERS, getRoleDashboardPath } from '../utils/auth';
import { registerForHackathon } from '../utils/registrationService';

const ROLE_PREVIEWS = [
  {
    role: "organizer",
    title: "Organizer",
    tagline: "Create & Run Hackathons",
    email: "organizer@hacktrack.io",
    highlight: true,
  },
  {
    role: "leader",
    title: "Team Leader",
    tagline: "Form Squad & Submit",
    email: "alex@university.edu",
  },
  {
    role: "student",
    title: "Participant",
    tagline: "Join Squad & Compete",
    email: "priya@university.edu",
  },
  {
    role: "judge",
    title: "Judge",
    tagline: "Score Rubrics",
    email: "judge@hacktrack.io",
  },
  {
    role: "admin",
    title: "Administrator",
    tagline: "Platform HQ",
    email: "admin@hacktrack.io",
  },
  {
    role: "screening",
    title: "Screening",
    tagline: "Verify Repos",
    email: "screening@hacktrack.io",
  },
  {
    role: "mentor",
    title: "Mentor",
    tagline: "Guide Teams",
    email: "mentor@hacktrack.io",
  },
];

const ROLE_ICONS = {
  organizer: Settings2,
  leader: Crown,
  student: Compass,
  judge: Gavel,
  admin: ShieldCheck,
  screening: ClipboardCheck,
  mentor: Lightbulb,
};

export default function Login({ navigate: propNavigate }) {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const location = useLocation();
  const { login, switchDemoRole } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const initialRole = searchParams.get('role') || "organizer";
  const initialDemo = DEMO_USERS.find((u) => u.role === initialRole) || DEMO_USERS.find((u) => u.role === "organizer");

  const [selectedRolePreview, setSelectedRolePreview] = useState(initialRole);
  const [email, setEmail] = useState(initialDemo ? initialDemo.email : "organizer@hacktrack.io");
  const [password, setPassword] = useState(initialDemo ? initialDemo.password : "password123");
  const [statusMessage, setStatusMessage] = useState(null);
  // True only while the real login/register call is in flight; stays true on
  // success because the page is about to redirect.
  const [submitting, setSubmitting] = useState(false);

  const handlePersonaSelect = (roleKey) => {
    setSelectedRolePreview(roleKey);
    const demo = DEMO_USERS.find((u) => u.role === roleKey);
    if (demo) {
      setEmail(demo.email);
      setPassword(demo.password);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setStatusMessage({ type: "error", text: "Please enter both your email and password." });
      return;
    }

    setSubmitting(true);
    const res = await login(email, password);
    if (!res.success) {
      setSubmitting(false);
      setStatusMessage({
        type: "error",
        text: `${res.error} Check your email and password, or continue with a demo account.`
      });
      return;
    }

    // Check if user came from a hackathon registration attempt
    if (location.state?.registerHackathonId) {
      registerForHackathon(res.user.email, location.state.registerHackathonId);
      const targetHackathonId = location.state.registerHackathonId;
      setStatusMessage({
        type: "success",
        text: `Signed in as ${res.user.fullName}. Registering you and returning to the hackathon…`
      });
      setTimeout(() => {
        navigate(`/hackathons/${targetHackathonId}`, { replace: true });
      }, 400);
      return;
    }

    // Role-based destination
    const destination = location.state?.from?.pathname || getRoleDashboardPath(res.user.role);
    setStatusMessage({
      type: "success",
      text: `Signed in as ${res.user.fullName}. Opening your dashboard…`
    });

    setTimeout(() => {
      navigate(destination, { replace: true });
    }, 400);
  };

  const handleQuickDemoLaunch = (roleKey) => {
    const user = switchDemoRole(roleKey);
    const destination = getRoleDashboardPath(user.role);
    navigate(destination, { replace: true });
  };

  const selectedPreview = ROLE_PREVIEWS.find((r) => r.role === selectedRolePreview) || ROLE_PREVIEWS[0];
  const alertTone = { error: "danger", success: "success", info: "info" };

  return (
    <div className="container-page py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        {/* Credentials */}
        <section className="lg:pt-6">
          <Logo className="mb-8" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sign in</h1>
          <p className="mt-1.5 text-sm text-fg-muted">Welcome back. Sign in to open your HackTrack workspace.</p>

          {statusMessage && (
            <Alert tone={alertTone[statusMessage.type] || "info"} className="mt-6">
              {statusMessage.text}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
              />
            </Field>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-fg">Password</label>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs"
                  onClick={() => setStatusMessage({ type: "info", text: "Demo passwords for all accounts are: password123" })}
                >
                  Forgot password?
                </Button>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-fg-muted">
            New to HackTrack?{" "}
            <Link to="/register" className="inline-flex min-h-10 items-center rounded-sm font-medium text-accent-text hover:underline sm:min-h-0">
              Create an account
            </Link>
          </p>
        </section>

        {/* Demo accounts */}
        <section aria-labelledby="demo-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="demo-heading" className="text-base font-semibold">Explore with a demo account</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Pick a role to fill in its credentials, or open its dashboard directly.
          </p>

          <div role="radiogroup" aria-label="Demo role" className="mt-5 grid gap-2 sm:grid-cols-2">
            {ROLE_PREVIEWS.map((r) => {
              const isSelected = selectedRolePreview === r.role;
              const Icon = ROLE_ICONS[r.role] || Compass;
              return (
                <button
                  key={r.role}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handlePersonaSelect(r.role)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    isSelected
                      ? "border-accent/50 bg-accent/10"
                      : "border-line hover:border-line-strong hover:bg-raised"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      isSelected ? "bg-accent text-accent-fg" : "bg-raised text-fg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{r.title}</span>
                    <span className="block truncate text-xs text-fg-subtle">{r.tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-sm text-fg-muted">
              <span className="block text-xs text-fg-subtle">Selected account</span>
              <span className="block truncate font-mono">{email}</span>
            </p>
            <Button variant="secondary" onClick={() => handleQuickDemoLaunch(selectedRolePreview)}>
              Open {selectedPreview.title} dashboard
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
