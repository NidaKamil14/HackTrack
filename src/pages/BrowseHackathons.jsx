import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { SearchX, Trophy } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import HackathonCard from '../components/HackathonCard';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { getStoredHackathons } from '../utils/hackathonService';
import api from '../utils/api';

// Deadlines are stored as display strings ("Oct 18, 2026"); compare them as dates.
const toTime = (value) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

// Normalise a server hackathon record into the shape HackathonCard expects.
const normalizeServerHackathon = (sh) => ({
  id: sh.id,
  title: sh.title,
  headline: sh.tagLine || `${sh.title} Innovation Sprint`,
  deadline: sh.submissionDeadline
    ? new Date(sh.submissionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'TBD',
  dates: `${sh.startDate ? new Date(sh.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} - ${sh.endDate ? new Date(sh.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`,
  stage: sh.isRegistrationClosed ? 'Registration Closed' : 'Registration Open',
  status: sh.status,
  isRegistrationClosed: sh.isRegistrationClosed,
  registrationDeadline: sh.registrationDeadline,
  submissionDeadline: sh.submissionDeadline,
  track: sh.track || 'General Track',
  category: sh.category || 'Full-Stack',
  teamSize: `${sh.minTeamSize || 1} - ${sh.maxTeamSize || 4} Members`,
  summary: sh.description || sh.summary || `Official ${sh.title} competition.`,
  tags: sh.tags || [],
  prizePool: sh.prizePool || sh.prize || '',
  organizerName: sh.organizerName || '',
  organizerEmail: sh.organizerEmail || '',
});

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

  // Fetch server hackathons (no auth required — public endpoint)
  const [serverHackathons, setServerHackathons] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api.getHackathons()
      .then((res) => {
        if (!cancelled && Array.isArray(res?.hackathons)) {
          setServerHackathons(res.hackathons);
        }
      })
      .catch(() => {}); // silently fall back to localStorage only
    return () => { cancelled = true; };
  }, []);

  // Merge local seed/localStorage hackathons with any extra ones from the server
  const allHackathons = useMemo(() => {
    const local = getStoredHackathons();
    if (!serverHackathons.length) return local;

    const combined = [...local];
    serverHackathons.forEach((sh) => {
      const idx = combined.findIndex(
        (h) => h.id === sh.id || h.title?.toLowerCase() === sh.title?.toLowerCase()
      );
      const normalized = normalizeServerHackathon(sh);
      if (idx >= 0) {
        combined[idx] = { ...combined[idx], ...normalized, id: sh.id };
      } else {
        combined.push(normalized);
      }
    });
    return combined;
  }, [serverHackathons]);

  const categories = ["All", "Full-Stack", "AI & ML", "IoT"];
  const stages = ["All", "Registration Open", "Team Formation", "Upcoming", "Screening Gate", "Rubric Judging", "Leaderboard Published"];

  const filteredHackathons = useMemo(() => {
    return allHackathons.filter((h) => {
      const matchSearch =
        (h.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.tags || []).some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === "All" || h.category === selectedCategory;
      const matchStage = selectedStage === "All" || h.stage === selectedStage;

      return matchSearch && matchCategory && matchStage;
    }).sort((a, b) => {
      if (sortBy === "deadline") return toTime(a.deadline) - toTime(b.deadline);
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return 0;
    });
  }, [allHackathons, searchTerm, selectedCategory, selectedStage, sortBy]);

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
