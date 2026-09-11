import React, { useState, useEffect } from 'react';
import { Terminal, Menu, X } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-[#05050A]/80 backdrop-blur-xl border-b border-white/5 py-4' : 'bg-transparent py-6'
    }`}>
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-glass">
              <Terminal className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">HackTrack</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#browse" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Browse Hackathons</a>
            <a href="#how-it-works" className="text-sm font-medium text-white/70 hover:text-white transition-colors">How It Works</a>
            
            <div className="h-5 w-px bg-white/10 mx-2" />
            
            <button className="text-sm font-medium text-white/70 hover:text-white transition-colors">Login</button>
            <button className="btn-primary">
              Join HackTrack
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-white/70 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#0A0A0F] border-b border-white/5 p-6 flex flex-col gap-4 shadow-glass">
            <a href="#browse" className="text-sm font-medium text-white/70 hover:text-white py-2">Browse Hackathons</a>
            <a href="#how-it-works" className="text-sm font-medium text-white/70 hover:text-white py-2">How It Works</a>
            <div className="h-px w-full bg-white/10 my-2" />
            <button className="text-sm font-medium text-white/70 hover:text-white py-2 text-left">Login</button>
            <button className="btn-primary w-full justify-center mt-2">
              Join HackTrack
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
