import React from 'react';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30 selection:text-white">
      <Navbar />
      <main className="flex-grow">
        <LandingPage />
      </main>
      <Footer />
    </div>
  );
}

export default App;
