import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ExternalLink, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ThemeToggle';
import EmailPreferencesDialog from '../notifications/EmailPreferencesDialog';
import { AppBackdrop, Badge, Button, Logo, PageHeaderVariantContext } from '../ui';

export default function DashboardLayout({
  portalTitle,
  roleBadgeText,
  children
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U";

  return (
    <div className="relative flex min-h-screen flex-col justify-between text-fg">
      <AppBackdrop variant="dashboard" />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg">
        Skip to main content
      </a>
      <div>
        <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/75 backdrop-blur-xl supports-[backdrop-filter]:bg-canvas/60">
          <span className="hairline-gradient pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60" aria-hidden="true" />
          <div className="container-page flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/" className="inline-flex min-h-10 items-center rounded-md" aria-label="HackTrack home">
                <Logo />
              </Link>
              <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
              <Badge tone="accent" className="hidden sm:inline-flex">
                {roleBadgeText || portalTitle}
              </Badge>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <Button as={Link} to="/" variant="ghost" size="sm" className="hidden md:inline-flex">
                Public site
                <ExternalLink aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEmailSettingsOpen(true)}
                aria-label="Email notification settings"
                title="Email notification settings"
              >
                <Mail aria-hidden="true" />
              </Button>
              <ThemeToggle />

              {user && (
                <div className="ml-1 flex items-center gap-2.5 border-l border-line pl-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-sm font-semibold text-fg"
                    aria-hidden="true"
                  >
                    {initial}
                  </span>
                  <div className="hidden min-w-0 flex-col lg:flex">
                    <span className="truncate text-sm font-medium leading-tight text-fg">{user.fullName}</span>
                    <span className="max-w-[160px] truncate text-xs leading-tight text-fg-subtle">
                      {user.university || user.email}
                    </span>
                  </div>
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Log out" title="Log out">
                <LogOut aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="container-page py-6 focus:outline-none sm:py-8">
          {/* Dashboards render their PageHeader as a hero panel. */}
          <PageHeaderVariantContext.Provider value="hero">
            <div className="rise-children">{children}</div>
          </PageHeaderVariantContext.Provider>
        </main>
      </div>

      <footer className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-sm text-fg-subtle sm:flex-row">
          <span>
            HackTrack · Signed in as <span className="text-fg-muted">{user?.role || 'guest'}</span>
          </span>
          <nav aria-label="Dashboard footer" className="flex items-center gap-6">
            <Link to="/hackathons" className="inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-fg sm:min-h-0">Browse hackathons</Link>
            <Link to="/" className="inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-fg sm:min-h-0">Platform home</Link>
          </nav>
        </div>
      </footer>
      <EmailPreferencesDialog open={emailSettingsOpen} onClose={() => setEmailSettingsOpen(false)} />
    </div>
  );
}
