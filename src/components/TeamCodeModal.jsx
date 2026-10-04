import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from './Icons';
import { useAuth } from '../context/AuthContext';
import { getTeamByCode, joinTeamWithCode } from '../utils/teamService';
import { isUserRegistered, registerForHackathon } from '../utils/registrationService';

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

  const handleConfirmJoin = () => {
    setJoinError(null);

    // 1. Require authentication
    if (!isAuthenticated || !user) {
      setJoinError({
        type: "auth",
        text: "You must be logged in to join a team roster."
      });
      return;
    }

    // 2. Check if registered for this team's hackathon
    const registered = isUserRegistered(user.email, result.hackathonId);
    if (!registered) {
      setJoinError({
        type: "registration",
        hackathonId: result.hackathonId,
        hackathonTitle: result.hackathon,
        text: `You must register for "${result.hackathon}" before joining this team roster.`
      });
      return;
    }

    // 3. Join team
    const res = joinTeamWithCode(code, user);
    if (res.success) {
      setResult(res.team);
      setJoinSuccess(true);
    } else {
      setJoinError({
        type: "error",
        text: res.error || "Failed to join team."
      });
    }
  };

  const handleRegisterAndJoin = () => {
    if (!user || !result) return;
    registerForHackathon(user.email, result.hackathonId);
    const res = joinTeamWithCode(code, user);
    if (res.success) {
      setResult(res.team);
      setJoinSuccess(true);
      setJoinError(null);
    } else {
      setJoinError({
        type: "error",
        text: res.error
      });
    }
  };

  const memberNames = result?.members
    ? result.members.map((m) => (typeof m === 'string' ? m : m.name)).join(", ")
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <Icons.Close />
        </button>

        <h3 className="text-base font-bold text-white mb-1">Team Lookup</h3>
        <p className="text-xs text-slate-400 mb-4">Enter your 8-character team invite code</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. HT-DEV-42"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 uppercase tracking-wider focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleVerify}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
          >
            Verify
          </button>
        </div>

        {result ? (
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white text-sm">{result.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono">
                {result.capacity}
              </span>
            </div>
            <div className="text-slate-400">
              Sprint: <span className="text-slate-200">{result.hackathon}</span>
            </div>
            <div className="text-slate-400">
              Track: <span className="text-slate-200">{result.track}</span>
            </div>
            <div className="text-slate-400">
              Roster: <span className="text-slate-300">{memberNames}</span>
            </div>

            {joinError && (
              <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs space-y-2">
                <div>{joinError.text}</div>
                {joinError.type === "auth" && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/login');
                    }}
                    className="w-full py-1.5 bg-emerald-500 text-slate-950 font-bold rounded text-xs"
                  >
                    Log In to Continue →
                  </button>
                )}
                {joinError.type === "registration" && (
                  <button
                    onClick={handleRegisterAndJoin}
                    className="w-full py-1.5 bg-emerald-500 text-slate-950 font-bold rounded text-xs"
                  >
                    Register for {joinError.hackathonTitle} & Join →
                  </button>
                )}
              </div>
            )}

            {joinSuccess ? (
              <div className="p-2.5 rounded bg-emerald-500/20 text-emerald-300 text-center font-semibold text-xs border border-emerald-500/30 mt-2">
                ✓ Joined Team Successfully! Roster updated.
              </div>
            ) : (
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleConfirmJoin}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Confirm & Join Roster
                </button>
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/hackathons/${result.hackathonId}`);
                  }}
                  className="text-center text-[11px] text-slate-400 hover:text-white"
                >
                  View full sprint specifications →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 rounded-lg text-xs text-center">
            Code not found. Try sample codes: <b>HT-DEV-42</b> or <b>HT-AI-99</b>.
          </div>
        )}
      </div>
    </div>
  );
}
