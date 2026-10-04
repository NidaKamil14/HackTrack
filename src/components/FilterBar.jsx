import React from 'react';
import { Icons } from './Icons';

export default function FilterBar({
  searchTerm,
  onSearchChange,
  selectedStage,
  onStageChange,
  stages = ["All", "Registration Open", "Team Formation", "Upcoming"],
  sortBy,
  onSortChange,
  selectedCategory,
  onCategoryChange,
  categories = ["All", "Full-Stack", "AI & ML", "IoT"]
}) {
  return (
    <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl mb-8 space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Icons.Search />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by sprint title, keywords, or tags..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
          />
        </div>

        {/* Stage Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">Stage:</span>
          <select
            value={selectedStage}
            onChange={(e) => onStageChange(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-700"
          >
            {stages.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-700"
          >
            <option value="deadline">Registration Deadline</option>
            <option value="title">Sprint Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Track Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
        <span className="text-xs text-slate-400 mr-2">Track Category:</span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              selectedCategory === cat
                ? "bg-emerald-500 text-slate-950 font-bold"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
