import React from 'react';
import { Icons } from './Icons';

export default function HackathonCard({
  hackathon,
  onNavigate,
  onOpenTeamCode,
  variant = "detailed" // "featured" | "detailed"
}) {
  if (variant === "featured") {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
        <div>
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-medium">
              {hackathon.stage}
            </span>
            <span className="text-slate-400 flex items-center gap-1 font-mono">
              <Icons.Calendar /> {hackathon.deadline}
            </span>
          </div>

          <h3 className="text-base font-bold text-white mb-2">{hackathon.title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">{hackathon.summary}</p>

          <div className="text-[11px] text-slate-400 space-y-1 mb-4">
            <div className="flex items-center gap-1.5">
              <Icons.UserGroup />
              <span>{hackathon.teamSize}</span>
            </div>
            <div className="text-slate-300 font-medium">
              Track: <span className="text-slate-400 font-normal">{hackathon.track}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate(hackathon.id)}
          className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <span>View Details</span>
          <Icons.ArrowRight />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
      <div>
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-medium">
            {hackathon.stage}
          </span>
          <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
            <Icons.Calendar /> {hackathon.deadline}
          </span>
        </div>

        <h3 className="text-lg font-bold text-white mb-1.5">{hackathon.title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-3">
          {hackathon.summary}
        </p>

        <div className="space-y-2 py-3 border-t border-b border-slate-800 text-xs mb-4">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-500">Track:</span>
            <span className="font-medium text-right truncate max-w-[180px]">{hackathon.track}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-500">Team Allowance:</span>
            <span>{hackathon.teamSize}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-500">Prize Recognition:</span>
            <span className="font-mono text-amber-400 font-semibold">{hackathon.prizePool}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {hackathon.tags?.map((t, idx) => (
            <span key={idx} className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-2 flex items-center gap-2">
        <button
          onClick={() => onNavigate(hackathon.id)}
          className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <span>View Specifications</span>
          <Icons.ArrowRight />
        </button>
        {onOpenTeamCode && (
          <button
            onClick={() => onOpenTeamCode(hackathon)}
            title="Enter Team Code"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            <Icons.Key />
          </button>
        )}
      </div>
    </div>
  );
}
