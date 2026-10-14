import React, { Suspense, useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NavigationBar from '../components/NavigationBar';
import Footer from '../components/Footer';
import TeamCodeModal from '../components/TeamCodeModal';
import RouteFallback from '../components/RouteFallback';
import { AppBackdrop } from '../components/ui';

export default function Layout() {
  const location = useLocation();
  // Each page type gets its own coordinated background treatment.
  const backdropVariant =
    location.pathname === '/' ? 'landing'
      : ['/login', '/register'].includes(location.pathname) ? 'auth'
      : 'discover';
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamCodeInput, setTeamCodeInput] = useState("HT-DEV-42");

  // Scroll to top on route change matching original behavior
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [location.pathname]);

  const handleOpenTeamModal = (code) => {
    if (typeof code === 'string' && code.trim()) {
      setTeamCodeInput(code.trim().toUpperCase());
    }
    setIsTeamModalOpen(true);
  };

  const handleCloseTeamModal = () => {
    setIsTeamModalOpen(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between text-fg">
      <AppBackdrop variant={backdropVariant} />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg">
        Skip to main content
      </a>
      {/* Top Navigation */}
      <div>
        <NavigationBar onOpenTeamModal={() => handleOpenTeamModal()} />

        {/* Dynamic Route Content */}
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <Suspense fallback={<RouteFallback />}>
            <Outlet context={{
              onOpenTeamModal: handleOpenTeamModal,
              setTeamCodeInput,
              isTeamModalOpen
            }} />
          </Suspense>
        </main>
      </div>

      {/* Global Team Code Modal */}
      <TeamCodeModal
        isOpen={isTeamModalOpen}
        onClose={handleCloseTeamModal}
        initialCode={teamCodeInput}
      />

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
