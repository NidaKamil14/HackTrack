import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NavigationBar from '../components/NavigationBar';
import Footer from '../components/Footer';
import TeamCodeModal from '../components/TeamCodeModal';

export default function Layout() {
  const location = useLocation();
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamCodeInput, setTeamCodeInput] = useState("HT-DEV-42");

  // Scroll to top on route change matching original behavior
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 flex flex-col justify-between">
      {/* Top Navigation */}
      <div>
        <NavigationBar onOpenTeamModal={() => handleOpenTeamModal()} />

        {/* Dynamic Route Content */}
        <main>
          <Outlet context={{
            onOpenTeamModal: handleOpenTeamModal,
            setTeamCodeInput,
            isTeamModalOpen
          }} />
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
