import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './ui';

const linkClass = 'inline-flex min-h-10 items-center rounded-sm text-sm text-fg-muted transition-colors hover:text-fg sm:min-h-0';

export default function Footer() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="container-page flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Logo />
          <p className="text-sm text-fg-subtle">Hackathon competition management, end to end.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-0 sm:gap-y-2">
          <Link to="/hackathons" className={linkClass}>Browse hackathons</Link>
          <Link to="/login" className={linkClass}>Log in</Link>
          <Link to="/register" className={linkClass}>Register</Link>
        </nav>
      </div>
    </footer>
  );
}
