import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MailOpen, X } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { subscribeToDataSync, triggerDataSync } from '../../utils/syncService';
import { Alert, Badge, Button, Card, CardContent, cn } from '../ui';

const ROLE_LABEL = { judge: 'Judge', screening: 'Screening committee', mentor: 'Mentor', member: 'Team member' };
const ROLE_TEAM = { judge: 'judging panel', screening: 'screening committee', mentor: 'mentor team' };

const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));

/**
 * Invitations waiting for the signed-in account (committee seats and team
 * spots). Shown at the top of every dashboard; accepting binds the account
 * to the event or adds it to the team on the server.
 */
export default function PendingInvitations() {
  const { user, updateSessionUser } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    if (!user || !api.getToken()) return;
    api.getMyInvitations()
      .then((res) => setInvitations(res?.invitations || []))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    load();
    return subscribeToDataSync(load);
  }, [load]);

  const respond = async (inv, action) => {
    setBusy(inv.id);
    try {
      const res = await api.respondToInvitation(inv.id, action);
      if (res?.user) updateSessionUser(res.user);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      setNotice({
        tone: action === 'accept' ? 'success' : 'info',
        text: action === 'accept'
          ? (inv.kind === 'team'
            ? `You joined ${inv.teamName} for ${inv.hackathonTitle}.`
            : `You're now on the ${ROLE_TEAM[inv.role]} for ${inv.hackathonTitle}. Its work appears below.`)
          : `You declined the invitation for ${inv.hackathonTitle}.`,
      });
      triggerDataSync('invitation_answered', { id: inv.id, action });
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err.message || 'The invitation could not be answered.',
        registerFor: err?.data?.code === 'REGISTER_FIRST' || /Register for/.test(err.message || '') ? inv.hackathonId : null,
      });
    } finally {
      setBusy(null);
    }
  };

  if (invitations.length === 0 && !notice) return null;

  return (
    <div className="mb-6 space-y-3" aria-label="Your invitations">
      {notice && (
        <Alert
          tone={notice.tone}
          action={notice.registerFor ? (
            <Link className="text-sm font-medium text-accent underline-offset-4 hover:underline" to={`/hackathons/${encodeURIComponent(notice.registerFor)}`}>
              Open the event to register
            </Link>
          ) : null}
        >
          {notice.text}
        </Alert>
      )}
      {invitations.map((inv) => (
        <Card key={inv.id} className="border-accent/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-inset ring-accent/20" aria-hidden="true">
                <MailOpen className="h-4 w-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-fg">
                  {inv.kind === 'team'
                    ? <>{inv.invitedByName} invited you to join <span className="text-accent">{inv.teamName}</span></>
                    : <>{inv.invitedByName} invited you to the {ROLE_TEAM[inv.role]}</>}
                </p>
                <p className="text-xs text-fg-muted">
                  {inv.hackathonTitle} · <Badge tone="accent" className="align-middle">{ROLE_LABEL[inv.role]}</Badge>
                  <span className="ml-2">Expires in {daysLeft(inv.expiresAt)} day{daysLeft(inv.expiresAt) === 1 ? '' : 's'}</span>
                </p>
              </div>
            </div>
            <div className={cn('flex shrink-0 gap-2', 'self-end sm:self-auto')}>
              <Button variant="secondary" size="sm" onClick={() => respond(inv, 'decline')} disabled={busy === inv.id}>
                <X aria-hidden="true" />
                Decline
              </Button>
              <Button size="sm" onClick={() => respond(inv, 'accept')} loading={busy === inv.id}>
                <Check aria-hidden="true" />
                Accept
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
