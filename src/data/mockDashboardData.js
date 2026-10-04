export const MOCK_STUDENT_DATA = {
  activeHackathons: [
    {
      id: "devpulse-2026",
      title: "DevPulse National Sprint",
      track: "Full-Stack & Cloud Systems",
      status: "Registration Verified",
      deadline: "Oct 18, 2026",
      dates: "Oct 18 - Oct 20, 2026",
      stage: "Registration Open",
      teamName: "AsyncCoders",
      teamCode: "HT-DEV-42",
      role: "Team Leader"
    }
  ],
  team: {
    name: "AsyncCoders",
    code: "HT-DEV-42",
    hackathonId: "devpulse-2026",
    hackathonTitle: "DevPulse National Sprint",
    track: "Full-Stack & Cloud Systems",
    lead: "Alex Chen",
    capacity: "3 / 4 Members",
    isOpen: true,
    rosterLocked: false,
    members: [
      { name: "Alex Chen", role: "Team Leader", email: "alex@university.edu", status: "Active" },
      { name: "Priya Sharma", role: "Full-Stack Dev", email: "priya@university.edu", status: "Active" },
      { name: "David Kim", role: "Cloud / DevOps", email: "david@university.edu", status: "Active" }
    ]
  },
  submission: {
    repoUrl: "https://github.com/alexchen/devpulse-resilient-queue",
    demoUrl: "https://devpulse-queue.vercel.app",
    pitch: "Distributed event-driven queue with automated circuit breakers and real-time telemetry dashboard.",
    status: "Draft",
    isLocked: false,
    lastSaved: "Today at 10:45 AM"
  },
  deadlines: [
    { label: "Team Roster Lock Window", time: "Oct 18, 2026 • 18:00 UTC", urgency: "high" },
    { label: "Sprint Kickoff & Repo Push", time: "Oct 18, 2026 • 20:00 UTC", urgency: "normal" },
    { label: "Final Code Freeze & Demo Link", time: "Oct 20, 2026 • 20:00 UTC", urgency: "critical" },
    { label: "Screening Gate Clearance", time: "Oct 21, 2026 • 12:00 UTC", urgency: "normal" }
  ]
};

