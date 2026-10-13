import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../utils/auth';
import ThemeToggle from './ThemeToggle';
import { Button, Logo, cn } from './ui';

const navItemClass =
  'inline-flex h-8 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-raised hover:text-fg touch:h-10';

export default function NavigationBar({ onOpenTeamModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const currentPath = location.pathname;

  // Close the mobile drawer whenever the route changes.
  const [prevPath, setPrevPath] = useState(currentPath);
  if (prevPath !== currentPath) {
    setPrevPath(currentPath);
    setMobileMenuOpen(false);
  }

  const scrollToSection = (sectionId) => {
    setMobileMenuOpen(false);
    const scroll = () => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    if (currentPath !== '/') {
      navigate('/');
      setTimeout(scroll, 100);
    } else {
      scroll();
    }
  };

  const dashboardPath = user ? getRoleDashboardPath(user.role) : '/login';
  const firstName = user?.fullName?.split(' ')[0] || 'User';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="inline-flex min-h-10 items-center rounded-md" aria-label="HackTrack home">
            <Logo />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            <NavLink
              to="/hackathons"
              className={({ isActive }) => cn(navItemClass, isActive && 'bg-raised text-fg')}
            >
              Hackathons
            </NavLink>
            <button type="button" onClick={() => scrollToSection('how-it-works')} className={navItemClass}>
              How it works
            </button>
            <button type="button" onClick={() => scrollToSection('roles')} className={navItemClass}>
              Roles
            </button>
          </nav>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" size="sm" onClick={onOpenTeamModal}>
            <KeyRound aria-hidden="true" />
            Team code
          </Button>
          <ThemeToggle />
          <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

          {isAuthenticated && user ? (
            <>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
              <Button as={Link} to={dashboardPath} size="sm">
                Dashboard · {firstName}
                <ArrowRight aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button as={Link} to="/register" size="sm">
                Sign up
              </Button>
            </>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <Button variant="ghost" size="icon-sm" onClick={onOpenTeamModal} aria-label="Enter team code">
            <KeyRound aria-hidden="true" />
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-menu" className="border-t border-line bg-surface lg:hidden">
          <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-3">
            <NavLink
              to="/hackathons"
              className={({ isActive }) => cn(navItemClass, 'h-11', isActive && 'bg-raised text-fg')}
            >
              Hackathons
            </NavLink>
            <button type="button" onClick={() => scrollToSection('how-it-works')} className={cn(navItemClass, 'h-11 text-left')}>
              How it works
            </button>
            <button type="button" onClick={() => scrollToSection('roles')} className={cn(navItemClass, 'h-11 text-left')}>
              Roles
            </button>

            <div className="mt-2 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
              {isAuthenticated && user ? (
                <>
                  <Button as={Link} to={dashboardPath} size="lg">
                    Go to dashboard
                    <ArrowRight aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button as={Link} to="/register" size="lg">
                    Sign up
                  </Button>
                  <Button as={Link} to="/login" variant="secondary" size="lg">
                    Log in
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
