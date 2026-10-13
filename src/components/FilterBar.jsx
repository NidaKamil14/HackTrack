import React from 'react';
import { Search, X } from 'lucide-react';
import { Input, Select, cn } from './ui';

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
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search hackathons"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, keyword or tag"
            className="pl-9 pr-9"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-fg-subtle hover:bg-raised hover:text-fg"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            aria-label="Filter by stage"
            value={selectedStage}
            onChange={(e) => onStageChange(e.target.value)}
            className="sm:w-48"
          >
            {stages.map((st) => (
              <option key={st} value={st}>{st === "All" ? "All stages" : st}</option>
            ))}
          </Select>
          <Select
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="sm:w-44"
          >
            <option value="deadline">Soonest deadline</option>
            <option value="title">Title (A–Z)</option>
          </Select>
        </div>
      </div>

      <div role="radiogroup" aria-label="Track category" className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onCategoryChange(cat)}
              className={cn(
                'h-8 rounded-full border px-3 text-sm font-medium transition-colors max-sm:h-10 max-sm:px-4 touch:h-10',
                active
                  ? 'border-accent/40 bg-accent/10 text-accent-text'
                  : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
              )}
            >
              {cat === "All" ? "All tracks" : cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
