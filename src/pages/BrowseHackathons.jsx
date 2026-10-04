import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import HackathonCard from '../components/HackathonCard';
import { HACKATHONS } from '../data/hackathons';

export default function BrowseHackathons({
  onOpenTeamModal: propOpenTeamModal,
  setTeamCodeInput: propSetTeamCodeInput
}) {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const onOpenTeamModal = propOpenTeamModal || outletContext.onOpenTeamModal || (() => {});
  const setTeamCodeInput = propSetTeamCodeInput || outletContext.setTeamCodeInput || (() => {});

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStage, setSelectedStage] = useState("All");
  const [sortBy, setSortBy] = useState("deadline");

  const categories = ["All", "Full-Stack", "AI & ML", "IoT"];
  const stages = ["All", "Registration Open", "Team Formation", "Upcoming"];

  const filteredHackathons = useMemo(() => {
    return HACKATHONS.filter((h) => {
      const matchSearch =
        h.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === "All" || h.category === selectedCategory;
      const matchStage = selectedStage === "All" || h.stage === selectedStage;

      return matchSearch && matchCategory && matchStage;
    }).sort((a, b) => {
      if (sortBy === "deadline") return a.deadline.localeCompare(b.deadline);
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return 0;
    });
  }, [searchTerm, selectedCategory, selectedStage, sortBy]);

  return (
    <div className="py-12">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 mb-3">
            <span>PUBLIC DIRECTORY</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Browse Active Hackathons</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Discover sanctioned sprints, review eligibility and screening criteria, and join existing team rosters.
          </p>
        </div>

        {/* Filter Controls Bar */}
        <FilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedStage={selectedStage}
          onStageChange={setSelectedStage}
          stages={stages}
          sortBy={sortBy}
          onSortChange={setSortBy}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
        />

        {/* Hackathon Listing Cards */}
        {filteredHackathons.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
            <p className="text-slate-400 text-sm">No hackathons match your current search and filter settings.</p>
            <button
              onClick={() => { setSearchTerm(""); setSelectedCategory("All"); setSelectedStage("All"); }}
              className="mt-3 text-xs text-emerald-400 underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHackathons.map((hackathon) => (
              <HackathonCard
                key={hackathon.id}
                hackathon={hackathon}
                variant="detailed"
                onNavigate={(id) => navigate(`/hackathons/${id}`)}
                onOpenTeamCode={(h) => {
                  const code = h.id === "devpulse-2026" ? "HT-DEV-42" : "HT-AI-99";
                  setTeamCodeInput(code);
                  onOpenTeamModal(code);
                }}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
