import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Icons } from '../components/Icons';
import HackathonCard from '../components/HackathonCard';
import { HACKATHONS } from '../data/hackathons';
import { SYSTEM_ROLES } from '../data/roles';

export default function Home({
  onOpenTeamModal: propOpenTeamModal,
  setTeamCodeInput: propSetTeamCodeInput
}) {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const onOpenTeamModal = propOpenTeamModal || outletContext.onOpenTeamModal || (() => {});
  const setTeamCodeInput = propSetTeamCodeInput || outletContext.setTeamCodeInput || (() => {});

  const [activeRole, setActiveRole] = useState("students");
  const [heroInput, setHeroInput] = useState("");

  const handleHeroSubmit = (e) => {
    e.preventDefault();
    if (heroInput.trim()) {
      setTeamCodeInput(heroInput.trim().toUpperCase());
      onOpenTeamModal(heroInput.trim().toUpperCase());
    } else {
      setTeamCodeInput("HT-DEV-42");
      onOpenTeamModal("HT-DEV-42");
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="pt-16 pb-16 border-b border-slate-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Hackathon Competition Management System
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Manage Hackathons from Idea to Final Evaluation.
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            HackTrack organizes the entire competition cycle: student registrations, team invite codes, submission locks, committee screening, and rubric judging.
          </p>

          {/* Quick Team Code Lookup Bar */}
          <form onSubmit={handleHeroSubmit} className="mt-8 max-w-md mx-auto p-1.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-2 shadow-lg shadow-black/40">
            <input
              type="text"
              placeholder="Have a team code? e.g. HT-DEV-42"
              value={heroInput}
              onChange={(e) => setHeroInput(e.target.value.toUpperCase())}
              className="bg-transparent text-sm px-3 py-1.5 text-white placeholder-slate-500 flex-1 focus:outline-none uppercase font-mono tracking-wider"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0"
            >
              Join Team
            </button>
          </form>

          <div className="mt-4 text-xs text-slate-500 font-mono">
            Sample codes for testing: <span className="text-slate-300">HT-DEV-42</span> or <span className="text-slate-300">HT-AI-99</span>
          </div>

        </div>
      </section>

      {/* Active Hackathons Preview */}
      <section id="hackathons" className="py-16 border-b border-slate-900">
        <div className="max-w-6xl mx-auto px-4">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">Active Hackathons</h2>
              <p className="text-sm text-slate-400 mt-1">Select a competition to view requirements or register your team.</p>
            </div>
            <button
              onClick={() => navigate('/hackathons')}
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-2 sm:mt-0"
            >
              <span>View all sprints</span>
              <Icons.ArrowRight />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HACKATHONS.map((h) => (
              <HackathonCard
                key={h.id}
                hackathon={h}
                variant="featured"
                onNavigate={(id) => navigate(`/hackathons/${id}`)}
              />
            ))}
          </div>

        </div>
      </section>

      {/* How HackTrack Works */}
      <section id="how-it-works" className="py-16 border-b border-slate-900 bg-slate-950/40">
        <div className="max-w-6xl mx-auto px-4">
          
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl font-bold text-white">How HackTrack Works</h2>
            <p className="text-sm text-slate-400 mt-1">A direct, structured progression from kickoff to certified scoring.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
              <span className="text-xs font-mono text-emerald-400 font-semibold block mb-2">STEP 1</span>
              <h4 className="text-sm font-bold text-white mb-1">Discover & Register</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Students review competition tracks, rules, and deadlines to sign up for an upcoming sprint.
              </p>
            </div>

            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
              <span className="text-xs font-mono text-emerald-400 font-semibold block mb-2">STEP 2</span>
              <h4 className="text-sm font-bold text-white mb-1">Team Formation Codes</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Leaders spin up a team and share an invite code. Members join instantly without manual invites.
              </p>
            </div>

            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
              <span className="text-xs font-mono text-emerald-400 font-semibold block mb-2">STEP 3</span>
              <h4 className="text-sm font-bold text-white mb-1">Screening Filter</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                A dedicated committee checks repository authenticity and working demo URLs to eliminate broken submissions.
              </p>
            </div>

            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
              <span className="text-xs font-mono text-emerald-400 font-semibold block mb-2">STEP 4</span>
              <h4 className="text-sm font-bold text-white mb-1">Rubric Judging</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Judges evaluate only pre-screened finalists using weighted rubrics and deliver final scores and feedback.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 5 System Roles */}
      <section id="roles" className="py-16 border-b border-slate-900">
        <div className="max-w-6xl mx-auto px-4">
          
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-bold text-white">5 System Roles</h2>
            <p className="text-sm text-slate-400 mt-1">Each user has dedicated tools suited to their place in the hackathon lifecycle.</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {SYSTEM_ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeRole === role.id
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {role.title}
              </button>
            ))}
          </div>

          {(() => {
            const current = SYSTEM_ROLES.find((r) => r.id === activeRole);
            if (!current) return null;
            return (
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl max-w-2xl">
                <h3 className="text-base font-bold text-white mb-1">{current.title}</h3>
                <p className="text-xs text-slate-400 mb-4">{current.summary}</p>
                <div className="space-y-2">
                  {current.points.map((pt, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <Icons.Check />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

        </div>
      </section>
    </div>
  );
}
