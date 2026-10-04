import React, { useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { MOCK_ADMIN_DATA } from '../../data/mockDashboardData';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data] = useState(MOCK_ADMIN_DATA);
  const [hackathons, setHackathons] = useState(data.hackathons);
  const [adminNotice, setAdminNotice] = useState(null);

  // New hackathon modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newHackathon, setNewHackathon] = useState({
    title: "",
    track: "Full-Stack & Cloud Systems",
    stage: "Registration Open",
    prize: "$10,000 USD",
    deadline: "Nov 30, 2026"
  });

  const stagesList = [
    "Registration Open",
    "Team Formation",
    "Screening Gate",
    "Rubric Judging",
    "Leaderboard Published"
  ];

  const handleAdvanceStage = (id) => {
    setHackathons((prev) =>
      prev.map((h) => {
        if (h.id === id) {
          const currentIndex = stagesList.indexOf(h.stage);
          const nextIndex = (currentIndex + 1) % stagesList.length;
          const nextStage = stagesList[nextIndex];
          return { ...h, stage: nextStage };
        }
        return h;
      })
    );
    setAdminNotice("Hackathon competition stage successfully advanced.");
    setTimeout(() => setAdminNotice(null), 3000);
  };

  const handleCreateHackathon = (e) => {
    e.preventDefault();
    if (!newHackathon.title.trim()) return;

    const created = {
      id: newHackathon.title.toLowerCase().replace(/\s+/g, '-'),
      title: newHackathon.title,
      track: newHackathon.track,
      stage: newHackathon.stage,
      teams: 0,
      deadline: newHackathon.deadline,
      prize: newHackathon.prize
    };

    setHackathons([created, ...hackathons]);
    setShowCreateModal(false);
    setNewHackathon({
      title: "",
      track: "Full-Stack & Cloud Systems",
      stage: "Registration Open",
      prize: "$10,000 USD",
      deadline: "Nov 30, 2026"
    });
    setAdminNotice(`Sanctioned new hackathon: "${created.title}".`);
    setTimeout(() => setAdminNotice(null), 3500);
  };

  return (
    <DashboardLayout
      portalTitle="Platform Administration & Governance Console"
      roleBadgeText="PLATFORM ADMINISTRATOR"
    >
      <div className="space-y-6">
        
        {/* 1. PLATFORM OVERVIEW */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                  ADMIN CONSOLE
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {user?.university || "HackTrack Central HQ"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Platform Overview
              </h1>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
            >
              + Create New Hackathon
            </button>
          </div>

          {/* 5 Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">ACTIVE SPRINTS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{hackathons.length}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">REGISTERED USERS</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{data.stats.registeredUsers}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">TEAMS FORMED</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{data.stats.teamsFormed}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-emerald-400 font-mono uppercase block">SCREENING PASS RATE</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{data.stats.screeningClearanceRate}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-amber-400 font-mono uppercase block">CERTIFIED JUDGED</span>
              <span className="text-lg font-bold text-amber-400 mt-0.5 block">{data.stats.certifiedJudged}</span>
            </div>
          </div>
        </section>

        {adminNotice && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs">
            ✓ {adminNotice}
          </div>
        )}

        {/* 2. COMPETITION MANAGEMENT CARD */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                COMPETITION MANAGEMENT
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Stage progression and active sprint lifecycles
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">{hackathons.length} Sprints</span>
          </div>

          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <tr>
                    <th className="pb-2.5 font-semibold">Sprint Title</th>
                    <th className="pb-2.5 font-semibold">Track</th>
                    <th className="pb-2.5 font-semibold">Current Stage</th>
                    <th className="pb-2.5 font-semibold">Teams</th>
                    <th className="pb-2.5 font-semibold">Deadline</th>
                    <th className="pb-2.5 font-semibold text-right">Stage Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {hackathons.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 font-bold text-white pr-4">{h.title}</td>
                      <td className="py-3 text-slate-300 pr-4">{h.track}</td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
                          {h.stage}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300 font-mono pr-4">{h.teams}</td>
                      <td className="py-3 text-slate-400 font-mono pr-4">{h.deadline}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleAdvanceStage(h.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
                        >
                          Advance Stage →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3. USERS & ROLES CARD */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                USERS & ROLES
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Participant, committee, and judge registrations
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">{data.recentUsers.length} Active Records</span>
          </div>

          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <tr>
                    <th className="pb-2.5 font-semibold">Name</th>
                    <th className="pb-2.5 font-semibold">Email</th>
                    <th className="pb-2.5 font-semibold">Role</th>
                    <th className="pb-2.5 font-semibold">Organization</th>
                    <th className="pb-2.5 font-semibold text-right">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.recentUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 font-semibold text-white">{u.name}</td>
                      <td className="py-3 text-slate-300 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{u.org}</td>
                      <td className="py-3 text-slate-500 font-mono text-right">{u.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 4. PLATFORM ACTIONS CARD */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90">
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              PLATFORM ACTIONS & AUTOMATION
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              System-wide audit scans and certified ranking publication
            </p>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
              <h3 className="text-sm font-bold text-white">Automated Integrity Screen</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan all 112 participant repositories for pre-dated commits and tampering.
              </p>
              <button
                onClick={() => {
                  setAdminNotice("Executed repository integrity scan. Zero commit discrepancies detected.");
                  setTimeout(() => setAdminNotice(null), 3500);
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Execute Integrity Scan
              </button>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
              <h3 className="text-sm font-bold text-white">Publish Certified Leaderboard</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Lock completed evaluations, aggregate weights, and reveal final public standings.
              </p>
              <button
                onClick={() => {
                  setAdminNotice("Official rankings compiled and certified for public release.");
                  setTimeout(() => setAdminNotice(null), 3500);
                }}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
              >
                Certify & Publish Results
              </button>
            </div>
          </div>
        </section>

        {/* Modal: Sanction New Hackathon */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 relative shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  SANCTION NEW HACKATHON
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕ Close
                </button>
              </div>

              <form onSubmit={handleCreateHackathon} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Competition Title *</label>
                  <input
                    type="text"
                    required
                    value={newHackathon.title}
                    onChange={(e) => setNewHackathon({ ...newHackathon, title: e.target.value })}
                    placeholder="e.g. NextGen Web3 Sprint"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Track Category</label>
                  <select
                    value={newHackathon.track}
                    onChange={(e) => setNewHackathon({ ...newHackathon, track: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                  >
                    <option value="Full-Stack & Cloud Systems">Full-Stack & Cloud Systems</option>
                    <option value="Applied Machine Learning & Agents">Applied Machine Learning & Agents</option>
                    <option value="IoT & Campus Optimization">IoT & Campus Optimization</option>
                    <option value="Web3 & Smart Contracts">Web3 & Smart Contracts</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Prize Pool</label>
                    <input
                      type="text"
                      value={newHackathon.prize}
                      onChange={(e) => setNewHackathon({ ...newHackathon, prize: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Deadline</label>
                    <input
                      type="text"
                      value={newHackathon.deadline}
                      onChange={(e) => setNewHackathon({ ...newHackathon, deadline: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors mt-2"
                >
                  Create Competition
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
