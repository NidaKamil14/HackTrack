import React, { useCallback, useEffect, useState } from 'react';
import { RotateCw, Send, UserPlus, XCircle } from 'lucide-react';
import api from '../../utils/api';
import { Alert, Badge, Button, Field, Input, Select } from '../ui';

const ROLE_LABEL = { judge: 'Judge', screening: 'Screening', mentor: 'Mentor', member: 'Member' };
const STATUS_TONE = { pending: 'warning', accepted: 'success', declined: 'neutral', revoked: 'neutral', expired: 'danger' };
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Plain-language result of sending, from what the server reported. */
function deliveryText(res) {
  const d = res?.delivery || {};
  const who = res?.invitation?.email;
  if (d.channel === 'in_app') {
    if (d.email === 'queued') return `${who} has a HackTrack account: they were notified in the app and an email is on its way.`;
    return `${who} has a HackTrack account and was notified in the app.${d.reason ? ` (Email not sent: ${d.reason}.)` : ''}`;
  }
  if (d.email === 'queued') return `An invitation email with a sign-up link is on its way to ${who}.`;
  return `The invitation was created, but no email was sent${d.reason ? `: ${d.reason}` : ''}.`;
}

/**
 * Invite by email (organizer → committee, or leader → team member), with the
 * list of invitations and their status. `mode` is "committee" or "team".
 */
export default function Invitations({ mode, hackathonId, teamId, roles = [], title, description }) {
  const [list, setList] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roles[0] || 'member');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    const req = mode === 'team' ? api.getTeamInvitations(teamId) : api.getCommitteeInvitations(hackathonId);
    req.then((res) => setList(res?.invitations || [])).catch(() => {});
  }, [mode, hackathonId, teamId]);

  useEffect(() => { load(); }, [load]);

  const show = (tone, text, devInviteUrl) => setNotice({ tone, text, devInviteUrl });

  const send = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = mode === 'team'
        ? await api.inviteTeamMember(teamId, email.trim())
        : await api.inviteCommitteeMember(hackathonId, email.trim(), role);
      show('success', deliveryText(res), res.devInviteUrl);
      setEmail('');
      load();
    } catch (err) {
      show('danger', err.message || 'The invitation could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (inv, action) => {
    try {
      const res = action === 'resend' ? await api.resendInvitation(inv.id) : await api.revokeInvitation(inv.id);
      show(action === 'resend' ? 'success' : 'info', action === 'resend' ? deliveryText(res) : res.message, res.devInviteUrl);
      load();
    } catch (err) {
      show('danger', err.message);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4" aria-label={title}>
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <UserPlus className="h-4 w-4 text-accent" aria-hidden="true" />
          {title}
        </h3>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>

      <form onSubmit={send} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Email address" className="flex-1">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.org" autoComplete="off" required maxLength={254} />
        </Field>
        {mode === 'committee' && (
          <Field label="Role" className="sm:w-40">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
        )}
        <Button type="submit" loading={busy} disabled={!email.trim()}>
          <Send aria-hidden="true" />
          Send invitation
        </Button>
      </form>

      {notice && (
        <Alert tone={notice.tone}>
          {notice.text}
          {notice.devInviteUrl && (
            <span className="mt-1 block text-xs">
              Local testing only (no email provider configured): the sign-up link is{' '}
              <a className="break-all font-mono text-accent underline" href={notice.devInviteUrl}>{window.location.origin}{notice.devInviteUrl}</a>
            </span>
          )}
        </Alert>
      )}

      {list.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {list.map((inv) => {
            const open = inv.status === 'pending' || inv.status === 'expired';
            return (
              <li key={inv.id} className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all font-medium text-fg">{inv.email}</p>
                  <p className="text-xs text-fg-subtle">
                    {mode === 'committee' && <>{ROLE_LABEL[inv.role]} · </>}
                    Invited {fmtDate(inv.createdAt)}
                    {inv.status === 'pending' && <> · expires {fmtDate(inv.expiresAt)}</>}
                    {!inv.hasAccount && inv.status === 'pending' && <> · no account yet</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS_TONE[inv.status] || 'neutral'}>{inv.status}</Badge>
                  {open && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => act(inv, 'resend')} aria-label={`Resend invitation to ${inv.email}`}>
                        <RotateCw aria-hidden="true" /> Resend
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => act(inv, 'revoke')} aria-label={`Revoke invitation to ${inv.email}`}>
                        <XCircle aria-hidden="true" /> Revoke
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
