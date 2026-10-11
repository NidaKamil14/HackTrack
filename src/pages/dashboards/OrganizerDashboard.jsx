import React, { useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { getStoredHackathons, advanceHackathonStage } from '../../utils/hackathonService';
import { getAllTeams } from '../../utils/teamService';
import { getSubmissions } from '../../utils/submissionService';
import { addNotification } from '../../utils/notificationService';

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState(getStoredHackathons);
  const [teams] = useState(getAllTeams);
  const [submissions] = useState(getSubmissions);

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("all");
  const [notice, setNotice] = useState(null);

  const teamsList = Object.entries(teams).map(([code, t]) => ({ ...t, code }));

  const handleBroadcastAnnouncement = (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    addNotification({
      userEmail: "all",
      title: "Organizer Announcement",
      message: announcementText.trim(),
      type: "info",
      link: "/dashboard/student"
    });

    setNotice(`✓ Announcement broadcast to all participants of ${announcementTarget === 'all' ? 'all sprints' : announcementTarget}.`);
    setAnnouncementText("");
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAdvance = (id) => {
    const res = advanceHackathonStage(id);
    if (res.success) {
      setHackathons(getStoredHackathons());
      setNotice(`Stage updated to ${res.hackathon.stage} for ${res.hackathon.title}`);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  return (
    <DashboardLayout
      portalTitle="Organizer Operations Console"
      roleBadgeText="HACKATHON ORGANIZER"
    >
      <div className="space-y-6">

        {/* Header */}
        <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  EVENT OPERATIONS
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">{user?.university || "Organizing Committee"}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Welcome, {user?.fullName || "Organizer"}
              </h1>
            </div>

            <span className="text-xs text-slate-400">
              Manage assigned competitions, monitor squad formation, and post announcements.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-4 border-t border-[#253247]">
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">ASSIGNED SPRINTS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{hackathons.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">SQUADS FORMED</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{teamsList.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">SUBMISSIONS</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{submissions.length}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1c283c] rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">FINALIZED ENTRIES</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">
                {submissions.filter((s) => s.status === "finalized").length}
              </span>
            </div>
          </div>
        </section>

        {notice && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs">
            {notice}
          </div>
        )}

        {/* 2-Column: Broadcast & Sprints */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Sprints Management (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-[#253247] bg-[#121c32] flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    ASSIGNED HACKATHONS
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Timeline milestones & progress</p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">{hackathons.length} Sprints</span>
              </div>

              <div className="p-5 divide-y divide-[#1c283c]">
                {hackathons.map((h) => {
                  const sprintTeams = teamsList.filter((t) => t.hackathonId === h.id);
                  const sprintSubs = submissions.filter((s) => s.hackathonId === h.id);

                  return (
                    <div key={h.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
                            {h.stage}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">Deadline: {h.deadline}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{h.title}</h3>
                        <div className="text-slate-400 mt-0.5">
                          {sprintTeams.length} Squads • {sprintSubs.length} Deliverable(s)
                        </div>
                        <div className="w-full max-w-xs h-1.5 bg-[#111E31] rounded-full overflow-hidden mt-2 border border-[#253247]/50">
                          <div
                            className="h-full bg-[#2878F0] rounded-full transition-all duration-500"
                            style={{
                              width: `${
                                h.stage === "Results Published" ? 100 :
                                h.stage === "Rubric Judging" ? 85 :
                                h.stage === "Screening Gate" ? 70 :
                                h.stage === "Hacking Phase" ? 50 :
                                h.stage === "Team Formation" ? 35 : 20
                              }%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleAdvance(h.id)}
                          className="px-2.5 py-1.5 bg-[#121c32] hover:bg-[#1a2744] border border-[#253247] text-slate-200 rounded text-xs transition-colors"
                        >
                          Advance Stage →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Announcements Broadcast (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#253247] pb-3">
                <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">BROADCAST ANNOUNCEMENT</span>
                <span className="text-[10px] text-slate-400 font-mono">Real-time push</span>
              </div>

              <form onSubmit={handleBroadcastAnnouncement} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Target Competition</label>
                  <select
                    value={announcementTarget}
                    onChange={(e) => setAnnouncementTarget(e.target.value)}
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Active Competitions</option>
                    {hackathons.map((h) => (
                      <option key={h.id} value={h.id}>{h.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Announcement Message *</label>
                  <textarea
                    rows={4}
                    required
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="e.g. Office hours with ACM mentors start in 30 minutes! Repo freeze is sharp at 20:00 UTC."
                    className="w-full bg-[#080e1a] border border-[#223044] rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Send Announcement to Participants 📢
                </button>
              </form>
            </section>

            {/* Quick Sprints Overview */}
            <section className="bg-[#0d1526] border border-[#253247] rounded-xl p-4 text-xs space-y-2 shadow-sm">
              <div className="border-b border-[#253247] pb-2">
                <span className="text-[10px] font-mono text-slate-300 uppercase block font-semibold">PARTICIPANT SQUADS</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {teamsList.map((t) => (
                  <div key={t.code} className="p-2.5 rounded bg-[#080e1a] border border-[#1c283c] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{t.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{t.code} • {t.capacity}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{t.hackathon?.substring(0, 16)}...</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
