import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  ShieldCheck,
  Award,
  CalendarRange,
  Lock,
  ArrowRight,
  ShieldAlert,
  Lightbulb,
} from 'lucide-react';
import { Alert, Button, Field, Input, Select, Logo, cn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../utils/auth';

const YEAR_OPTIONS = [
  { value: "", label: "Select year of study" },
  { value: "1st Year / Freshman", label: "1st Year / Freshman" },
  { value: "2nd Year / Sophomore", label: "2nd Year / Sophomore" },
  { value: "3rd Year / Junior", label: "3rd Year / Junior" },
  { value: "4th Year / Senior", label: "4th Year / Senior" },
  { value: "Postgraduate / Master's", label: "Postgraduate / Master's" },
];

export default function Register({ navigate: propNavigate }) {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    // Student & Team Leader specific
    memberId: "",
    university: "",
    department: "",
    yearOfStudy: "",
    phone: "",
    // Judge specific
    designation: "",
    // Privileged access codes (Screening, Judge, Organizer)
    accessCode: "",
  });

  const [statusMessage, setStatusMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const roles = [
    {
      id: "student",
      title: "Student / Participant",
      desc: "Browse hackathons, join teams using Team Codes & view deliverables",
      icon: GraduationCap,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50",
    },
    {
      id: "leader",
      title: "Team Leader",
      desc: "Create teams, share invite codes, manage rosters & submit projects",
      icon: Users,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/50",
    },
    {
      id: "screening",
      title: "Screening Committee",
      desc: "Verify repos, inspect demo URLs & enforce rules",
      icon: ShieldCheck,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50",
    },
    {
      id: "judge",
      title: "Judge / Evaluator",
      desc: "Evaluate shortlisted teams with weighted rubrics",
      icon: Award,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/50",
    },
    {
      id: "mentor",
      title: "Technical Mentor",
      desc: "Guide competitor squads, review technical drafts & provide domain advisory",
      icon: Lightbulb,
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50",
    },
    {
      id: "organizer",
      title: "Hackathon Organizer",
      desc: "Create and govern hackathons, define rubrics & manage competitions",
      icon: CalendarRange,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50",
    },
    {
      id: "admin",
      title: "Platform Admin",
      desc: "Govern lifecycles, monitor stages & manage users",
      icon: Lock,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800",
    },
  ];

  // Dynamic role switching with state cleanup
  const handleRoleSelect = (roleId) => {
    setStatusMessage(null);
    setFormData((prev) => {
      const isNewStudentRole = ['student', 'leader'].includes(roleId);
      const isPrevStudentRole = ['student', 'leader'].includes(prev.role);

      return {
        ...prev,
        role: roleId,
        // Clear student-specific fields when switching away from student/leader
        memberId: isNewStudentRole ? (isPrevStudentRole ? prev.memberId : "") : "",
        yearOfStudy: isNewStudentRole ? (isPrevStudentRole ? prev.yearOfStudy : "") : "",
        // Clear designation if not judge or mentor
        designation: ['judge', 'mentor'].includes(roleId) ? prev.designation : "",
        // Clear accessCode when switching between roles
        accessCode: (roleId === prev.role) ? prev.accessCode : "",
        // Department retained if role supports it, otherwise reset
        department: ['student', 'leader', 'screening', 'organizer'].includes(roleId) ? prev.department : "",
      };
    });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    // Platform admin check
    if (formData.role === 'admin') {
      setStatusMessage({
        type: "error",
        text: "Administrator accounts cannot be self-registered publicly. Admin accounts must be created through the administrative workspace.",
      });
      return;
    }

    // Common fields validation
    if (!formData.fullName.trim()) {
      setStatusMessage({ type: "error", text: "Please enter your full name." });
      return;
    }
    if (!formData.email.trim()) {
      setStatusMessage({ type: "error", text: "Please enter your email address." });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setStatusMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    // Role-specific validations
    if (['student', 'leader'].includes(formData.role)) {
      if (!formData.university.trim()) {
        setStatusMessage({ type: "error", text: "College / University is required for student registration." });
        return;
      }
      if (!formData.memberId.trim()) {
        setStatusMessage({
          type: "error",
          text: `Student / Member ID is mandatory for ${formData.role === 'leader' ? 'Team Leader' : 'Student'} registration.`,
        });
        return;
      }
    } else if (formData.role === 'screening') {
      if (!formData.university.trim()) {
        setStatusMessage({ type: "error", text: "Institution / University is required for Screening Committee registration." });
        return;
      }
      if (!formData.department.trim()) {
        setStatusMessage({ type: "error", text: "Committee / Department Affiliation is required." });
        return;
      }
      if (!formData.accessCode.trim()) {
        setStatusMessage({ type: "error", text: "A Screening Access Code or Invitation Key is required." });
        return;
      }
    } else if (formData.role === 'judge') {
      if (!formData.university.trim()) {
        setStatusMessage({ type: "error", text: "Organization / University is required for Judge registration." });
        return;
      }
      if (!formData.designation.trim()) {
        setStatusMessage({ type: "error", text: "Professional Designation / Expertise is required for Judge registration." });
        return;
      }
      if (!formData.accessCode.trim()) {
        setStatusMessage({ type: "error", text: "A Judge Access Code or Invitation Key is required to register as a Judge." });
        return;
      }
    } else if (formData.role === 'mentor') {
      if (!formData.university.trim()) {
        setStatusMessage({ type: "error", text: "Organization / University is required for Mentor registration." });
        return;
      }
      if (!formData.designation.trim()) {
        setStatusMessage({ type: "error", text: "Technical Expertise / Domain is required for Mentor registration." });
        return;
      }
      if (!formData.accessCode.trim()) {
        setStatusMessage({ type: "error", text: "A Mentor Authorization Key or Invitation Code is required to register as a Mentor." });
        return;
      }
    } else if (formData.role === 'organizer') {
      if (!formData.university.trim()) {
        setStatusMessage({ type: "error", text: "Host Organization / University is required for Organizer registration." });
        return;
      }
      if (!formData.department.trim()) {
        setStatusMessage({ type: "error", text: "Organizing Committee / Department is required for Organizer registration." });
        return;
      }
      if (!formData.accessCode.trim()) {
        setStatusMessage({ type: "error", text: "An Organizer Authorization Key is required to register as an Organizer." });
        return;
      }
    }

    // Password validations
    if (!formData.password) {
      setStatusMessage({ type: "error", text: "Please enter a password." });
      return;
    }
    if (formData.password.length < 6) {
      setStatusMessage({ type: "error", text: "Password must be at least 6 characters long." });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setStatusMessage({ type: "error", text: "Password confirmation does not match." });
      return;
    }

    setSubmitting(true);
    const payload = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: formData.role,
      university: formData.university.trim(),
      memberId: ['student', 'leader'].includes(formData.role) ? formData.memberId.trim() : null,
      department: ['student', 'leader', 'screening', 'organizer'].includes(formData.role) && formData.department.trim()
        ? formData.department.trim()
        : undefined,
      yearOfStudy: ['student', 'leader'].includes(formData.role) && formData.yearOfStudy ? formData.yearOfStudy : undefined,
      designation: ['judge', 'mentor'].includes(formData.role) ? formData.designation.trim() : undefined,
      phone: formData.phone.trim() || undefined,
      accessCode: formData.accessCode.trim() || undefined,
    };

    const res = await register(payload);
    if (!res.success) {
      setSubmitting(false);
      setStatusMessage({ type: "error", text: res.error });
      return;
    }

    const destination = getRoleDashboardPath(res.user.role);
    setStatusMessage({
      type: "success",
      text: `Account created for ${res.user.fullName}. Opening your dashboard…`,
    });

    setTimeout(() => {
      navigate(destination);
    }, 800);
  };

  const currentRoleConfig = roles.find((r) => r.id === formData.role) || roles[0];
  const CurrentIcon = currentRoleConfig.icon;

  return (
    <div className="container-page py-10 sm:py-16">
      <div className="surface-card relative mx-auto max-w-2xl rounded-2xl border border-line-strong p-6 sm:p-10">
        <span className="hairline-gradient pointer-events-none absolute inset-x-12 -top-px h-px" aria-hidden="true" />
        <Logo className="mb-8" />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create your account</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Select your platform role to configure your dedicated workspace and competition credentials.
        </p>

        {statusMessage && (
          <Alert tone={statusMessage.type === "error" ? "danger" : "success"} className="mt-6">
            {statusMessage.text}
          </Alert>
        )}

        <form onSubmit={handleRegister} className="mt-8 space-y-8" noValidate>
          {/* Role Selection */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-fg">
              Select your role<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </legend>
            <div role="radiogroup" aria-label="Account role" className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => {
                const selected = formData.role === r.id;
                const RoleIcon = r.icon;
                return (
                  <button
                    type="button"
                    key={r.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleRoleSelect(r.id)}
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
                      <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                        <RoleIcon className={cn("h-4 w-4 shrink-0", r.color)} aria-hidden="true" />
                        <span className="truncate">{r.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-fg-subtle">{r.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Role Header Banner */}
          <div className={cn("flex items-start gap-3 rounded-xl border p-4 transition-colors", currentRoleConfig.bg)}>
            <div className="mt-0.5 shrink-0">
              <CurrentIcon className={cn("h-5 w-5", currentRoleConfig.color)} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-fg">
                {currentRoleConfig.title} Registration
              </h2>
              <p className="mt-0.5 text-xs text-fg-muted leading-relaxed">
                {formData.role === "student" && "Complete your student profile to browse hackathons, join teams via Team Codes, and track deliverables."}
                {formData.role === "leader" && "Complete your team leader profile to create competitive squads, generate shareable invite codes, and submit project repositories."}
                {formData.role === "screening" && "Authorized registration for review committee members. Evaluate project repos, verify demo URLs, and shortlist qualifying squads."}
                {formData.role === "judge" && "Authorized registration for expert evaluators. Score shortlisted teams using weighted rubrics and provide expert feedback."}
                {formData.role === "mentor" && "Authorized registration for technical mentors and domain advisors. Guide competitor squads, review technical drafts, and provide architectural mentorship."}
                {formData.role === "organizer" && "Authorized registration for competition directors. Create and govern hackathons, define evaluation stages, and manage review panels."}
                {formData.role === "admin" && "Administrative governance accounts are provisioned exclusively through platform configuration or existing administrators."}
              </p>
            </div>
          </div>

          {/* ADMIN: Dedicated Security Advisory Notice */}
          {formData.role === "admin" ? (
            <div className="space-y-6 rounded-xl border border-line bg-surface/60 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised">
                <ShieldAlert className="h-6 w-6 text-fg-muted" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-fg">Restricted Administrative Access</h3>
                <p className="mx-auto max-w-md text-xs sm:text-sm text-fg-muted leading-relaxed">
                  Platform Administrator accounts cannot be created through public self-registration. In compliance with HackTrack security protocol (FR-42), administrative privileges must be provisioned directly by existing administrators within the Admin Workspace.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-xs hover:bg-primary/90 transition-colors"
                >
                  Sign in with Administrator Credentials
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* 1. STUDENT & TEAM LEADER REGISTRATION FORM */}
              {['student', 'leader'].includes(formData.role) && (
                <>
                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Academic & Institutional Details</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="College / University" required>
                        <Input
                          name="university"
                          autoComplete="organization"
                          value={formData.university}
                          onChange={handleChange}
                          placeholder="e.g. PCCOE Pune"
                        />
                      </Field>

                      <Field
                        label="Student / Member ID"
                        required
                        hint="PRN, roll number, or university registration ID"
                      >
                        <Input
                          name="memberId"
                          value={formData.memberId}
                          onChange={handleChange}
                          placeholder={formData.role === "leader" ? "e.g. LEAD-88219" : "e.g. STU-88219"}
                        />
                      </Field>

                      <Field label="Department / Branch">
                        <Input
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          placeholder="e.g. Computer Engineering"
                        />
                      </Field>

                      <Field label="Year of Study">
                        <Select
                          name="yearOfStudy"
                          value={formData.yearOfStudy}
                          onChange={handleChange}
                        >
                          {YEAR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Personal & Contact Information</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" required>
                        <Input
                          name="fullName"
                          autoComplete="name"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder={formData.role === "leader" ? "Alex Chen" : "Maya Lin"}
                        />
                      </Field>

                      <Field label="Institutional / Student email" required>
                        <Input
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder={formData.role === "leader" ? "alex@pccoe.edu.in" : "maya@pccoe.edu.in"}
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field label="Contact phone" hint="Optional">
                          <Input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="e.g. +91 98765 43210"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>
                </>
              )}

              {/* 2. SCREENING COMMITTEE REGISTRATION FORM */}
              {formData.role === "screening" && (
                <>
                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Committee & Affiliation Details</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Institution / University" required>
                        <Input
                          name="university"
                          autoComplete="organization"
                          value={formData.university}
                          onChange={handleChange}
                          placeholder="e.g. PCCOE Pune / Technical Review Board"
                        />
                      </Field>

                      <Field label="Committee / Department Affiliation" required>
                        <Input
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          placeholder="e.g. Technical Screening Panel / Dept. of CSE"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field
                          label="Screening Access Code"
                          required
                          hint="Enter the access code provided by the hackathon organizing committee (e.g. SCREEN-CODE-3M2P)"
                        >
                          <Input
                            name="accessCode"
                            value={formData.accessCode}
                            onChange={handleChange}
                            placeholder="e.g. SCREEN-CODE-3M2P"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Personal & Contact Information</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" required>
                        <Input
                          name="fullName"
                          autoComplete="name"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="e.g. Dr. Marcus Vance"
                        />
                      </Field>

                      <Field label="Official / Institutional email" required>
                        <Input
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="e.g. marcus.vance@pccoe.edu.in"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field label="Contact phone" hint="Optional">
                          <Input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="e.g. +91 98765 43210"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>
                </>
              )}

              {/* 3. JUDGE / EVALUATOR REGISTRATION FORM */}
              {formData.role === "judge" && (
                <>
                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Professional Background & Affiliation</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Organization / University" required>
                        <Input
                          name="university"
                          autoComplete="organization"
                          value={formData.university}
                          onChange={handleChange}
                          placeholder="e.g. ACM Expert Panel / Microsoft / Stanford"
                        />
                      </Field>

                      <Field label="Professional Designation / Expertise" required>
                        <Input
                          name="designation"
                          value={formData.designation}
                          onChange={handleChange}
                          placeholder="e.g. Senior AI Architect / Associate Professor"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field
                          label="Judge Access Code"
                          required
                          hint="Enter the unique judge access code issued by the competition organizer (e.g. JUDGE-CODE-7X9K)"
                        >
                          <Input
                            name="accessCode"
                            value={formData.accessCode}
                            onChange={handleChange}
                            placeholder="e.g. JUDGE-CODE-7X9K"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Personal & Contact Information</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" required>
                        <Input
                          name="fullName"
                          autoComplete="name"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="e.g. Prof. Elena Rostova"
                        />
                      </Field>

                      <Field label="Professional / Work email" required>
                        <Input
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="e.g. elena@acm.org"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field label="Contact phone" hint="Optional">
                          <Input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="e.g. +91 98765 43210"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>
                </>
              )}

              {/* 4. TECHNICAL MENTOR REGISTRATION FORM */}
              {formData.role === "mentor" && (
                <>
                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Professional Advisory & Domain Expertise</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Organization / University" required>
                        <Input
                          name="university"
                          autoComplete="organization"
                          value={formData.university}
                          onChange={handleChange}
                          placeholder="e.g. Google Cloud / PCCOE Pune / Tech Guild"
                        />
                      </Field>

                      <Field label="Technical Expertise / Domain" required hint="e.g. AI / Cloud / Full Stack / IoT">
                        <Input
                          name="designation"
                          value={formData.designation}
                          onChange={handleChange}
                          placeholder="e.g. AI Architect / Distributed Systems Specialist"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field
                          label="Mentor Authorization Key"
                          required
                          hint="Enter your mentor authorization code or invite key (e.g. MENTOR-INVITE-2026)"
                        >
                          <Input
                            name="accessCode"
                            value={formData.accessCode}
                            onChange={handleChange}
                            placeholder="e.g. MENTOR-INVITE-2026"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Personal & Contact Information</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" required>
                        <Input
                          name="fullName"
                          autoComplete="name"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="e.g. David Sterling"
                        />
                      </Field>

                      <Field label="Official / Professional email" required>
                        <Input
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="e.g. david.sterling@guild.org"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field label="Contact phone" hint="Optional">
                          <Input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="e.g. +91 98765 43210"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>
                </>
              )}

              {/* 5. HACKATHON ORGANIZER REGISTRATION FORM */}
              {formData.role === "organizer" && (
                <>
                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Host Organization & Committee</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Host Organization / University" required>
                        <Input
                          name="university"
                          autoComplete="organization"
                          value={formData.university}
                          onChange={handleChange}
                          placeholder="e.g. PCCOE Pune / DevPulse Operations"
                        />
                      </Field>

                      <Field label="Organizing Committee / Department" required>
                        <Input
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          placeholder="e.g. Operations Committee / Innovation Cell"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field
                          label="Authorization Key"
                          required
                          hint="Enter your institutional organizer authorization code (e.g. ORG-INVITE-2026)"
                        >
                          <Input
                            name="accessCode"
                            value={formData.accessCode}
                            onChange={handleChange}
                            placeholder="e.g. ORG-INVITE-2026"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-4">
                    <legend className="mb-1 text-sm font-medium text-fg">Personal & Contact Information</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" required>
                        <Input
                          name="fullName"
                          autoComplete="name"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="e.g. Kavita Rao"
                        />
                      </Field>

                      <Field label="Official work email" required>
                        <Input
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="e.g. kavita.rao@devpulse.org"
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field label="Contact phone" hint="Optional">
                          <Input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="e.g. +91 98765 43210"
                          />
                        </Field>
                      </div>
                    </div>
                  </fieldset>
                </>
              )}

              {/* Security & Password Fieldset */}
              <fieldset className="space-y-4">
                <legend className="mb-1 text-sm font-medium text-fg">Account Security</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" required hint="At least 6 characters">
                    <Input
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                    />
                  </Field>
                  <Field
                    label="Confirm password"
                    required
                    error={
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? "Passwords don't match."
                        : undefined
                    }
                  >
                    <Input
                      type="password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                    />
                  </Field>
                </div>
              </fieldset>

              {/* Form Footer */}
              <div className="flex flex-col-reverse gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-fg-muted">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="inline-flex min-h-10 items-center rounded-sm font-medium text-accent-text hover:underline sm:min-h-0"
                  >
                    Sign in
                  </Link>
                </p>
                <Button type="submit" size="lg" loading={submitting}>
                  {submitting
                    ? "Creating account…"
                    : formData.role === "student"
                    ? "Register as Student"
                    : formData.role === "leader"
                    ? "Register as Team Leader"
                    : formData.role === "screening"
                    ? "Register for Screening Committee"
                    : formData.role === "judge"
                    ? "Register as Judge"
                    : formData.role === "mentor"
                    ? "Register as Technical Mentor"
                    : formData.role === "organizer"
                    ? "Register as Organizer"
                    : "Create account"}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
