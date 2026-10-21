import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Dialog, Input } from './ui';
import { useAuth } from '../context/AuthContext';
import { getTeamByCode, joinTeamWithCode } from '../utils/teamService';
import { isUserRegistered, registerForHackathon } from '../utils/registrationService';
import api from '../utils/api';

export default function TeamCodeModal({
  isOpen,
  onClose,
  initialCode = "HT-DEV-42",
  navigate: propNavigate
}) {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const { user, isAuthenticated } = useAuth();

  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState(() => getTeamByCode(initialCode));
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Sync state when modal is opened or initialCode changes without cascading effect
  const [prevInitialCode, setPrevInitialCode] = useState(initialCode);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen && (!prevIsOpen || initialCode !== prevInitialCode)) {
    setPrevIsOpen(isOpen);
    setPrevInitialCode(initialCode);
    setCode(initialCode);
    setResult(getTeamByCode(initialCode));
    setJoinSuccess(false);
    setJoinError(null);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  if (!isOpen) return null;

  const handleVerify = () => {
    const trimmed = code.trim().toUpperCase();
    const found = getTeamByCode(trimmed);
    setResult(found || null);
    setJoinSuccess(false);
    setJoinError(null);
  };

  const handleConfirmJoin = async () => {
    setJoinError(null);

    // 1. Require authentication
    if (!isAuthenticated || !user) {
      setJoinError({
        type: "auth",
        text: "You must be logged in to submit a join request."
      });
      return;
    }

    // 2. Check if registered for this team's hackathon (if known)
    if (result?.hackathonId && !isUserRegistered(user.email, result.hackathonId)) {
      setJoinError({
        type: "registration",
        hackathonId: result.hackathonId,
        hackathonTitle: result.hackathon,
        text: `You must register for "${result.hackathon}" before requesting to join this team.`
      });
      return;
    }

    // 3. Submit join request through backend API (or fallback)
    try {
      if (api.getToken()) {
        await api.joinTeam(code.trim().toUpperCase());
        setJoinSuccess(true);
      } else {
        const res = await joinTeamWithCode(code, user);
        if (res.success) {
          setJoinSuccess(true);
        } else {
          setJoinError({
            type: "error",
            text: res.error || "Failed to submit join request."
          });
        }
      }
    } catch (err) {
      setJoinError({
        type: "error",
        text: err.data?.message || err.message || "Failed to submit join request."
      });
    }
  };

  const handleRegisterAndJoin = async () => {
    if (!user || !result) return;
    registerForHackathon(user.email, result.hackathonId);
    await handleConfirmJoin();
  };

  const memberNames = result?.members
    ? result.members.map((m) => (typeof m === 'string' ? m : m.name)).join(", ")
    : "";

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Team lookup"
      description="Enter the invite code your team leader shared with you."
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
      >
        <Input
          aria-label="Team code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. HT-DEV-42"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase tracking-wider"
        />
        <Button type="submit" variant="secondary">
          Verify
        </Button>
      </form>

      {result ? (
        <div className="mt-4 rounded-xl border border-line bg-raised/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-fg">{result.name}</p>
            <Badge tone="accent" className="font-mono">{result.capacity}</Badge>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-fg-subtle">Event</dt>
              <dd className="text-fg">{result.hackathon}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-fg-subtle">Track</dt>
              <dd className="text-fg">{result.track}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-fg-subtle">Roster</dt>
              <dd className="text-fg-muted">{memberNames}</dd>
            </div>
          </dl>

          {joinError && (
            <div role="alert" className="mt-4 space-y-3 rounded-lg border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
              <p>{joinError.text}</p>
              {joinError.type === "auth" && (
                <Button
                  className="w-full"
                  onClick={() => {
                    onClose();
                    navigate('/login');
                  }}
                >
                  Log in to continue
                </Button>
              )}
              {joinError.type === "registration" && (
                <Button className="w-full" onClick={handleRegisterAndJoin}>
                  Register for {joinError.hackathonTitle} &amp; join
                </Button>
              )}
            </div>
          )}

          {joinSuccess ? (
            <p role="status" className="mt-4 rounded-lg border border-success/25 bg-success/10 p-3 text-center text-sm font-medium text-success">
              ✓ Join request submitted successfully! Awaiting approval from the Team Leader. You will receive an email notification upon decision.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <Button className="w-full" onClick={handleConfirmJoin}>
                Submit join request
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  onClose();
                  navigate(`/hackathons/${result.hackathonId}`);
                }}
              >
                View hackathon details
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p role="alert" className="mt-4 rounded-lg border border-danger/25 bg-danger/10 p-3 text-center text-sm text-danger">
          Code not found. Try a sample code: <b className="font-mono">HT-DEV-42</b> or <b className="font-mono">HT-AI-99</b>.
        </p>
      )}
    </Dialog>
  );
}
