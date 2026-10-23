export const HACKATHONS = [
  {
    id: "devpulse-2026",
    title: "DevPulse National Sprint",
    headline: "Scalable Full-Stack Systems & Resilient Cloud Workflows",
    deadline: "Oct 18, 2026",
    dates: "Oct 18 - Oct 20, 2026",
    stage: "Registration Open",
    category: "Full-Stack",
    track: "Full-Stack & Cloud Systems",
    teamSize: "2 - 4 Members",
    prizePool: "$15,000 USD",
    summary: "Build resilient web applications, distributed APIs, or developer tooling. Strict screening on repository freshness and functional architecture.",
    overview: "DevPulse is our flagship annual system engineering challenge designed to push the boundaries of developer tooling, cloud architecture, and web microservices. Teams will build production-grade web systems under rapid deployment constraints.",
    eligibility: [
      "Open to enrolled university undergraduates and master's candidates.",
      "Cross-college team formations are permitted.",
      "Must have an authentic academic email address or verified student ID."
    ],
    rules: [
      "All code commits must happen within the 48-hour sprint window.",
      "Third-party APIs and open-source libraries are permitted with proper attribution.",
      "Repository must remain public under an MIT or Apache 2.0 license."
    ],
    submissionReqs: [
      "Public GitHub or GitLab repository with an active README and clear setup commands.",
      "Working live deployment link (Vercel, Render, AWS, or Fly.io).",
      "Architecture diagram and a 3-minute video overview demonstrating core functionality."
    ],
    screeningReqs: [
      "Automated git freshness check ensuring no pre-dated private commits before launch.",
      "Verification of working HTTPS deployment endpoints without 5xx errors.",
      "Verification of clean environment variable configuration (.env.example included)."
    ],
    rubrics: [
      { name: "Technical Depth & Architecture", weight: "30%", desc: "Clean code structure, state management, and API design." },
      { name: "Practical Usability & UX", weight: "25%", desc: "Accessibility, load speed, responsive UI, and ease of use." },
      { name: "Innovation & Problem Solving", weight: "25%", desc: "Creativity of the solution and real-world applicability." },
      { name: "Screening & Completeness", weight: "20%", desc: "Test coverage, documentation, and compliance with rules." }
    ],
    tags: ["Open Source", "Cloud", "Developer Tooling", "Web Systems"],
    organizerEmail: "organizer@hacktrack.io",
    organizerName: "Kavita Rao",
    organizerUniversity: "DevPulse Operations Committee"
  },
  {
    id: "ai-catalyst-2026",
    title: "AI Catalyst Challenge",
    headline: "Autonomous Agents, Real-Time Vision & Edge Workflows",
    deadline: "Nov 04, 2026",
    dates: "Nov 04 - Nov 07, 2026",
    stage: "Team Formation",
    category: "AI & ML",
    track: "Applied Machine Learning & Agents",
    teamSize: "2 - 4 Members",
    prizePool: "$20,000 USD",
    summary: "Develop autonomous agent frameworks, computer vision workflows, or LLM-backed productivity software with live API interactions.",
    overview: "The AI Catalyst Challenge brings together developers to solve thorny bottlenecks in autonomous workflows, domain-specific AI copilots, and multi-modal edge intelligence. Teams must demonstrate verifiable model reasoning and ethical safety guardrails.",
    eligibility: [
      "Open to university students, academic research labs, and early developers.",
      "Teams can have up to 4 participants.",
      "Pre-registration requires a brief track statement."
    ],
    rules: [
      "Models may utilize foundation model APIs (OpenAI, Anthropic, Gemini, or open weights).",
      "Fine-tuning datasets must include a transparent provenance and ethics declaration.",
      "No strictly wrapper-based UI without novel prompt chaining or agentic workflows."
    ],
    submissionReqs: [
      "Public GitHub repository with reproduction instructions and inference seeds.",
      "Demonstration video (max 3 minutes) illustrating agent decision loops.",
      "Interactive demo or public test endpoint."
    ],
    screeningReqs: [
      "Ethics statement on training data / API token usage.",
      "Verification of non-trivial logic beyond single-shot prompt calls.",
      "Active endpoint responding within 5-second latency ceilings."
    ],
    rubrics: [
      { name: "Agent Autonomy & Intelligence", weight: "35%", desc: "Robustness of multi-step planning and tool usage." },
      { name: "Novelty & System Utility", weight: "25%", desc: "Uniqueness of solution compared to existing commercial tools." },
      { name: "Execution & Engineering", weight: "25%", desc: "API resilience, error fallbacks, and response latency." },
      { name: "Responsible AI Standards", weight: "15%", desc: "Guardrails, toxicity filtering, and dataset attribution." }
    ],
    tags: ["Autonomous Agents", "Vision", "Edge LLM", "LangChain"],
    organizerEmail: "marcus.ai@hacktrack.io",
    organizerName: "Dr. Marcus Vance",
    organizerUniversity: "AI Catalyst Foundation"
  },
  {
    id: "smart-campus-2026",
    title: "Smart Campus Hack",
    headline: "Connected IoT, Physical Telemetry & Campus Optimization",
    deadline: "Nov 22, 2026",
    dates: "Nov 22 - Nov 24, 2026",
    stage: "Upcoming",
    category: "IoT",
    track: "IoT & Campus Optimization",
    teamSize: "1 - 3 Members",
    prizePool: "$10,000 USD",
    summary: "Create solutions for smart attendance, energy monitoring, lab equipment booking, or student safety across campus infrastructure.",
    overview: "Universities generate massive data streams that remain underutilized. The Smart Campus Hack challenges students to build connected sensors, telemetry dashboards, and real-time alerts that solve pressing facility and student life pain points.",
    eligibility: [
      "Currently enrolled undergraduate or polytechnic engineering students.",
      "At least one team member must represent a verified collegiate engineering department."
    ],
    rules: [
      "Physical microcontroller prototypes (ESP32, Arduino, Raspberry Pi) or verified simulator feeds (Wokwi).",
      "No invasive surveillance or unauthorized network sniffing tools.",
      "Final presentations include a 2-minute live telemetry walkthrough."
    ],
    submissionReqs: [
      "Firmware/software repository with pinout schematic and wiring documentation.",
      "Telemetry dashboard web view or mobile interface.",
      "Recorded proof-of-concept video showing sensor triggers."
    ],
    screeningReqs: [
      "Verified student institution ID check.",
      "Wokwi simulator link or documented hardware component invoice/photos.",
      "Security compliance statement on campus network privacy."
    ],
    rubrics: [
      { name: "Hardware & Telemetry Quality", weight: "35%", desc: "Sensor fidelity, packet transmission, and battery efficiency." },
      { name: "Practical Campus Impact", weight: "30%", desc: "Potential cost savings or tangible benefit to campus operations." },
      { name: "Dashboard & Interface Design", weight: "20%", desc: "Clarity of visualizations and alerting responsiveness." },
      { name: "Viability & Scalability", weight: "15%", desc: "Ease of deployment across multiple buildings." }
    ],
    tags: ["Campus IoT", "Telemetry", "Student Life", "Hardware"],
    organizerEmail: "elena.iot@hacktrack.io",
    organizerName: "Prof. Elena Rostova",
    organizerUniversity: "Campus IoT Consortium"
  },
  {
    id: "hack-shesolves-001",
    title: "She Solves 2026",
    headline: "Empowering Women Technologists & AI Innovators",
    deadline: "Nov 15, 2026",
    dates: "Nov 15 - Nov 18, 2026",
    stage: "Registration Open",
    category: "AI & ML",
    track: "Women in Tech & AI",
    teamSize: "2 - 4 Members",
    prizePool: "$25,000 USD",
    summary: "Premier collegiate hackathon for women developers, engineers and researchers building high-impact tech solutions.",
    overview: "She Solves brings together women technologists from across universities to engineer transformative AI applications, healthcare platforms, and social impact systems.",
    eligibility: [
      "Open to collegiate women engineers, developers, and researchers.",
      "Cross-university teams are welcome.",
      "Valid student or developer verification required."
    ],
    rules: [
      "Projects must be conceived and created during the sprint timeframe.",
      "All major code contributions must be authored by team members.",
      "Open-source packages and frameworks are permitted with clear attribution."
    ],
    submissionReqs: [
      "GitHub repository with clear documentation and setup instructions.",
      "Live deployment or working interactive endpoint.",
      "Video walkthrough demonstration."
    ],
    screeningReqs: [
      "Active HTTPS deployment responding with 200 OK status.",
      "Clean commit logs throughout the sprint timeline.",
      "Configured documentation and architectural overview."
    ],
    rubrics: [
      { name: "Innovation & Impact", weight: "25%", desc: "Novelty, creativity and direct societal impact." },
      { name: "Technical Execution", weight: "25%", desc: "Code quality, technical architecture and robust APIs." },
      { name: "UI / UX Design", weight: "25%", desc: "Design accessibility, visual aesthetics and user experience." },
      { name: "Real-world Feasibility", weight: "25%", desc: "Deployment readiness and scalability." }
    ],
    tags: ["Women in Tech", "AI", "Healthcare", "Social Good"],
    organizerEmail: "organizer@hacktrack.io",
    organizerName: "Kavita Rao",
    organizerUniversity: "PCCOE Pune"
  }
];

export const getHackathonById = (id) => {
  if (!id) return null;
  const clean = String(id).trim().toLowerCase();
  const alpha = clean.replace(/[^a-z0-9]/g, '');
  return HACKATHONS.find((h) => {
    if (h.id === id || h.id.toLowerCase() === clean) return true;
    if (h.id.replace(/[^a-z0-9]/g, '') === alpha) return true;
    const hTitleSlug = h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (hTitleSlug === clean || h.title.toLowerCase() === clean) return true;
    return false;
  }) || null;
};
