import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MailOpen } from 'lucide-react';
import { Alert, Badge, Button, Field, Input, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const ROLE_TEAM = { judge: 'judging panel', screening: 'screening committee', mentor: 'mentor team' };
const ROLE_LABEL = { judge: 'Judge', screening: 'Screening committee', mentor: 'Mentor' };

/**
 * Sign-up from an invitation link. The email and role come from the
 * invitation and can't be changed; finishing binds the new account to the
 * hackathon. The link works once.
 */
export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, logout, signInWithSession } = useAuth();

  const [state, setState] = useState({ loading: true, invitation: null, error: null });
  const [form, setForm] = useState({ fullName: '', password: '', confirm: '', university: '', designation: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getInvitationByToken(token)
      .then((res) => { if (!cancelled) setState({ loading: false, invitation: res.invitation, error: null }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, invitation: null, error: err.message || 'This invitation link is not valid.' }); });
    return () => { cancelled = true; };
  }, [token]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (form.password.length < 6) return setFormError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setFormError('The passwords don’t match.');
    setSubmitting(true);
    try {
      const res = await api.registerWithInvitation(token, {
        fullName: form.fullName.trim(),
        password: form.password,
        university: form.university.trim() || undefined,
        designation: form.designation.trim() || undefined,
      });
      signInWithSession(res.token, res.user);
      navigate(res.redirectPath || '/', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Your account could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  const inv = state.invitation;
  const signedInAsSomeoneElse = user && inv && String(user.email).toLowerCase() !== inv.email;

  return (
    <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="surface-panel w-full max-w-md space-y-6 rounded-2xl border border-line p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <MailOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-fg">
            {inv ? `Join the ${ROLE_TEAM[inv.role]}` : 'Your invitation'}
          </h1>
          {inv && (
            <p className="mt-2 text-sm text-fg-muted">
              {inv.invitedByName} invited you to <span className="font-medium text-fg">{inv.hackathonTitle}</span>{' '}
              <Badge tone="accent" className="align-middle">{ROLE_LABEL[inv.role]}</Badge>
            </p>
          )}
        </div>

        {state.loading && (
          <div className="flex justify-center py-6"><Spinner /></div>
        )}

        {!state.loading && state.error && (
          <Alert tone="danger" title="This link can’t be used">
            {state.error} Ask the organizer to send you a new invitation.
          </Alert>
        )}

        {inv && inv.status !== 'pending' && (
          <Alert tone="warning" title={inv.status === 'expired' ? 'This invitation has expired' : `This invitation was ${inv.status}`}>
            Ask the organizer of {inv.hackathonTitle} to send you a new one.
          </Alert>
        )}

        {inv && inv.status === 'pending' && inv.hasAccount && (
          <Alert tone="info" title="You already have an account">
            Sign in as {inv.email} and accept the invitation from your dashboard.
          </Alert>
        )}

        {inv && inv.status === 'pending' && !inv.hasAccount && signedInAsSomeoneElse && (
          <Alert
            tone="warning"
            title={`You’re signed in as ${user.email}`}
            action={<Button size="sm" variant="secondary" onClick={logout}>Sign out to continue</Button>}
          >
            This invitation is for {inv.email}. Sign out, then open the link again.
          </Alert>
        )}

        {inv && inv.status === 'pending' && !inv.hasAccount && !signedInAsSomeoneElse && (
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <Field label="Email" hint="The invitation is for this address.">
              <Input value={inv.email} readOnly disabled />
            </Field>
            <Field label="Full name" required>
              <Input value={form.fullName} onChange={set('fullName')} autoComplete="name" required maxLength={120} disabled={submitting} />
            </Field>
            <Field label="Organization or university">
              <Input value={form.university} onChange={set('university')} autoComplete="organization" maxLength={150} disabled={submitting} />
            </Field>
            {(inv.role === 'judge' || inv.role === 'mentor') && (
              <Field label="Area of expertise" hint="For example: machine learning, cloud architecture">
                <Input value={form.designation} onChange={set('designation')} maxLength={150} disabled={submitting} />
              </Field>
            )}
            <Field label="Password" hint="At least 6 characters" required>
              <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required disabled={submitting} />
            </Field>
            <Field label="Confirm password" required>
              <Input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required disabled={submitting} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!form.fullName.trim() || !form.password}>
              Create account and join
            </Button>
          </form>
        )}

        <div className="border-t border-line pt-4 text-center">
          <Link to="/login" className="inline-flex items-center text-sm font-medium text-fg-muted transition-colors hover:text-fg">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
