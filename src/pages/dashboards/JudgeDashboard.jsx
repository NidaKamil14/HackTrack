import React, { useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { Icons } from '../../components/Icons';
import { MOCK_JUDGE_DATA } from '../../data/mockDashboardData';
import { useAuth } from '../../context/AuthContext';

export default function JudgeDashboard() {
  const { user } = useAuth();
  const [data] = useState(MOCK_JUDGE_DATA);
  const [teams, setTeams] = useState(data.shortlistedTeams);
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0].id);
  const [saveNotice, setSaveNotice] = useState(null);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];

  const handleScoreChange = (rubricKey, val) => {
    const num = Math.max(0, Math.min(35, Number(val) || 0));
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === selectedTeamId) {
          return {
            ...t,
            scores: {
              ...t.scores,
              [rubricKey]: num
            }
          };
        }
        return t;
      })
    );
  };

  const handleFeedbackChange = (text) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === selectedTeamId ? { ...t, feedback: text } : t))
    );
  };

  const computeTotal = (scores) => {
    return Object.values(scores || {}).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  };

  const handleSaveEvaluation = (e) => {
    e.preventDefault();
    setTeams((prev) =>
      prev.map((t) => (t.id === selectedTeamId ? { ...t, status: "Evaluated" } : t))
    );
    setSaveNotice(`Certified score (${computeTotal(selectedTeam.scores)} / 100) saved for ${selectedTeam.name}.`);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const evaluatedCount = teams.filter((t) => t.status === "Evaluated").length;
  const pendingCount = teams.length - evaluatedCount;

  return (
    <DashboardLayout
      portalTitle="Judge & Evaluation Panel"
      roleBadgeText="JUDGE / EVALUATOR"
    >
      <div className="space-y-6">
        
        {/* 1. OVERVIEW */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  JUDGING PANEL
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {user?.university || "ACM Expert Review Panel"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Evaluation Chamber
              </h1>
            </div>

            <span className="text-xs text-slate-400">
              Score pre-screened finalists across standardized rubrics.
            </span>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">ASSIGNED SPRINTS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{data.assignedHackathons.length}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">FINALIST TEAMS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{teams.length}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-emerald-400 font-mono uppercase block">COMPLETED</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{evaluatedCount}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-amber-400 font-mono uppercase block">PENDING</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">{pendingCount}</span>
            </div>
          </div>
        </section>

        {/* 2. TWO-COLUMN LAYOUT: ASSIGNED TEAMS & EVALUATION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (4 cols): Assigned Teams Roster */}
          <div className="lg:col-span-4 space-y-3">
            <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    ASSIGNED TEAMS
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select a finalist to evaluate
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {teams.length} Teams
                </span>
              </div>

              <div className="p-3 space-y-2">
                {teams.map((t) => {
                  const isSelected = t.id === selectedTeamId;
                  const isEvaluated = t.status === "Evaluated";
                  const totalScore = computeTotal(t.scores);

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTeamId(t.id)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-all text-xs ${
                        isSelected
                          ? "bg-slate-800 border-emerald-500/80 shadow-sm"
                          : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white text-sm">{t.name}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                          isEvaluated
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-950/60 text-amber-300 border border-amber-500/30"
                        }`}>
                          {isEvaluated ? `${totalScore} pts` : "Pending"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-0.5">
                        <div className="truncate">{t.hackathon}</div>
                        <div className="text-slate-500 truncate">{t.track}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column (8 cols): Single Unified Evaluation Section */}
          <div className="lg:col-span-8">
            <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              
              {/* Section Header */}
              <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      RUBRIC EVALUATION
                    </h2>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-400">{selectedTeam.hackathon}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{selectedTeam.name}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-right">
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">TOTAL SCORE</span>
                    <span className="text-base font-extrabold font-mono text-white">
                      {computeTotal(selectedTeam.scores)} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5 text-xs">
                
                {/* External Deliverable Links */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                      Gate Cleared [4/4]
                    </span>
                    <span className="text-slate-400 text-xs">Track: {selectedTeam.track}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={selectedTeam.repo}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      <Icons.ExternalLink />
                      <span>Repository</span>
                    </a>
                    <a
                      href={selectedTeam.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-slate-600 text-emerald-400 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      <Icons.ExternalLink />
                      <span>Live Demo</span>
                    </a>
                  </div>
                </div>

                {saveNotice && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs">
                    {saveNotice}
                  </div>
                )}

                {/* Rubric Form */}
                <form onSubmit={handleSaveEvaluation} className="space-y-4">
                  <div className="space-y-3">
                    <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
                      SCORE BREAKDOWN
                    </span>

                    {data.rubrics.map((r) => {
                      const currentVal = selectedTeam.scores[r.key] || 0;
                      return (
                        <div key={r.key} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-200">{r.name}</span>
                            <span className="font-mono text-emerald-400 text-[11px]">
                              Weight {r.weight} (Max {r.max} pts)
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min={0}
                              max={r.max}
                              value={currentVal}
                              onChange={(e) => handleScoreChange(r.key, e.target.value)}
                              className="flex-1 accent-emerald-500 cursor-pointer"
                            />
                            <div className="flex items-center gap-1 font-mono text-xs">
                              <input
                                type="number"
                                min={0}
                                max={r.max}
                                value={currentVal}
                                onChange={(e) => handleScoreChange(r.key, e.target.value)}
                                className="w-12 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white focus:outline-none focus:border-emerald-500 font-bold"
                              />
                              <span className="text-slate-500 text-[11px]">/{r.max}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Constructive Feedback */}
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold block mb-1">
                      Constructive Feedback & Notes
                    </label>
                    <textarea
                      rows={3}
                      value={selectedTeam.feedback || ""}
                      onChange={(e) => handleFeedbackChange(e.target.value)}
                      placeholder="Add specific comments on architecture, implementation, and strengths..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Submission Row */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Status: <span className="text-slate-300 font-semibold">{selectedTeam.status}</span>
                    </span>

                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
                    >
                      Commit & Certify Score →
                    </button>
                  </div>
                </form>

              </div>
            </section>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
