import React from 'react';
import { 
  ChevronRight, 
  Terminal, 
  Code2, 
  Users, 
  Trophy, 
  Calendar,
  Clock,
  ArrowRight,
  Search,
  CheckCircle2,
  Shield,
  LayoutDashboard
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="w-full">
      {/* 1. HERO SECTION */}
      <section className="relative min-h-screen flex items-center pt-24 pb-12 overflow-hidden">
        {/* Atmospheric Lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none opacity-50" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] pointer-events-none opacity-50" />

        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Hero Content */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-accent mb-6">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                HackTrack v1.0 is Live
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
                Build. Compete. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Get Recognized.
                </span>
              </h1>
              <p className="text-lg text-white/60 mb-10 leading-relaxed max-w-xl">
                The premium platform for discovering, participating in, managing, and evaluating hackathons. Designed for developers, built for competition.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="btn-primary py-3 px-6 text-base">
                  Explore Hackathons <ArrowRight className="w-4 h-4" />
                </button>
                <button className="btn-glass py-3 px-6 text-base">
                  Host a Hackathon
                </button>
              </div>
            </div>

            {/* Hero Visual Preview */}
            <div className="relative hidden lg:block">
              <div className="glass-panel p-2 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="bg-[#0A0A0F] rounded-xl overflow-hidden border border-white/5">
                  {/* Mock Navbar inside preview */}
                  <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="text-[10px] text-white/40 font-mono">hacktrack.app/dashboard</div>
                    <div className="w-4 h-4" />
                  </div>
                  {/* Mock Dashboard Content */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-sm font-semibold">Active Project: NeuralNet Core</h3>
                        <p className="text-xs text-white/40">Global AI Challenge 2026</p>
                      </div>
                      <div className="px-2 py-1 rounded bg-accent/20 text-accent text-[10px] font-bold border border-accent/20">
                        IN EVALUATION
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">Overall Progress</span>
                        <span className="text-primary">95%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[95%] rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <Code2 className="w-4 h-4 text-white/40 mb-2" />
                        <div className="text-xs text-white/60">Repository</div>
                        <div className="text-sm font-medium">Synced 2m ago</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <Users className="w-4 h-4 text-white/40 mb-2" />
                        <div className="text-xs text-white/60">Team Members</div>
                        <div className="text-sm font-medium">4 Active</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative Floating Element */}
              <div className="absolute -bottom-6 -left-6 glass-panel p-4 flex items-center gap-3 animate-bounce shadow-glass-hover">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-xs font-bold">Submission Verified</div>
                  <div className="text-[10px] text-white/50">Ready for judging</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. HACKATHON PREVIEW (Sample Data) */}
      <section className="py-24 bg-[#05050A] relative" id="browse">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">Featured <span className="text-white/50">Hackathons</span></h2>
              <p className="text-white/60 max-w-xl text-sm">
                Discover curated competitions. (Sample Demo Data)
              </p>
            </div>
            <button className="btn-glass text-sm">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="glass-panel p-6 flex flex-col group cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] group-hover:bg-primary/20 transition-colors" />
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#0A0A0F] border border-white/10 flex items-center justify-center">
                  <Terminal className="w-6 h-6 text-white" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold tracking-wider">
                  REGISTRATION OPEN
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2">Global AI Challenge 2026</h3>
              <p className="text-sm text-white/50 mb-6 flex-grow">Build next-gen artificial intelligence solutions for global impact.</p>
              
              <div className="space-y-3 mb-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Calendar className="w-4 h-4 text-white/40" /> Aug 15 - Aug 17, 2026
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Users className="w-4 h-4 text-white/40" /> Team Size: 1-4
                </div>
              </div>
              
              <button className="w-full btn-glass group-hover:bg-white/10 group-hover:border-white/20 text-white">
                Explore Event
              </button>
            </div>

            {/* Card 2 */}
            <div className="glass-panel p-6 flex flex-col group cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-[50px] group-hover:bg-accent/20 transition-colors" />
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#0A0A0F] border border-white/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold tracking-wider">
                  HAPPENING NOW
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2">CyberSec Defend 4.0</h3>
              <p className="text-sm text-white/50 mb-6 flex-grow">Protect infrastructure and find vulnerabilities in this 48h CTF.</p>
              
              <div className="space-y-3 mb-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Calendar className="w-4 h-4 text-white/40" /> Aug 10 - Aug 12, 2026
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Users className="w-4 h-4 text-white/40" /> Team Size: 2-5
                </div>
              </div>
              
              <button className="w-full py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors">
                View Live Leaderboard
              </button>
            </div>

            {/* Card 3 */}
            <div className="glass-panel p-6 flex flex-col group cursor-pointer relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#0A0A0F] border border-white/10 flex items-center justify-center">
                  <Code2 className="w-6 h-6 text-white" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold tracking-wider">
                  COMPLETED
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-white/60">Web3 Innovators Hub</h3>
              <p className="text-sm text-white/40 mb-6 flex-grow">Decentralized applications and smart contract development.</p>
              
              <div className="space-y-3 mb-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Trophy className="w-4 h-4 text-white/30" /> 120 Teams Participated
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Search className="w-4 h-4 text-white/30" /> Winners Announced
                </div>
              </div>
              
              <button className="w-full btn-glass opacity-50 cursor-default group-hover:bg-white/5">
                View Results
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW HACKTRACK WORKS */}
      <section className="py-24 relative overflow-hidden" id="how-it-works">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent hidden lg:block" />
        
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">The Complete Lifecycle</h2>
            <p className="text-white/60 max-w-2xl mx-auto text-sm">
              From registration to final judging, HackTrack handles the entire competition flow seamlessly.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {[
              { icon: Search, title: "Discover", desc: "Find events that match your skills." },
              { icon: Users, title: "Form Team", desc: "Invite members via secure codes." },
              { icon: Code2, title: "Build & Submit", desc: "Track progress and upload projects." },
              { icon: LayoutDashboard, title: "Evaluation", desc: "Judges review assignments." },
              { icon: Trophy, title: "Results", desc: "Live rankings and certificates." }
            ].map((step, idx) => (
              <div key={idx} className="relative group text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl glass-panel flex items-center justify-center mb-6 relative z-10 group-hover:-translate-y-2 transition-transform duration-300">
                  <step.icon className={`w-6 h-6 ${idx === 4 ? 'text-primary' : 'text-white'}`} />
                </div>
                <h4 className="text-lg font-bold mb-2">{step.title}</h4>
                <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                
                {/* Connecting Arrow for mobile/tablet */}
                {idx < 4 && (
                  <div className="lg:hidden my-6">
                    <ArrowRight className="w-5 h-5 text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ROLE / PLATFORM EXPERIENCE */}
      <section className="py-24 bg-[#0A0A0F] border-y border-white/5 relative">
        <div className="absolute left-0 top-0 w-1/3 h-full bg-primary/5 blur-[100px] pointer-events-none" />
        
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">One Platform. <br/><span className="text-primary text-xl">Tailored Experiences.</span></h2>
          </div>

          <div className="grid md:grid-cols-12 gap-6">
            {/* Participants (Takes up more space) */}
            <div className="md:col-span-8 glass-panel p-8 bg-gradient-to-br from-white/5 to-transparent relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10">
                <Users className="w-64 h-64 -mb-16 -mr-16" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 border border-white/10">
                  <Terminal className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Students & Team Leaders</h3>
                <p className="text-white/60 mb-8 max-w-md">
                  A focused dashboard to manage team joins, track submission status, receive announcements, and view final certificates.
                </p>
                <ul className="space-y-3">
                  {['Secure Team Codes', 'Real-time Status Tracking', 'Unified Profile & Portfolio'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white/70">
                      <CheckCircle2 className="w-4 h-4 text-accent" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Judges */}
            <div className="md:col-span-4 glass-panel p-8 border-l-[3px] border-l-primary flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-6 border border-primary/20">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Judges</h3>
                <p className="text-sm text-white/60 mb-6">
                  Streamlined evaluation interface with assigned projects, scoring rubrics, and history tracking.
                </p>
              </div>
              <button className="text-primary text-sm font-medium flex items-center gap-2 hover:gap-3 transition-all">
                View Judge Flow <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Admin */}
            <div className="md:col-span-12 glass-panel p-8 flex flex-col md:flex-row items-center justify-between gap-8 bg-[#05050A]">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Administrators</h3>
                <p className="text-sm text-white/50 max-w-2xl">
                  Complete control over hackathon configuration, user management, judge assignment, screening workflows, and result generation.
                </p>
              </div>
              <button className="btn-glass whitespace-nowrap">
                Explore Admin Features
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FINAL CTA */}
      <section className="py-32 relative text-center px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Ready to Compete?</h2>
          <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto">
            Join the premium management system designed specifically for competitive hackathons. Register your profile today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="btn-primary py-3 px-8 text-base font-semibold shadow-glass-hover">
              Join HackTrack
            </button>
            <button className="btn-glass py-3 px-8 text-base">
              Explore Active Events
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
