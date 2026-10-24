import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, ExternalLink, LogOut, Mail, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ThemeToggle';
import EmailPreferencesDialog from '../notifications/EmailPreferencesDialog';
import NotificationCenterDialog from '../notifications/NotificationCenterDialog';
import { getUnreadNotificationCount } from '../../utils/notificationService';
import { AppBackdrop, Badge, Button, Logo, PageHeaderVariantContext } from '../ui';

export default function DashboardLayout({
  portalTitle,
  roleBadgeText,
  children
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => (user ? getUnreadNotificationCount(user) : 0));
  const [loginToast, setLoginToast] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoginToast(null);
      return;
    }
    const count = getUnreadNotificationCount(user);

    // Brief unread notification toast after login (approx 3s, only once per session)
    const sessionKey = `ht_login_toast_${user.id || user.email}`;
    if (count > 0 && !sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, 'shown');
      setLoginToast({ count });
      const timer = setTimeout(() => {
        setLoginToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    const handleUpdate = () => {
      if (user) setUnreadCount(getUnreadNotificationCount(user));
    };
    window.addEventListener('hacktrack_notifications_updated', handleUpdate);
    return () => window.removeEventListener('hacktrack_notifications_updated', handleUpdate);
  }, [user]);

  const handleLogout = () => {
    if (user) {
      sessionStorage.removeItem(`ht_login_toast_${user.id || user.email}`);
    }
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
          <div className="container-page flex h-16 items-center justify-between gap-3 sm:h-16">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/" className="inline-flex min-h-10 items-center rounded-md" aria-label="HackTrack home">
                <Logo />
              </Link>
              <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
              <Badge tone="accent" className="hidden sm:inline-flex">
                {roleBadgeText || portalTitle}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <Button as={Link} to="/" variant="ghost" size="sm" className="hidden md:inline-flex">
                Public site
                <ExternalLink aria-hidden="true" />
              </Button>
              <button
                type="button"
                onClick={() => setNotifCenterOpen(true)}
                aria-label={`Notification center${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                title="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg shadow-sm ring-2 ring-canvas pointer-events-none"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setEmailSettingsOpen(true)}
                aria-label="Email notification settings"
                title="Email notification settings"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </button>
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
      <NotificationCenterDialog open={notifCenterOpen} onClose={() => setNotifCenterOpen(false)} user={user} />

      {/* Brief unread-notification toast after login */}
      {loginToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-accent/40 bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out text-fg animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 pr-2">
            <p className="text-sm font-semibold text-fg">
              {loginToast.count} new notification{loginToast.count === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-fg-muted">
              Tap the bell in the top bar to review updates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoginToast(null)}
            className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
            aria-label="Dismiss toast"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </aside>
      )}
    </div>
  );
}
