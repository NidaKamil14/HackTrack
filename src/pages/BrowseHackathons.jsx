import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { SearchX, Trophy } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import HackathonCard from '../components/HackathonCard';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { getStoredHackathons } from '../utils/hackathonService';

// Deadlines are stored as display strings ("Oct 18, 2026"); compare them as dates.
const toTime = (value) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

export default function BrowseHackathons({
  onOpenTeamModal: propOpenTeamModal,
  setTeamCodeInput: propSetTeamCodeInput
}) {
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
    const list = getStoredHackathons();
    return list.filter((h) => {
      const matchSearch =
        h.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === "All" || h.category === selectedCategory;
      const matchStage = selectedStage === "All" || h.stage === selectedStage;

      return matchSearch && matchCategory && matchStage;
    }).sort((a, b) => {
      if (sortBy === "deadline") return toTime(a.deadline) - toTime(b.deadline);
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return 0;
    });
  }, [searchTerm, selectedCategory, selectedStage, sortBy]);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("All");
    setSelectedStage("All");
  };
  const isFiltered = searchTerm || selectedCategory !== "All" || selectedStage !== "All";

  return (
    <div className="container-page space-y-8 py-10 sm:py-14">
      <PageHeader
        variant="hero"
        icon={Trophy}
        eyebrow="Discover"
        title="Hackathons"
        description="Find a competition, review its rules and judging criteria, then register or join your team with an invite code."
      />

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

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-fg-subtle" aria-live="polite">
          <h2 className="text-sm font-normal text-fg-subtle">
            {filteredHackathons.length} {filteredHackathons.length === 1 ? "hackathon" : "hackathons"}
          </h2>
          {isFiltered && filteredHackathons.length > 0 && (
            <Button variant="link" size="sm" onClick={resetFilters}>Clear filters</Button>
          )}
        </div>

        {filteredHackathons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line">
            <EmptyState
              illustration="search"
              icon={SearchX}
              title="No hackathons match these filters"
              description="Try a different keyword, or widen the stage and track filters."
              action={<Button variant="secondary" onClick={resetFilters}>Clear filters</Button>}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHackathons.map((hackathon) => (
              <HackathonCard
                key={hackathon.id}
                hackathon={hackathon}
                variant="detailed"
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
