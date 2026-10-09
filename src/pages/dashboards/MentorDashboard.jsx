import React, { useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { Icons } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { getAllTeams } from '../../utils/teamService';
import { getSubmissions } from '../../utils/submissionService';
import { getStoredHackathons } from '../../utils/hackathonService';
import { addNotification } from '../../utils/notificationService';

const STORAGE_MENTOR_KEY = "hacktrack_mentor_notes";

function getMentorNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_MENTOR_KEY);
    return raw ? JSON.parse(raw) : {
      "HT-DEV-42": "Focus on stress testing the dead-letter queue backoff strategy before final freeze.",
      "HT-AI-99": "Agent fallback loop is solid. Consider adding tracing telemetry for tool selection."
    };
  } catch {
    return {};
  }
}

function saveMentorNotes(notes) {
  try {
    localStorage.setItem(STORAGE_MENTOR_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error("Failed to save mentor notes:", err);
  }
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const hackathons = getStoredHackathons();
  const allTeams = getAllTeams();
  const submissions = getSubmissions();

  const [notesMap, setNotesMap] = useState(getMentorNotes);
  const [activeTeamCode, setActiveTeamCode] = useState(Object.keys(allTeams)[0] || "");
  const [currentNoteInput, setCurrentNoteInput] = useState("");
  const [notice, setNotice] = useState(null);

  const teamsList = Object.entries(allTeams).map(([code, t]) => ({ ...t, code }));
  const activeTeam = teamsList.find((t) => t.code === activeTeamCode) || teamsList[0];

  const activeSubmission = activeTeam
    ? submissions.find((s) => s.teamId === activeTeam.code || (s.teamName && s.teamName === activeTeam.name))
    : null;

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!activeTeam || !currentNoteInput.trim()) return;

    const updated = {
      ...notesMap,
      [activeTeam.code]: currentNoteInput.trim()
    };
    setNotesMap(updated);
    saveMentorNotes(updated);

    // Notify team leader
    if (activeTeam.leadEmail) {
      addNotification({
        userEmail: activeTeam.leadEmail,
        title: "New Mentoring Guidance Received",
        message: `${user?.fullName || "Technical Mentor"} posted guidance for squad "${activeTeam.name}": "${currentNoteInput.trim()}"`,
        type: "info",
        link: "/dashboard/student"
      });
    }

    setNotice(`✓ Mentoring note dispatched to squad ${activeTeam.name}.`);
    setCurrentNoteInput("");
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <DashboardLayout
      portalTitle="Technical Mentor Guild"
      roleBadgeText="TECHNICAL MENTOR"
    >
      <div className="space-y-6">

        {/* Header */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  MENTORSHIP GUILD
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">{user?.university || "Cloud & AI Guild"}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Welcome, {user?.fullName || "Mentor"}
              </h1>
            </div>

            <span className="text-xs text-slate-400">
              Provide architectural guidance, review repository drafts, and conduct 1-on-1 check-ins.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-4 border-t border-[#253247]">
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">ASSIGNED SPRINTS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{hackathons.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">ASSIGNED SQUADS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{teamsList.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">NOTES DISPATCHED</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{Object.keys(notesMap).length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">DELIVERABLES STAGED</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">{submissions.length}</span>
            </div>
          </div>
        </section>

        {notice && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs">
            {notice}
          </div>
        )}

        {/* 2-Column: Squads list & Mentoring Chamber */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Assigned Teams (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-[#253247] bg-[#121c32] flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    ASSIGNED SQUADS
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Select a team for guidance</p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">{teamsList.length} Squads</span>
              </div>

              <div className="p-3 space-y-2">
                {teamsList.map((t) => {
                  const isSelected = activeTeam?.code === t.code;
                  const hasNote = Boolean(notesMap[t.code]);

                  return (
                    <button
                      key={t.code}
                      onClick={() => setActiveTeamCode(t.code)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-all text-xs ${
                        isSelected
                          ? "bg-[#121c32] border-emerald-500/80 shadow-sm"
                          : "bg-[#080e1a] border-[#1c283c] hover:border-[#354866]"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white text-sm">{t.name}</span>
                        {hasNote && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                            Notes Sent ✓
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.hackathon} • {t.capacity}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Mentoring Workspace (8 cols) */}
          <div className="lg:col-span-8">
            {activeTeam ? (
              <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">

                {/* Section Header */}
                <div className="px-5 py-4 border-b border-[#253247] bg-[#121c32] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-emerald-400 uppercase font-semibold block">
                      SQUAD CODE: {activeTeam.code}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{activeTeam.name}</h3>
                    <span className="text-xs text-slate-400">{activeTeam.hackathon} • Track: {activeTeam.track}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-[#080e1a] border border-[#1c283c] text-slate-300 font-mono text-xs">
                      Leader: {activeTeam.lead}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-5 text-xs">
                  {/* Current Deliverables Snapshot */}
                  {activeSubmission ? (
                    <div className="p-4 bg-[#080e1a] border border-[#1c283c] rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">PROJECT DRAFT</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          activeSubmission.status === 'finalized' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-amber-950 text-amber-300'
                        }`}>
                          {activeSubmission.status === 'finalized' ? 'Finalized' : 'Draft'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{activeSubmission.projectTitle || "Untitled Draft"}</h4>
                      {activeSubmission.projectDescription && (
                        <p className="text-slate-300 leading-relaxed">{activeSubmission.projectDescription}</p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {activeSubmission.repositoryUrl && (
                          <a
                            href={activeSubmission.repositoryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-[#121c32] border border-[#253247] text-slate-200 rounded text-xs flex items-center gap-1"
                          >
                            <Icons.ExternalLink />
                            <span>Inspect Git Repo</span>
                          </a>
                        )}
                        {activeSubmission.liveDemoUrl && (
                          <a
                            href={activeSubmission.liveDemoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-[#121c32] border border-[#253247] text-emerald-400 rounded text-xs flex items-center gap-1"
                          >
                            <Icons.ExternalLink />
                            <span>Live Demo</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#080e1a] border border-dashed border-[#253247] rounded-xl text-center text-slate-400">
                      Deliverables not yet drafted by this squad.
                    </div>
                  )}

                  {/* Existing Mentoring Guidance Thread */}
                  {notesMap[activeTeam.code] && (
                    <div className="p-4 bg-[#080e1a] border border-emerald-500/30 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">CURRENT MENTOR ADVISORY</span>
                        <span className="text-[10px] text-slate-500 font-mono">Dispatched</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed italic">"{notesMap[activeTeam.code]}"</p>
                    </div>
                  )}

                  {/* Add / Update Advisory Note */}
                  <form onSubmit={handleSaveNote} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold block mb-1">
                        Post Architectural Guidance & Office Hours Advice
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={currentNoteInput}
                        onChange={(e) => setCurrentNoteInput(e.target.value)}
                        placeholder="e.g. Recommended: add circuit breakers to handle API rate limits; clean up package dependencies..."
                        className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                      >
                        Dispatch Guidance to Squad →
                      </button>
                    </div>
                  </form>

                </div>
              </section>
            ) : null}
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
