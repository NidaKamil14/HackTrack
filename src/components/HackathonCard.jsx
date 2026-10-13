import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, KeyRound, Trophy, Users } from 'lucide-react';
import { Badge, Button, Card, stageTone } from './ui';

/**
 * Hackathon listing card. The title is a link stretched over the whole card,
 * so the card is one large click target while nested buttons stay usable.
 * `featured` is the compact variant used on the home page.
 */
export default function HackathonCard({
  hackathon,
  onOpenTeamCode,
  variant = "detailed" // "featured" | "detailed"
}) {
  const detailed = variant === "detailed";
  const href = `/hackathons/${hackathon.id}`;

  return (
    <Card interactive className="group relative flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={stageTone(hackathon.stage)} dot>{hackathon.stage}</Badge>
        {hackathon.category && <span className="text-xs text-fg-subtle">{hackathon.category}</span>}
      </div>

      <h3 className="mt-4 text-base font-semibold leading-snug text-fg">
        <Link
          to={href}
          className="rounded-sm after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-ring"
        >
          {hackathon.title}
        </Link>
        <ArrowUpRight
          className="ml-1 inline h-4 w-4 -translate-y-px text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </h3>
      {hackathon.track && <p className="mt-0.5 text-sm text-fg-muted">{hackathon.track}</p>}

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-fg-muted">{hackathon.summary}</p>

      <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-5 text-sm text-fg-subtle">
        <div className="flex items-center gap-1.5">
          <dt><CalendarDays className="h-4 w-4" aria-label="Dates" /></dt>
          <dd>{hackathon.dates || hackathon.deadline}</dd>
        </div>
        {hackathon.teamSize && (
          <div className="flex items-center gap-1.5">
            <dt><Users className="h-4 w-4" aria-label="Team size" /></dt>
            <dd>{hackathon.teamSize}</dd>
          </div>
        )}
        {detailed && hackathon.prizePool && (
          <div className="flex items-center gap-1.5">
            <dt><Trophy className="h-4 w-4" aria-label="Prize pool" /></dt>
            <dd className="font-medium text-fg">{hackathon.prizePool}</dd>
          </div>
        )}
      </dl>

      {detailed && (hackathon.tags?.length > 0 || onOpenTeamCode) && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label="Tags">
            {hackathon.tags?.slice(0, 3).map((tag) => (
              <li key={tag} className="rounded-md bg-raised px-2 py-0.5 text-xs text-fg-muted">{tag}</li>
            ))}
          </ul>
          {onOpenTeamCode && (
            <Button
              variant="ghost"
              size="sm"
              className="relative z-10 shrink-0"
              onClick={() => onOpenTeamCode(hackathon)}
            >
              <KeyRound aria-hidden="true" />
              Team code
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
