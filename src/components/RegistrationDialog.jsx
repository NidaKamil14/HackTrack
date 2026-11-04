import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Alert, Button, DescriptionList, Dialog, Field, Input, Select, Textarea } from './ui';
import { submitRegistration } from '../utils/registrationService';
import { getRegistrationWindow } from '../utils/registrationWindow';

const YEARS = ['', '1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate', 'Graduated / Working'];

/*
 * Registration form (like Unstop): the participant confirms their details and
 * accepts the event rules before anything is registered. The server validates
 * the same rules (open window, details, consent).
 */
export default function RegistrationDialog({ open, onClose, hackathon, user, onRegistered }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={hackathon ? `Register for ${hackathon.title}` : 'Register'}
      description="Confirm your details. Organizers use them to contact you about this hackathon."
    >
      {open && <RegistrationForm hackathon={hackathon} user={user} onClose={onClose} onRegistered={onRegistered} />}
    </Dialog>
  );
}

function RegistrationForm({ hackathon, user, onClose, onRegistered }) {
  const [step, setStep] = useState('details'); // details → review → done
  const [form, setForm] = useState({
    phone: '',
    institution: user?.university && user.university !== 'University / Organization' ? user.university : '',
    course: '',
    yearOfStudy: '',
    experience: '',
  });
  const [agree, setAgree] = useState({ accurate: false, rules: false });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const window_ = getRegistrationWindow(hackathon);

  if (!window_.open) {
    return (
      <div className="space-y-4">
        <Alert tone="info" title={window_.label}>{window_.reason}</Alert>
        <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    );
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!/^[+0-9 ()-]{7,20}$/.test(form.phone.trim())) next.phone = 'Enter a valid phone number (digits, spaces, + or -).';
    if (!form.institution.trim()) next.institution = 'Your college or organization is required.';
    if (!form.course.trim()) next.course = 'Your course or branch is required.';
    if (!form.yearOfStudy) next.yearOfStudy = 'Select your year of study.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!agree.accurate || !agree.rules) return;
    setSubmitting(true);
    setServerError(null);
    const res = await submitRegistration(user, hackathon, {
      phone: form.phone.trim(),
      institution: form.institution.trim(),
      course: form.course.trim(),
      yearOfStudy: form.yearOfStudy,
      experience: form.experience.trim() || undefined,
      acceptTerms: true,
    });
    setSubmitting(false);
    if (res.success || res.alreadyRegistered) {
      setStep('done');
      onRegistered?.(res);
    } else {
      setServerError(res.error || 'Registration failed. Please try again.');
    }
  };

  if (step === 'done') {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold text-fg">You’re registered!</p>
          <p className="mt-1 text-sm text-fg-muted">
            Next: {user?.role === 'leader' ? 'create your team and share its invite code' : 'join a team with its invite code'} from your dashboard.
          </p>
        </div>
        <Button onClick={onClose}>Done</Button>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-5">
        <DescriptionList
          items={[
            { label: 'Name', value: user?.fullName },
            { label: 'Email', value: user?.email },
            { label: 'Phone', value: form.phone },
            { label: 'College / organization', value: form.institution },
            { label: 'Course / branch', value: form.course },
            { label: 'Year', value: form.yearOfStudy },
            { label: 'Registering as', value: user?.role === 'leader' ? 'Team leader' : 'Participant' },
          ]}
        />
        <fieldset className="space-y-2">
          <legend className="sr-only">Confirmations</legend>
          <label className="flex items-start gap-2 text-sm text-fg">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={agree.accurate} onChange={(e) => setAgree((a) => ({ ...a, accurate: e.target.checked }))} />
            <span>I confirm these details are accurate.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-fg">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={agree.rules} onChange={(e) => setAgree((a) => ({ ...a, rules: e.target.checked }))} />
            <span>I agree to the hackathon’s rules, eligibility criteria and code of conduct.</span>
          </label>
        </fieldset>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setStep('details')} disabled={submitting}>
            <ArrowLeft aria-hidden="true" />
            Edit details
          </Button>
          <Button onClick={submit} loading={submitting} disabled={!agree.accurate || !agree.rules || submitting}>
            {submitting ? 'Registering…' : 'Confirm registration'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (validate()) setStep('review');
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name"><Input value={user?.fullName || ''} readOnly /></Field>
        <Field label="Email"><Input value={user?.email || ''} readOnly /></Field>
        <Field label="Phone number" required error={errors.phone}>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
        </Field>
        <Field label="College / organization" required error={errors.institution}>
          <Input value={form.institution} onChange={set('institution')} placeholder="e.g. PCCOE Pune" />
        </Field>
        <Field label="Course / branch" required error={errors.course}>
          <Input value={form.course} onChange={set('course')} placeholder="e.g. B.Tech Computer Engineering" />
        </Field>
        <Field label="Year of study" required error={errors.yearOfStudy}>
          <Select value={form.yearOfStudy} onChange={set('yearOfStudy')}>
            {YEARS.map((y) => <option key={y} value={y}>{y || 'Select year'}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Relevant experience (optional)" hint="Skills, past hackathons or projects.">
        <Textarea rows={2} value={form.experience} onChange={set('experience')} maxLength={300} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">
          Review details
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