export const MOCK_SCREENING_SUBMISSIONS = [
  {
    id: "sub-01",
    teamName: "AsyncCoders",
    hackathonTitle: "DevPulse National Sprint",
    hackathonId: "devpulse-2026",
    track: "Full-Stack & Cloud Systems",
    lead: "Alex Chen",
    repoUrl: "https://github.com/alexchen/devpulse-resilient-queue",
    demoUrl: "https://devpulse-queue.vercel.app",
    status: "Pending Review",
    checks: {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: []
  },
  {
    id: "sub-02",
    teamName: "NeuralShift",
    hackathonTitle: "AI Catalyst Challenge",
    hackathonId: "ai-catalyst-2026",
    track: "Applied Machine Learning & Agents",
    lead: "Sarah Jenkins",
    repoUrl: "https://github.com/neuralshift/agent-framework",
    demoUrl: "https://neuralshift.ai/demo",
    status: "Shortlisted",
    checks: {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: []
  },
  {
    id: "sub-03",
    teamName: "CloudScale Systems",
    hackathonTitle: "DevPulse National Sprint",
    hackathonId: "devpulse-2026",
    track: "Full-Stack & Cloud Systems",
    lead: "Ryan Cooper",
    repoUrl: "https://github.com/rcooper/cloudscale",
    demoUrl: "https://cloudscale-staging.net",
    status: "Rejected",
    checks: {
      gitFreshness: false,
      endpointsLive: true,
      envConfigured: false,
      licenseMIT: true
    },
    flags: ["Pre-dated private commits before kickoff window", "Missing .env.example documentation"]
  },
  {
    id: "sub-04",
    teamName: "VisionPulse",
    hackathonTitle: "AI Catalyst Challenge",
    hackathonId: "ai-catalyst-2026",
    track: "Applied Machine Learning & Agents",
    lead: "Li Wei",
    repoUrl: "https://github.com/liwei/visionpulse",
    demoUrl: "https://visionpulse.app",
    status: "Under Review",
    checks: {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: []
  },
  {
    id: "sub-05",
    teamName: "IoT Telemetry Squad",
    hackathonTitle: "Smart Campus Hack",
    hackathonId: "smart-campus-2026",
    track: "IoT & Campus Optimization",
    lead: "Fatima Al-Mansoor",
    repoUrl: "https://github.com/fatima-iot/campus-telemetry",
    demoUrl: "https://wokwi.com/projects/campus-sim-381",
    status: "Shortlisted",
    checks: {
      gitFreshness: true,
      endpointsLive: true,
      envConfigured: true,
      licenseMIT: true
    },
    flags: []
  }
];

export const MOCK_JUDGE_DATA = {
  assignedHackathons: [
    {
      id: "devpulse-2026",
      title: "DevPulse National Sprint",
      track: "Full-Stack & Cloud Systems",
      totalTeams: 12,
      evaluated: 7
    },
    {
      id: "ai-catalyst-2026",
      title: "AI Catalyst Challenge",
      track: "Applied Machine Learning & Agents",
      totalTeams: 8,
      evaluated: 2
    }
  ],
  shortlistedTeams: [
    {
      id: "judge-team-01",
      name: "AsyncCoders",
      hackathon: "DevPulse National Sprint",
      track: "Full-Stack & Cloud Systems",
      repo: "https://github.com/alexchen/devpulse-resilient-queue",
      demo: "https://devpulse-queue.vercel.app",
      status: "Pending Evaluation",
      screeningScore: "Screening Gate Cleared [4/4]",
      scores: {
        architecture: 0,
        usability: 0,
        innovation: 0,
        completeness: 0
      },
      feedback: ""
    },
    {
      id: "judge-team-02",
      name: "NeuralShift",
      hackathon: "AI Catalyst Challenge",
      track: "Applied Machine Learning & Agents",
      repo: "https://github.com/neuralshift/agent-framework",
      demo: "https://neuralshift.ai/demo",
      status: "Evaluated",
      screeningScore: "Screening Gate Cleared [4/4]",
      scores: {
        architecture: 28,
        usability: 24,
        innovation: 25,
        completeness: 18
      },
      feedback: "Exceptional agent tool orchestration with reliable fallback mechanisms. Very clean API design."
    },
    {
      id: "judge-team-03",
      name: "IoT Telemetry Squad",
      hackathon: "Smart Campus Hack",
      track: "IoT & Campus Optimization",
      repo: "https://github.com/fatima-iot/campus-telemetry",
      demo: "https://wokwi.com/projects/campus-sim-381",
      status: "Pending Evaluation",
      screeningScore: "Screening Gate Cleared [4/4]",
      scores: {
        architecture: 0,
        usability: 0,
        innovation: 0,
        completeness: 0
      },
      feedback: ""
    }
  ],
  rubrics: [
    { key: "architecture", name: "Technical Depth & Architecture", max: 30, weight: "30%" },
    { key: "usability", name: "Practical Usability & UX", max: 25, weight: "25%" },
    { key: "innovation", name: "Innovation & Problem Solving", max: 25, weight: "25%" },
    { key: "completeness", name: "Screening & Completeness", max: 20, weight: "20%" }
  ]
};

export const MOCK_ADMIN_DATA = {
  stats: {
    activeSprints: 3,
    registeredUsers: 428,
    teamsFormed: 112,
    screeningClearanceRate: "84.2%",
    certifiedJudged: 46
  },
  hackathons: [
    {
      id: "devpulse-2026",
      title: "DevPulse National Sprint",
      track: "Full-Stack & Cloud Systems",
      stage: "Registration Open",
      teams: 46,
      deadline: "Oct 18, 2026",
      prize: "$15,000 USD"
    },
    {
      id: "ai-catalyst-2026",
      title: "AI Catalyst Challenge",
      track: "Applied Machine Learning & Agents",
      stage: "Team Formation",
      teams: 38,
      deadline: "Nov 04, 2026",
      prize: "$20,000 USD"
    },
    {
      id: "smart-campus-2026",
      title: "Smart Campus Hack",
      track: "IoT & Campus Optimization",
      stage: "Upcoming",
      teams: 28,
      deadline: "Nov 22, 2026",
      prize: "$10,000 USD"
    }
  ],
  recentUsers: [
    { name: "Alex Chen", email: "alex@university.edu", role: "Student / Team Leader", org: "Stanford University", date: "Oct 04, 2026" },
    { name: "Dr. Marcus Vance", email: "screening@hacktrack.io", role: "Screening Committee", org: "Review Board", date: "Oct 03, 2026" },
    { name: "Prof. Elena Rostova", email: "judge@hacktrack.io", role: "Judge", org: "ACM Expert Panel", date: "Oct 02, 2026" },
    { name: "Sarah Jenkins (Admin)", email: "admin@hacktrack.io", role: "Admin", org: "HackTrack Central HQ", date: "Sep 28, 2026" },
    { name: "Maya Lin", email: "maya@stanford.edu", role: "Student", org: "Stanford University", date: "Oct 04, 2026" }
  ]
};
