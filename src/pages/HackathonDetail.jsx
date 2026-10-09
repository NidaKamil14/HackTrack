import React, { useState } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { getHackathonById, getStoredHackathons } from '../utils/hackathonService';
import { useAuth } from '../context/AuthContext';
import { isUserRegistered, registerForHackathon } from '../utils/registrationService';

export default function HackathonDetail({
  hackathonId: propHackathonId,
  onOpenTeamModal: propOpenTeamModal,
  setTeamCodeInput: propSetTeamCodeInput
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const outletContext = useOutletContext() || {};
  const onOpenTeamModal = propOpenTeamModal || outletContext.onOpenTeamModal || (() => {});
  const setTeamCodeInput = propSetTeamCodeInput || outletContext.setTeamCodeInput || (() => {});

  const currentId = propHackathonId || id;
  const hackathon = getHackathonById(currentId) || getStoredHackathons()[0];
  const [activeTab, setActiveTab] = useState("overview");

  // Registration state
  const [registeredOverride, setRegisteredOverride] = useState(null);
  const [regFeedback, setRegFeedback] = useState(null);

  const isRegistered = registeredOverride !== null
    ? registeredOverride
    : (user?.email && hackathon?.id ? isUserRegistered(user.email, hackathon.id) : false);

  const handleRegisterClick = () => {
    // 1. If not authenticated, redirect to login and preserve target
    if (!isAuthenticated || !user) {
      navigate('/login', {
        state: {
          from: location,
          registerHackathonId: hackathon.id
        }
      });
      return;
    }

    // 2. Already registered
    if (isRegistered) {
      navigate('/dashboard/student');
      return;
    }

    // 3. Register user
    const res = registerForHackathon(user.email, hackathon.id);
    if (res.success) {
      setRegisteredOverride(true);
      setRegFeedback({
        type: "success",
        text: `✓ Successfully registered for ${hackathon.title}! You can now create or join a team for this competition.`
      });
    } else {
      setRegFeedback({
        type: "info",
        text: res.error || "Registration completed."
      });
      if (res.alreadyRegistered) {
        setRegisteredOverride(true);
      }
    }
  };

  return (
    <div className="py-12">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Breadcrumb Back Button */}
        <button
          onClick={() => navigate('/hackathons')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6"
        >
          <Icons.ArrowLeft />
          <span>Back to Sprint Directory</span>
        </button>

        {/* Hackathon Header Banner */}
        <div className="p-6 md:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl mb-8">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
              {hackathon.stage}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
              Track: {hackathon.track}
            </span>
            {isRegistered && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold font-mono">
                ✓ REGISTERED
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            {hackathon.title}
          </h1>
          <p className="text-slate-400 text-sm md:text-base mt-2 max-w-3xl leading-relaxed">
            {hackathon.headline}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block">Registration Closes</span>
              <span className="text-white font-mono font-medium mt-0.5 block">{hackathon.deadline}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Competition Window</span>
              <span className="text-white font-mono font-medium mt-0.5 block">{hackathon.dates}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Team Requirement</span>
              <span className="text-white font-mono font-medium mt-0.5 block">{hackathon.teamSize}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Prize Pool Value</span>
              <span className="text-amber-400 font-mono font-semibold mt-0.5 block">{hackathon.prizePool}</span>
            </div>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("overview")}
                className={`pb-3 transition-colors ${
                  activeTab === "overview"
                    ? "border-b-2 border-emerald-400 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Overview & Theme
              </button>
              <button
                onClick={() => setActiveTab("rules")}
                className={`pb-3 transition-colors ${
                  activeTab === "rules"
                    ? "border-b-2 border-emerald-400 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Rules & Eligibility
              </button>
              <button
                onClick={() => setActiveTab("screening")}
                className={`pb-3 transition-colors ${
                  activeTab === "screening"
                    ? "border-b-2 border-emerald-400 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Screening & Judging
              </button>
            </div>

            {/* Tab 1: Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white mb-2">Challenge Overview</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {hackathon.overview}
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white mb-3">Submission Deliverables</h3>
                  <ul className="space-y-2.5">
                    {hackathon.submissionReqs.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <Icons.Check />
                        <span className="leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Notice for Team Leaders</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Only registered Team Leaders can freeze the roster and submit the repository URL before the lock window closes.
                    All team members must be enrolled in the HackTrack system before the deadline.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Rules & Eligibility */}
            {activeTab === "rules" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white mb-3">Participant Eligibility</h3>
                  <ul className="space-y-2">
                    {hackathon.eligibility.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white mb-3">Sprint Competition Rules</h3>
                  <ul className="space-y-2">
                    {hackathon.rules.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 3: Screening & Rubrics */}
            {activeTab === "screening" && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.ShieldCheck />
                    <h3 className="text-base font-bold text-white">Screening Committee Verification Gate</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    Before any submission reaches the judges, our Screening Committee evaluates projects for compliance.
                  </p>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    {hackathon.screeningReqs.map((req, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-emerald-400 font-mono text-[11px]">[GATE {i + 1}]</span>
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Icons.Award />
                    <h3 className="text-base font-bold text-white">Judge Evaluation Rubric</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hackathon.rubrics.map((rubric, i) => (
                      <div key={i} className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-white">{rubric.name}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/20">
                            {rubric.weight}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal">{rubric.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Sticky Action Sidebar */}
          <div className="space-y-5">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl sticky top-20 shadow-lg">
              <span className="text-[10px] font-mono text-emerald-400 block mb-1">REGISTRATION DESK</span>
              <h3 className="text-base font-bold text-white mb-2">Join this Competition</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Register as a participant to form a squad or join an active roster with a team code.
              </p>

              {regFeedback && (
                <div className={`p-3 rounded-lg text-xs mb-3.5 ${
                  regFeedback.type === "success"
                    ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300"
                    : "bg-amber-950/60 border border-amber-500/40 text-amber-300"
                }`}>
                  {regFeedback.text}
                </div>
              )}

              <div className="space-y-2.5">
                {isRegistered ? (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs text-center font-medium">
                      ✓ You are registered for this sprint!
                    </div>
                    <button
                      onClick={() => navigate('/dashboard/student')}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors text-center"
                    >
                      Go to Student Dashboard →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleRegisterClick}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors text-center"
                  >
                    {isAuthenticated ? "Register for Hackathon" : "Sign In & Register"}
                  </button>
                )}

                <button
                  onClick={() => {
                    const code = hackathon.id === "devpulse-2026" ? "HT-DEV-42" : "HT-AI-99";
                    setTeamCodeInput(code);
                    onOpenTeamModal(code);
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icons.Key />
                  <span>Join with Team Code</span>
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex justify-between">
                  <span>Registration Status:</span>
                  <span className="text-emerald-400 font-semibold">{hackathon.stage}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deadline:</span>
                  <span className="text-slate-300 font-mono">{hackathon.deadline}</span>
                </div>
                <div className="flex justify-between">
                  <span>Allowed Members:</span>
                  <span className="text-slate-300">{hackathon.teamSize}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
