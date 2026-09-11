import React from 'react';
import { Terminal, Github, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-[#05050A] pt-16 pb-8 mt-24">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                <Terminal className="w-4 h-4 text-accent" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">HackTrack</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              The premium platform for discovering, managing, and evaluating hackathons globally.
            </p>
            <div className="flex items-center gap-4 text-white/40">
              <a href="#" className="hover:text-primary transition-colors"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="hover:text-primary transition-colors"><Github className="w-5 h-5" /></a>
              <a href="#" className="hover:text-primary transition-colors"><Linkedin className="w-5 h-5" /></a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wide">Platform</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Browse Hackathons</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Host an Event</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wide">Resources</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Guides</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">API</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wide">Account</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Login</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Register</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Student Profile</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Organizer Dashboard</a></li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} HackTrack. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
