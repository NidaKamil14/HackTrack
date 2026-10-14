import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Field, Input, Logo, cn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../utils/auth';

export default function Register({ navigate: propNavigate }) {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: "",
    university: "",
    email: "",
    memberId: "",
    role: "student",
    password: "",
    confirmPassword: ""
  });
  const [statusMessage, setStatusMessage] = useState(null);
  // True only while the real login/register call is in flight; stays true on
  // success because the page is about to redirect.
  const [submitting, setSubmitting] = useState(false);

  const roles = [
    {
      id: "student",
      title: "Student / Team Leader",
      desc: "Join competitions, share invite codes & build repos",
      target: "/dashboard/student"
    },
    {
      id: "organizer",
      title: "Hackathon Organizer",
      desc: "Create and govern hackathons, define rubrics & manage competitions",
      target: "/dashboard/organizer"
    },
    {
      id: "screening",
      title: "Screening Committee",
      desc: "Verify repos, inspect demo URLs & enforce rules",
      target: "/dashboard/screening"
    },
    {
      id: "judge",
      title: "Judge / Evaluator",
      desc: "Evaluate shortlisted teams with weighted rubrics",
      target: "/dashboard/judge"
    },
    {
      id: "admin",
      title: "Platform Admin",
      desc: "Govern lifecycles, monitor stages & manage users",
      target: "/dashboard/admin"
    }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.university || !formData.password) {
      setStatusMessage({ type: "error", text: "Please fill out all required fields to proceed." });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setStatusMessage({ type: "error", text: "Password confirmation does not match." });
      return;
    }

    setSubmitting(true);
    const res = await register(formData);
    if (!res.success) {
      setSubmitting(false);
      setStatusMessage({ type: "error", text: res.error });
      return;
    }

    const destination = getRoleDashboardPath(res.user.role);
    setStatusMessage({
      type: "success",
      text: `Account created for ${res.user.fullName}. Opening your dashboard…`
    });

    setTimeout(() => {
      navigate(destination);
    }, 800);
  };

  return (
    <div className="container-page py-10 sm:py-16">
      <div className="surface-card relative mx-auto max-w-2xl rounded-2xl border border-line-strong p-6 sm:p-10">
        <span className="hairline-gradient pointer-events-none absolute inset-x-12 -top-px h-px" aria-hidden="true" />
        <Logo className="mb-8" />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create your account</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Build teams and submit projects, or take part in screening and judging.
        </p>

        {statusMessage && (
          <Alert tone={statusMessage.type === "error" ? "danger" : "success"} className="mt-6">
            {statusMessage.text}
          </Alert>
        )}

        <form onSubmit={handleRegister} className="mt-8 space-y-8" noValidate>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-fg">
              How will you use HackTrack?<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </legend>
            <div role="radiogroup" aria-label="Account role" className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => {
                const selected = formData.role === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormData({ ...formData, role: r.id })}
                    className={cn(
                      "flex gap-3 rounded-lg border p-3.5 text-left transition-colors",
                      selected ? "border-accent/50 bg-accent/10" : "border-line hover:border-line-strong hover:bg-raised"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-accent" : "border-line-strong"
                      )}
                      aria-hidden="true"
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg">{r.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-fg-subtle">{r.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-medium text-fg">Your details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input name="fullName" autoComplete="name" value={formData.fullName} onChange={handleChange} placeholder="Maya Lin" />
              </Field>
              <Field label="Student or member ID" hint="Optional">
                <Input name="memberId" value={formData.memberId} onChange={handleChange} placeholder="STU-88219" />
              </Field>
              <Field label="University or organization" required>
                <Input name="university" autoComplete="organization" value={formData.university} onChange={handleChange} placeholder="Stanford University" />
              </Field>
              <Field label="Institutional email" required>
                <Input type="email" name="email" autoComplete="email" value={formData.email} onChange={handleChange} placeholder="maya@stanford.edu" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-medium text-fg">Password</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" required>
                <Input type="password" name="password" autoComplete="new-password" value={formData.password} onChange={handleChange} />
              </Field>
              <Field
                label="Confirm password"
                required
                error={formData.confirmPassword && formData.password !== formData.confirmPassword ? "Passwords don't match." : undefined}
              >
                <Input type="password" name="confirmPassword" autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} />
              </Field>
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg-muted">
              Already have an account?{" "}
              <Link to="/login" className="inline-flex min-h-10 items-center rounded-sm font-medium text-accent-text hover:underline sm:min-h-0">Sign in</Link>
            </p>
            <Button type="submit" size="lg" loading={submitting}>{submitting ? "Creating account…" : "Create account"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
