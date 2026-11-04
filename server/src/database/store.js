import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, testConnection } from '../config/db.js';

function toSqlDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

const isTestMode = () => Boolean(process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === 'test');

// Public shape of a user: never includes credentials or reset state.
export function toSafeUser(user) {
  if (!user) return user;
  const { passwordHash: _h, password: _p, password_hash: _ph, resetToken: _rt, reset_token: _rt2, resetTokenExpiry: _re, ...safe } = user;
  return safe;
}

function asyncDbWrite(queryFn) {
  if (isTestMode()) return Promise.resolve();
  try {
    const p = queryFn();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('MySQL async write error:', err.message));
    }
    return p;
  } catch (err) {
    console.warn('MySQL async write error:', err.message);
    return Promise.resolve();
  }
}

// Default Demo Users matching SRS and frontend seeds
const RAW_DEMO_USERS = [
  {
    id: 'usr-leader-nida',
    email: 'nida@university.edu',
    password: 'password123',
    fullName: 'Nida',
    role: 'leader',
    roleCategory: 'Team Leader',
    university: 'PCCOE Pune',
    memberId: 'LEAD-99214',
    isActive: true,
  },
  {
    id: 'usr-leader-001',
    email: 'alex@university.edu',
    password: 'password123',
    fullName: 'Alex Chen',
    role: 'leader',
    roleCategory: 'Team Leader',
    university: 'Stanford University',
    memberId: 'LEAD-88219',
    isActive: true,
  },
  {
    id: 'usr-student-002',
    email: 'priya@university.edu',
    password: 'password123',
    fullName: 'Priya Sharma',
    role: 'student',
    roleCategory: 'Student / Participant',
    university: 'Stanford University',
    memberId: 'STU-55412',
    isActive: true,
  },
  {
    id: 'usr-student-003',
    email: 'rohit@university.edu',
    password: 'password123',
    fullName: 'Rohit Kulkarni',
    role: 'student',
    roleCategory: 'Student / Participant',
    university: 'PCCOE Pune',
    memberId: 'STU-12401',
    isActive: true,
  },
  {
    id: 'usr-screening-004',
    email: 'screening@hacktrack.io',
    password: 'password123',
    fullName: 'Dr. Marcus Vance',
    role: 'screening',
    roleCategory: 'Screening Committee',
    university: 'Engineering Review Board',
    memberId: 'SC-904',
    isActive: true,
  },
  {
    id: 'usr-judge-005',
    email: 'judge@hacktrack.io',
    password: 'password123',
    fullName: 'Prof. Elena Rostova',
    role: 'judge',
    roleCategory: 'Judge / Evaluator',
    university: 'ACM Expert Panel',
    memberId: 'JDG-331',
    isActive: true,
  },
  {
    id: 'usr-admin-006',
    email: 'admin@hacktrack.io',
    password: 'password123',
    fullName: 'Sarah Jenkins (Admin)',
    role: 'admin',
    roleCategory: 'Platform Administrator',
    university: 'HackTrack Central HQ',
    memberId: 'ADM-001',
    isActive: true,
  },
  {
    id: 'usr-organizer-007',
    email: 'organizer@hacktrack.io',
    password: 'password123',
    fullName: 'Kavita Rao',
    role: 'organizer',
    roleCategory: 'Hackathon Organizer',
    university: 'DevPulse Operations Committee',
    memberId: 'ORG-102',
    isActive: true,
  },
  {
    id: 'usr-organizer-008',
    email: 'marcus.ai@hacktrack.io',
    password: 'password123',
    fullName: 'Dr. Marcus Vance (Organizer)',
    role: 'organizer',
    roleCategory: 'Hackathon Organizer',
    university: 'AI Catalyst Foundation',
    memberId: 'ORG-201',
    isActive: true,
  },
  {
    id: 'usr-mentor-008',
    email: 'mentor@hacktrack.io',
    password: 'password123',
    fullName: 'David Sterling',
    role: 'mentor',
    roleCategory: 'Technical Mentor',
    university: 'Cloud Architecture Guild',
    memberId: 'MTR-404',
    isActive: true,
  },
];

// Initial Hackathons
const INITIAL_HACKATHONS = [
  {
    id: 'hack-001',
    title: 'CodeSprint Global 2026',
    tagLine: 'Build high-impact solutions in AI, Climate, & Decentralized Systems',
    description: 'Annual global hackathon bringing over 1,000 developers and designers together to solve pressing global challenges.',
    status: 'published',
    minTeamSize: 2,
    maxTeamSize: 4,
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    registrationDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
    submissionDeadline: new Date(Date.now() + 4 * 86400000).toISOString(),
    evaluationDeadline: new Date(Date.now() + 6 * 86400000).toISOString(),
    hasScreeningRound: true,
    screeningRoundsCount: 1,
    hasMentorship: true,
    evaluationWorkflow: 'screening_first',
    resultsPublished: false,
    resultsPublishedAt: null,
    createdBy: 'usr-organizer-007',
    criteria: [
      { id: 'crit-101', name: 'Innovation & Novelty', maxScore: 25, weightage: 1.0, description: 'Originality and creativity of the proposed solution.' },
      { id: 'crit-102', name: 'Technical Execution', maxScore: 25, weightage: 1.0, description: 'Architectural soundess, code quality, and technical completeness.' },
      { id: 'crit-103', name: 'UI / UX Design', maxScore: 25, weightage: 1.0, description: 'User interface elegance, usability, and accessibility.' },
      { id: 'crit-104', name: 'Real-world Feasibility', maxScore: 25, weightage: 1.0, description: 'Scalability, business or social viability, and practical impact.' },
    ],
  },
  {
    id: 'hack-002',
    title: 'PCCOE InnovateX 2026',
    tagLine: 'Inter-College Engineering Innovation Challenge',
    description: 'Premier collegiate hackathon organized by PCCOE focusing on sustainable tech, IoT, and NextGen computing.',
    status: 'published',
    minTeamSize: 1,
    maxTeamSize: 4,
    startDate: new Date(Date.now() - 10 * 86400000).toISOString(),
    endDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    registrationDeadline: new Date(Date.now() - 8 * 86400000).toISOString(),
    submissionDeadline: new Date(Date.now() - 4 * 86400000).toISOString(),
    evaluationDeadline: new Date(Date.now() - 3 * 86400000).toISOString(),
    hasScreeningRound: false,
    screeningRoundsCount: 0,
    hasMentorship: false,
    evaluationWorkflow: 'direct_judging',
    resultsPublished: true,
    resultsPublishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdBy: 'usr-organizer-007',
    criteria: [
      { id: 'crit-201', name: 'Problem Impact', maxScore: 30, weightage: 1.0, description: 'Significance of problem addressed.' },
      { id: 'crit-202', name: 'Implementation', maxScore: 40, weightage: 1.0, description: 'Working prototype and code structure.' },
      { id: 'crit-203', name: 'Presentation & Demo', maxScore: 30, weightage: 1.0, description: 'Clarity of presentation and live demonstration.' },
    ],
  },
  {
    id: 'hack-shesolves-001',
    title: 'She Solves 2026',
    tagLine: 'Empowering Women Technologists & AI Innovators',
    description: 'Premier collegiate hackathon for women developers, engineers and researchers building high-impact tech solutions.',
    status: 'published',
    minTeamSize: 2,
    maxTeamSize: 4,
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    registrationDeadline: new Date(Date.now() + 1 * 86400000).toISOString(),
    submissionDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
    evaluationDeadline: new Date(Date.now() + 3 * 86400000).toISOString(),
    hasScreeningRound: true,
    screeningRoundsCount: 1,
    hasMentorship: true,
    evaluationWorkflow: 'screening_first',
    resultsPublished: false,
    resultsPublishedAt: null,
    createdBy: 'usr-organizer-008',
    criteria: [
      { id: 'crit-ss-101', name: 'Innovation & Impact', maxScore: 25, weightage: 1.0, description: 'Novelty, creativity and direct societal impact.' },
      { id: 'crit-ss-102', name: 'Technical Execution', maxScore: 25, weightage: 1.0, description: 'Code quality, technical architecture and robust APIs.' },
      { id: 'crit-ss-103', name: 'UI / UX Design', maxScore: 25, weightage: 1.0, description: 'Design accessibility, visual aesthetics and user experience.' },
      { id: 'crit-ss-104', name: 'Real-world Feasibility', maxScore: 25, weightage: 1.0, description: 'Deployment readiness and scalability.' },
    ],
  },
];

// Initial Teams
const INITIAL_TEAMS = [
  {
    id: 'team-001',
    hackathonId: 'hack-001',
    leaderId: 'usr-leader-001',
    teamName: 'CyberPulse Vanguard',
    teamCode: 'HT-CPV881',
    track: 'AI & Machine Learning',
    status: 'active',
    screeningStatus: 'shortlisted',
    mentorId: 'usr-mentor-008',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'team-002',
    hackathonId: 'hack-002',
    leaderId: 'usr-leader-001',
    teamName: 'Apex Quantum',
    teamCode: 'HT-APX202',
    track: 'IoT & Smart Cities',
    status: 'active',
    screeningStatus: 'shortlisted',
    mentorId: null,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'team-coders-001',
    hackathonId: 'hack-shesolves-001',
    leaderId: 'usr-leader-nida',
    teamName: 'The Coders',
    teamCode: 'HT-CODERS',
    track: 'Women in Tech & AI',
    status: 'active',
    screeningStatus: 'shortlisted',
    mentorId: 'usr-mentor-008',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

// Initial Members
const INITIAL_TEAM_MEMBERS = [
  {
    id: 'tm-001',
    teamId: 'team-001',
    hackathonId: 'hack-001',
    userId: 'usr-leader-001',
    role: 'leader',
    status: 'accepted',
    requestedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    reviewedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'tm-002',
    teamId: 'team-001',
    hackathonId: 'hack-001',
    userId: 'usr-student-002',
    role: 'member',
    status: 'accepted',
    requestedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    reviewedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'tm-003',
    teamId: 'team-002',
    hackathonId: 'hack-002',
    userId: 'usr-leader-001',
    role: 'leader',
    status: 'accepted',
    requestedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    reviewedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'tm-coders-001',
    teamId: 'team-coders-001',
    hackathonId: 'hack-shesolves-001',
    userId: 'usr-leader-nida',
    role: 'leader',
    status: 'accepted',
    requestedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    reviewedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'tm-coders-002',
    teamId: 'team-coders-001',
    hackathonId: 'hack-shesolves-001',
    userId: 'usr-student-002',
    role: 'member',
    status: 'accepted',
    requestedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    reviewedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

// Initial Submissions
const INITIAL_SUBMISSIONS = [
  {
    id: 'sub-001',
    hackathonId: 'hack-001',
    teamId: 'team-001',
    submittedBy: 'usr-leader-001',
    projectTitle: 'NeuroMesh: Decentralized Edge Inference Engine',
    abstract: 'An ultra-low latency peer-to-peer compute grid allowing client edge devices to collaboratively run transformer models without centralized cloud servers.',
    track: 'AI & Machine Learning',
    repoUrl: 'https://github.com/neuromesh-ai/edge-core',
    demoUrl: 'https://neuromesh-preview.app',
    presentationUrl: 'https://docs.neuromesh-ai.org/deck.pdf',
    fileUrl: null,
    isLocked: false,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'sub-002',
    hackathonId: 'hack-002',
    teamId: 'team-002',
    submittedBy: 'usr-leader-001',
    projectTitle: 'SmartGrid Sensor Fabric',
    abstract: 'LoRaWAN IoT network telemetry collector with anomaly detection for urban microgrids.',
    track: 'IoT & Smart Cities',
    repoUrl: 'https://github.com/apex-quantum/smartgrid',
    demoUrl: 'https://smartgrid-preview.app',
    presentationUrl: 'https://apex-quantum.io/slides.pdf',
    fileUrl: null,
    isLocked: true,
    submittedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'sub-herbuddy-001',
    hackathonId: 'hack-shesolves-001',
    teamId: 'team-coders-001',
    submittedBy: 'usr-leader-nida',
    projectTitle: 'HerBuddy',
    abstract: 'An intelligent safety, wellness, and mentorship companion platform designed for collegiate women in STEM with automated emergency beaconing and decentralized support circles.',
    track: 'Women in Tech & AI',
    repoUrl: 'https://github.com/nidakamil/herbuddy',
    demoUrl: 'https://herbuddy-demo.vercel.app',
    presentationUrl: 'https://docs.herbuddy.app/deck.pdf',
    fileUrl: null,
    isLocked: true,
    submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// Initial Judge Assignments
const INITIAL_JUDGE_ASSIGNMENTS = [
  {
    id: 'ja-001',
    hackathonId: 'hack-001',
    judgeId: 'usr-judge-005',
    submissionId: 'sub-001',
    assignedAt: new Date().toISOString(),
  },
  {
    id: 'ja-002',
    hackathonId: 'hack-002',
    judgeId: 'usr-judge-005',
    submissionId: 'sub-002',
    assignedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'ja-ss-001',
    hackathonId: 'hack-shesolves-001',
    judgeId: 'usr-judge-005',
    submissionId: 'sub-herbuddy-001',
    assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// Initial Evaluations (Score sums up to exactly 83.00 for HerBuddy)
const INITIAL_EVALUATIONS = [
  {
    id: 'eval-001',
    hackathonId: 'hack-002',
    submissionId: 'sub-002',
    judgeId: 'usr-judge-005',
    criterionId: 'crit-201',
    score: 28,
    remarks: 'Clear real-world societal impact on renewable microgrids.',
    isLocked: true,
    submittedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'eval-002',
    hackathonId: 'hack-002',
    submissionId: 'sub-002',
    judgeId: 'usr-judge-005',
    criterionId: 'crit-202',
    score: 38,
    remarks: 'Excellent firmware and backend ingestion architecture.',
    isLocked: true,
    submittedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'eval-003',
    hackathonId: 'hack-002',
    submissionId: 'sub-002',
    judgeId: 'usr-judge-005',
    criterionId: 'crit-203',
    score: 28,
    remarks: 'Crisp presentation and working hardware simulation.',
    isLocked: true,
    submittedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'eval-ss-001',
    hackathonId: 'hack-shesolves-001',
    submissionId: 'sub-herbuddy-001',
    judgeId: 'usr-judge-005',
    criterionId: 'crit-ss-101',
    score: 22,
    remarks: 'Exceptional problem framing and high novelty addressing community safety.',
    isLocked: true,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'eval-ss-002',
    hackathonId: 'hack-shesolves-001',
    submissionId: 'sub-herbuddy-001',
    judgeId: 'usr-judge-005',
    criterionId: 'crit-ss-102',
    score: 21,
    remarks: 'Strong architectural implementation with reliable edge processing and error recovery.',
    isLocked: true,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'eval-ss-003',
    hackathonId: 'hack-shesolves-001',
    submissionId: 'sub-herbuddy-001',
    judgeId: 'usr-judge-005',
    criterionId: 'crit-ss-103',
    score: 20,
    remarks: 'Clean, accessible interface with high attention to user journey and feedback states.',
    isLocked: true,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'eval-ss-004',
    hackathonId: 'hack-shesolves-001',
    submissionId: 'sub-herbuddy-001',
    judgeId: 'usr-judge-005',
    criterionId: 'crit-ss-104',
    score: 20,
    remarks: 'Practical campus deployment strategy and well-documented technical road-map.',
    isLocked: true,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// Initial Certificates
const INITIAL_CERTIFICATES = [
  {
    id: 'cert-001',
    certificateCode: 'HT-CERT-INNO26-001',
    hackathonId: 'hack-002',
    userId: 'usr-leader-001',
    teamId: 'team-002',
    certificateType: 'winner',
    participantName: 'Alex Chen',
    hackathonTitle: 'PCCOE InnovateX 2026',
    issuedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    qrPayload: 'https://hacktrack.io/verify/HT-CERT-INNO26-001',
  },
  {
    id: 'cert-002',
    certificateCode: 'HT-CERT-SHESOLVE-001',
    hackathonId: 'hack-shesolves-001',
    userId: 'usr-leader-nida',
    teamId: 'team-coders-001',
    certificateType: 'participation',
    participantName: 'Nida',
    hackathonTitle: 'She Solves 2026',
    issuedAt: new Date().toISOString(),
    qrPayload: 'https://hacktrack.io/verify/HT-CERT-SHESOLVE-001',
  },
];

// Initial Announcements
const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ann-001',
    hackathonId: 'hack-001',
    title: 'Submission Window Now Open!',
    content: 'Team Leaders can now submit project repositories and video links from their workspace dashboard.',
    targetRole: 'all',
    createdBy: 'usr-admin-006',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// Store singleton class
class HackTrackStore {
  constructor() {
    this.users = [];
    this.hackathons = [];
    this.teams = [];
    this.teamMembers = [];
    this.submissions = [];
    this.judgeAssignments = [];
    this.evaluations = [];
    this.certificates = [];
    this.notifications = [];
    this.announcements = [];
    this.hackathonCodes = []; // Access codes for judge/screening/mentor assignment
    this.organizerInvitations = []; // Admin-governed organizer authorization codes
    this.resetTokens = new Map();
    // Email notifications: idempotency keys for notify() and the delivery outbox.
    this.notificationKeys = new Set();
    // Screening decisions with reviewer notes (internal) and feedback (shown to the team).
    this.screeningReviews = [];
    // Guidance from mentors bound to an event, shared with the team.
    this.mentorNotes = [];
    this.emailOutbox = [];

    this.init();
  }

  init() {
    // Hash passwords for initial users
    const salt = bcrypt.genSaltSync(10);
    // Keep only the hash; the plaintext seed password never lives on a user object.
    this.users = RAW_DEMO_USERS.map(({ password, ...u }) => ({
      ...u,
      passwordHash: bcrypt.hashSync(password, salt),
    }));

    this.hackathons = JSON.parse(JSON.stringify(INITIAL_HACKATHONS));
    this.teams = JSON.parse(JSON.stringify(INITIAL_TEAMS));
    this.teamMembers = JSON.parse(JSON.stringify(INITIAL_TEAM_MEMBERS));
    this.submissions = JSON.parse(JSON.stringify(INITIAL_SUBMISSIONS));
    this.judgeAssignments = JSON.parse(JSON.stringify(INITIAL_JUDGE_ASSIGNMENTS));
    this.evaluations = JSON.parse(JSON.stringify(INITIAL_EVALUATIONS));
    this.certificates = JSON.parse(JSON.stringify(INITIAL_CERTIFICATES));
    this.announcements = JSON.parse(JSON.stringify(INITIAL_ANNOUNCEMENTS));

    // Seed default access codes
    this.hackathonCodes = [
      {
        id: 'code-demo-1',
        hackathonId: 'hack-001',
        hackathonTitle: 'CodeSprint Global 2026',
        role: 'judge',
        code: 'JUDGE-CODE-7X9K',
        createdBy: 'usr-organizer-007',
        createdAt: new Date().toISOString(),
        redeemedBy: [{ userId: 'usr-judge-005', redeemedAt: new Date().toISOString() }],
      },
      {
        id: 'code-demo-2',
        hackathonId: 'hack-001',
        hackathonTitle: 'CodeSprint Global 2026',
        role: 'screening',
        code: 'SCREEN-CODE-3M2P',
        createdBy: 'usr-organizer-007',
        createdAt: new Date().toISOString(),
        redeemedBy: [{ userId: 'usr-screening-004', redeemedAt: new Date().toISOString() }],
      },
      {
        id: 'code-demo-3',
        hackathonId: 'hack-002',
        hackathonTitle: 'PCCOE InnovateX 2026',
        role: 'judge',
        code: 'JUDGE-PCCO-8A4B',
        createdBy: 'usr-organizer-007',
        createdAt: new Date().toISOString(),
        redeemedBy: [],
      },
      {
        id: 'code-demo-4',
        hackathonId: 'hack-002',
        hackathonTitle: 'PCCOE InnovateX 2026',
        role: 'screening',
        code: 'SCREEN-PCCO-5N1W',
        createdBy: 'usr-organizer-007',
        createdAt: new Date().toISOString(),
        redeemedBy: [],
      },
      {
        id: 'code-demo-5',
        hackathonId: 'hack-shesolves-001',
        hackathonTitle: 'She Solves 2026',
        role: 'judge',
        code: 'JUDGE-SHES-9R2M',
        createdBy: 'usr-organizer-008',
        createdAt: new Date().toISOString(),
        redeemedBy: [],
      },
      {
        id: 'code-demo-6',
        hackathonId: 'hack-shesolves-001',
        hackathonTitle: 'She Solves 2026',
        role: 'screening',
        code: 'SCREEN-SHES-4L8K',
        createdBy: 'usr-organizer-008',
        createdAt: new Date().toISOString(),
        redeemedBy: [],
      },
      {
        id: 'code-demo-7',
        hackathonId: 'hack-001',
        hackathonTitle: 'CodeSprint Global 2026',
        role: 'mentor',
        code: 'MENTOR-CODE-5K1R',
        createdBy: 'usr-organizer-007',
        createdAt: new Date().toISOString(),
        redeemedBy: [{ userId: 'usr-mentor-008', redeemedAt: new Date().toISOString() }],
      },
    ];

    // Pre-assign demo users to hack-001
    const judgeUser = this.users.find((u) => u.id === 'usr-judge-005');
    if (judgeUser) judgeUser.assignedHackathonIds = ['hack-001'];
    const screenUser = this.users.find((u) => u.id === 'usr-screening-004');
    if (screenUser) screenUser.assignedHackathonIds = ['hack-001'];
    // The seed mentor guides every seed event that offers mentorship.
    const mentorUser = this.users.find((u) => u.id === 'usr-mentor-008');
    if (mentorUser) {
      mentorUser.assignedHackathonIds = this.hackathons.filter((h) => h.hasMentorship).map((h) => h.id);
    }

    // Seed initial hackathon registrations
    this.registrations = [
      {
        id: 'reg-demo-alex',
        hackathonId: 'hack-001',
        hackathonTitle: 'DevPulse National Sprint 2026',
        userId: 'usr-leader-001',
        userEmail: 'alex@university.edu',
        fullName: 'Alex Chen',
        role: 'leader',
        university: 'Stanford University',
        memberId: 'LEAD-88219',
        status: 'Registration Verified',
        registeredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 'reg-demo-nida',
        hackathonId: 'hack-shesolves-001',
        hackathonTitle: 'She Solves 2026',
        userId: 'usr-leader-nida',
        userEmail: 'nida@university.edu',
        fullName: 'Nida',
        role: 'leader',
        university: 'PCCOE Pune',
        memberId: 'LEAD-99214',
        status: 'Registration Verified',
        registeredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'reg-demo-priya',
        hackathonId: 'hack-001',
        hackathonTitle: 'DevPulse National Sprint 2026',
        userId: 'usr-student-002',
        userEmail: 'priya@university.edu',
        fullName: 'Priya Sharma',
        role: 'student',
        university: 'Stanford University',
        memberId: 'STU-55412',
        status: 'Registration Verified',
        registeredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ];

    // Seed initial organizer authorization invitations (cryptographically hashed)
    this.organizerInvitations = [
      {
        id: 'inv-seed-001',
        codeHash: crypto.createHash('sha256').update('ORG-INVITE-2026').digest('hex'),
        maskedCode: 'ORG-****-2026',
        organizationName: 'DevPulse Hackathon Operations',
        createdBy: 'usr-admin-006',
        status: 'pending',
        redeemedByUserId: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        redeemedAt: null,
      },
      {
        id: 'inv-seed-002',
        codeHash: crypto.createHash('sha256').update('ORGANIZER-AUTH-2026').digest('hex'),
        maskedCode: 'ORG-****-AUTH',
        organizationName: 'AI Catalyst Global Foundation',
        createdBy: 'usr-admin-006',
        status: 'pending',
        redeemedByUserId: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        redeemedAt: null,
      },
    ];
  }

  async loadFromDatabase() {
    try {
      const status = await testConnection();
      if (!status.connected) {
        console.log(`ℹ️ MySQL connection offline (${status.error || 'unreachable'}). Using fast in-memory store.`);
        return false;
      }

      console.log('🔄 Syncing store with MySQL database hacktrack_db...');

      // 1. Users
      const initialDemoUsers = [...this.users];
      const [dbUsers] = await pool.query('SELECT * FROM users');
      if (dbUsers.length === 0) {
        console.log('🌱 Seeding initial users into MySQL...');
        for (const u of initialDemoUsers) {
          await pool.query(
            `INSERT INTO users (id, email, password_hash, full_name, role, role_category, university, member_id, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
            [
              u.id,
              u.email,
              u.passwordHash,
              u.fullName,
              u.role,
              u.roleCategory || this.getRoleCategory(u.role),
              u.university || 'University / Organization',
              u.memberId || null,
              u.isActive ? 1 : 0,
              toSqlDate(u.createdAt) || toSqlDate(new Date()),
            ]
          );
        }
      } else {
        // Ensure any core demo accounts are present in MySQL
        for (const u of initialDemoUsers) {
          if (!dbUsers.some((d) => d.id === u.id || d.email.toLowerCase() === u.email.toLowerCase())) {
            await pool.query(
              `INSERT INTO users (id, email, password_hash, full_name, role, role_category, university, member_id, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
              [
                u.id,
                u.email,
                u.passwordHash,
                u.fullName,
                u.role,
                u.roleCategory || this.getRoleCategory(u.role),
                u.university || 'University / Organization',
                u.memberId || null,
                u.isActive ? 1 : 0,
                toSqlDate(u.createdAt) || toSqlDate(new Date()),
              ]
            );
          }
        }

        const [refreshedUsers] = await pool.query('SELECT * FROM users');
        this.users = refreshedUsers.map((r) => ({
          id: r.id,
          email: r.email,
          passwordHash: r.password_hash,
          fullName: r.full_name,
          role: r.role,
          roleCategory: r.role_category || this.getRoleCategory(r.role),
          university: r.university,
          memberId: r.member_id,
          isActive: !!r.is_active,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          assignedHackathonIds: [],
        }));
      }

      // 2. Hackathons & Criteria
      const [dbHackathons] = await pool.query('SELECT * FROM hackathons');
      const [dbCriteria] = await pool.query('SELECT * FROM evaluation_criteria ORDER BY display_order ASC, created_at ASC');
      if (dbHackathons.length === 0) {
        console.log('🌱 Seeding initial hackathons & criteria into MySQL...');
        for (const h of this.hackathons) {
          await pool.query(
            `INSERT INTO hackathons (id, title, tag_line, description, status, min_team_size, max_team_size, start_date, end_date, registration_deadline, submission_deadline, evaluation_deadline, has_screening_round, screening_rounds_count, has_mentorship, evaluation_workflow, results_published, results_published_at, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title)`,
            [
              h.id,
              h.title,
              h.tagLine || null,
              h.description || null,
              h.status || 'draft',
              h.minTeamSize || 1,
              h.maxTeamSize || 4,
              toSqlDate(h.startDate),
              toSqlDate(h.endDate),
              toSqlDate(h.registrationDeadline),
              toSqlDate(h.submissionDeadline),
              toSqlDate(h.evaluationDeadline),
              h.hasScreeningRound ? 1 : 0,
              h.screeningRoundsCount || 1,
              h.hasMentorship ? 1 : 0,
              h.evaluationWorkflow || 'direct_judging',
              h.resultsPublished ? 1 : 0,
              toSqlDate(h.resultsPublishedAt),
              h.createdBy || 'usr-admin-006',
              toSqlDate(h.createdAt) || toSqlDate(new Date()),
            ]
          );

          if (Array.isArray(h.criteria)) {
            let order = 0;
            for (const c of h.criteria) {
              await pool.query(
                `INSERT INTO evaluation_criteria (id, hackathon_id, name, description, max_score, weightage, display_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [c.id, h.id, c.name, c.description || '', c.maxScore || 25, c.weightage || 1.0, order++]
              );
            }
          }
        }
      } else {
        const criteriaByHackathon = {};
        for (const c of dbCriteria) {
          if (!criteriaByHackathon[c.hackathon_id]) criteriaByHackathon[c.hackathon_id] = [];
          criteriaByHackathon[c.hackathon_id].push({
            id: c.id,
            name: c.name,
            description: c.description,
            maxScore: Number(c.max_score),
            weightage: Number(c.weightage),
          });
        }

        this.hackathons = dbHackathons.map((h) => ({
          id: h.id,
          title: h.title,
          tagLine: h.tag_line || '',
          description: h.description || '',
          status: h.status,
          minTeamSize: h.min_team_size,
          maxTeamSize: h.max_team_size,
          startDate: h.start_date ? new Date(h.start_date).toISOString() : new Date().toISOString(),
          endDate: h.end_date ? new Date(h.end_date).toISOString() : new Date().toISOString(),
          registrationDeadline: h.registration_deadline ? new Date(h.registration_deadline).toISOString() : new Date().toISOString(),
          submissionDeadline: h.submission_deadline ? new Date(h.submission_deadline).toISOString() : new Date().toISOString(),
          evaluationDeadline: h.evaluation_deadline ? new Date(h.evaluation_deadline).toISOString() : null,
          hasScreeningRound: !!h.has_screening_round,
          screeningRoundsCount: h.screening_rounds_count,
          hasMentorship: !!h.has_mentorship,
          evaluationWorkflow: h.evaluation_workflow,
          resultsPublished: !!h.results_published,
          resultsPublishedAt: h.results_published_at ? new Date(h.results_published_at).toISOString() : null,
          createdBy: h.created_by,
          createdAt: h.created_at ? new Date(h.created_at).toISOString() : new Date().toISOString(),
          criteria: criteriaByHackathon[h.id] || [],
        }));
      }

      // 3. Teams & Members
      const [dbTeams] = await pool.query('SELECT * FROM teams');
      const [dbMembers] = await pool.query('SELECT * FROM team_members');
      if (dbTeams.length === 0) {
        console.log('🌱 Seeding initial teams & members into MySQL...');
        for (const t of this.teams) {
          await pool.query(
            `INSERT INTO teams (id, hackathon_id, leader_id, team_name, team_code, track, status, screening_status, mentor_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE team_name = VALUES(team_name)`,
            [
              t.id,
              t.hackathonId,
              t.leaderId,
              t.teamName,
              t.teamCode,
              t.track || 'General Track',
              t.status || 'active',
              t.screeningStatus || 'pending',
              t.mentorId || null,
              toSqlDate(t.createdAt) || toSqlDate(new Date()),
            ]
          );
        }
        for (const tm of this.teamMembers) {
          await pool.query(
            `INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, status, requested_at, reviewed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [
              tm.id,
              tm.teamId,
              tm.hackathonId,
              tm.userId,
              tm.role || 'member',
              tm.status || 'pending',
              toSqlDate(tm.requestedAt) || toSqlDate(new Date()),
              toSqlDate(tm.reviewedAt),
            ]
          );
        }
      } else {
        this.teams = dbTeams.map((t) => ({
          id: t.id,
          hackathonId: t.hackathon_id,
          leaderId: t.leader_id,
          teamName: t.team_name,
          teamCode: t.team_code,
          track: t.track,
          status: t.status,
          rosterLocked: Boolean(t.roster_locked),
          screeningStatus: t.screening_status,
          mentorId: t.mentor_id,
          createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
        }));
        this.teamMembers = dbMembers.map((m) => ({
          id: m.id,
          teamId: m.team_id,
          hackathonId: m.hackathon_id,
          userId: m.user_id,
          role: m.role,
          status: m.status,
          requestedAt: m.requested_at ? new Date(m.requested_at).toISOString() : new Date().toISOString(),
          reviewedAt: m.reviewed_at ? new Date(m.reviewed_at).toISOString() : null,
        }));
      }

      // 4. Submissions
      const [dbSubmissions] = await pool.query('SELECT * FROM submissions');
      if (dbSubmissions.length === 0) {
        console.log('🌱 Seeding initial submissions into MySQL...');
        for (const s of this.submissions) {
          await pool.query(
            `INSERT INTO submissions (id, hackathon_id, team_id, submitted_by, project_title, abstract, track, repo_url, demo_url, presentation_url, file_url, is_locked, submitted_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE project_title = VALUES(project_title)`,
            [
              s.id,
              s.hackathonId,
              s.teamId,
              s.submittedBy,
              s.projectTitle,
              s.abstract,
              s.track || null,
              s.repoUrl || null,
              s.demoUrl || null,
              s.presentationUrl || null,
              s.fileUrl || null,
              s.isLocked ? 1 : 0,
              toSqlDate(s.submittedAt) || toSqlDate(new Date()),
              toSqlDate(s.updatedAt) || toSqlDate(new Date()),
            ]
          );
        }
      } else {
        this.submissions = dbSubmissions.map((s) => ({
          id: s.id,
          hackathonId: s.hackathon_id,
          teamId: s.team_id,
          submittedBy: s.submitted_by,
          projectTitle: s.project_title,
          abstract: s.abstract,
          track: s.track,
          repoUrl: s.repo_url,
          demoUrl: s.demo_url,
          presentationUrl: s.presentation_url,
          fileUrl: s.file_url,
          isLocked: !!s.is_locked,
          submittedAt: s.submitted_at ? new Date(s.submitted_at).toISOString() : new Date().toISOString(),
          updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
        }));
      }

      // 5. Judge Assignments & Evaluations
      const [dbAssignments] = await pool.query('SELECT * FROM judge_assignments');
      const [dbEvaluations] = await pool.query('SELECT * FROM evaluations');
      if (dbAssignments.length === 0 && dbEvaluations.length === 0) {
        console.log('🌱 Seeding initial evaluations into MySQL...');
        for (const a of this.judgeAssignments) {
          await pool.query(
            `INSERT INTO judge_assignments (id, hackathon_id, judge_id, submission_id, assigned_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at)`,
            [a.id, a.hackathonId, a.judgeId, a.submissionId, toSqlDate(a.assignedAt) || toSqlDate(new Date())]
          );
        }
        for (const e of this.evaluations) {
          await pool.query(
            `INSERT INTO evaluations (id, hackathon_id, submission_id, judge_id, criterion_id, score, remarks, is_locked, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE score = VALUES(score)`,
            [
              e.id,
              e.hackathonId,
              e.submissionId,
              e.judgeId,
              e.criterionId,
              e.score,
              e.remarks || '',
              e.isLocked ? 1 : 0,
              toSqlDate(e.submittedAt) || toSqlDate(new Date()),
            ]
          );
        }
      } else {
        this.judgeAssignments = dbAssignments.map((a) => ({
          id: a.id,
          hackathonId: a.hackathon_id,
          judgeId: a.judge_id,
          submissionId: a.submission_id,
          assignedAt: a.assigned_at ? new Date(a.assigned_at).toISOString() : new Date().toISOString(),
        }));
        this.evaluations = dbEvaluations.map((e) => ({
          id: e.id,
          hackathonId: e.hackathon_id,
          submissionId: e.submission_id,
          judgeId: e.judge_id,
          criterionId: e.criterion_id,
          score: Number(e.score),
          remarks: e.remarks,
          isLocked: !!e.is_locked,
          submittedAt: e.submitted_at ? new Date(e.submitted_at).toISOString() : new Date().toISOString(),
        }));
      }

      // 6. Certificates
      const [dbCertificates] = await pool.query('SELECT * FROM certificates');
      if (dbCertificates.length === 0) {
        for (const c of this.certificates) {
          await pool.query(
            `INSERT INTO certificates (id, certificate_code, hackathon_id, user_id, team_id, certificate_type, participant_name, hackathon_title, issued_at, qr_payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE certificate_code = VALUES(certificate_code)`,
            [
              c.id,
              c.certificateCode,
              c.hackathonId,
              c.userId,
              c.teamId,
              c.certificateType,
              c.participantName,
              c.hackathonTitle,
              toSqlDate(c.issuedAt) || toSqlDate(new Date()),
              c.qrPayload || '',
            ]
          );
        }
      } else {
        this.certificates = dbCertificates.map((c) => ({
          id: c.id,
          certificateCode: c.certificate_code,
          hackathonId: c.hackathon_id,
          userId: c.user_id,
          teamId: c.team_id,
          certificateType: c.certificate_type,
          participantName: c.participant_name,
          hackathonTitle: c.hackathon_title,
          issuedAt: c.issued_at ? new Date(c.issued_at).toISOString() : new Date().toISOString(),
          qrPayload: c.qr_payload,
        }));
      }

      // 7. Announcements
      const [dbAnnouncements] = await pool.query('SELECT * FROM announcements');
      if (dbAnnouncements.length === 0) {
        for (const a of this.announcements) {
          await pool.query(
            `INSERT INTO announcements (id, hackathon_id, title, content, target_role, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title)`,
            [a.id, a.hackathonId, a.title, a.content, a.targetRole || 'all', a.createdBy, toSqlDate(a.createdAt) || toSqlDate(new Date())]
          );
        }
      } else {
        this.announcements = dbAnnouncements.map((a) => ({
          id: a.id,
          hackathonId: a.hackathon_id,
          title: a.title,
          content: a.content,
          targetRole: a.target_role,
          createdBy: a.created_by,
          createdAt: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
        }));
      }

      // 8. Hackathon Codes
      try {
        const [dbCodes] = await pool.query('SELECT * FROM hackathon_codes');
        if (dbCodes.length === 0) {
          for (const c of this.hackathonCodes) {
            await pool.query(
              `INSERT INTO hackathon_codes (id, hackathon_id, role, code, created_by, created_at, redeemed_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE code = VALUES(code)`,
              [c.id, c.hackathonId, c.role, c.code, c.createdBy, toSqlDate(c.createdAt) || toSqlDate(new Date()), JSON.stringify(c.redeemedBy || [])]
            );
          }
        } else {
          this.hackathonCodes = dbCodes.map((c) => ({
            id: c.id,
            hackathonId: c.hackathon_id,
            role: c.role,
            code: c.code,
            createdBy: c.created_by,
            createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
            redeemedBy: typeof c.redeemed_by === 'string' ? JSON.parse(c.redeemed_by) : (c.redeemed_by || []),
          }));
        }
      } catch (codeErr) {
        console.warn('hackathon_codes sync warning:', codeErr.message);
      }

      // 9. Hackathon Registrations
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS hackathon_registrations (
            id VARCHAR(50) NOT NULL,
            hackathon_id VARCHAR(50) NOT NULL,
            user_id VARCHAR(50) NOT NULL,
            user_email VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'Registration Verified',
            details JSON NULL,
            registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY idx_user_hackathon_reg (hackathon_id, user_id),
            INDEX idx_reg_hackathon (hackathon_id),
            INDEX idx_reg_user (user_id),
            INDEX idx_reg_email (user_email)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Databases created before registration details were stored.
        await pool.query('ALTER TABLE hackathon_registrations ADD COLUMN details JSON NULL').catch(() => {});
        const [dbRegs] = await pool.query('SELECT * FROM hackathon_registrations');
        if (dbRegs.length === 0) {
          for (const r of this.registrations) {
            await pool.query(
              `INSERT INTO hackathon_registrations (id, hackathon_id, user_id, user_email, status, registered_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE status = VALUES(status)`,
              [r.id, r.hackathonId, r.userId, r.userEmail, r.status || 'Registration Verified', toSqlDate(r.registeredAt) || toSqlDate(new Date())]
            );
          }
        } else {
          this.registrations = dbRegs.map((r) => {
            const user = this.findUserById(r.user_id) || this.findUserByEmail(r.user_email);
            const hackathon = this.getHackathonById(r.hackathon_id);
            return {
              id: r.id,
              hackathonId: r.hackathon_id,
              hackathonTitle: hackathon?.title || r.hackathon_id,
              userId: r.user_id,
              userEmail: r.user_email,
              fullName: user?.fullName || 'Registered Participant',
              role: user?.role || 'student',
              university: user?.university || 'University / Organization',
              memberId: user?.memberId || null,
              status: r.status || 'Registration Verified',
              details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details || null,
              registeredAt: r.registered_at ? new Date(r.registered_at).toISOString() : new Date().toISOString(),
            };
          });
        }
      } catch (regErr) {
        console.warn('hackathon_registrations sync warning:', regErr.message);
      }

      // 10. Screening reviews (decision history, team-visible feedback, internal notes)
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS screening_reviews (
            id VARCHAR(50) NOT NULL,
            team_id VARCHAR(50) NOT NULL,
            hackathon_id VARCHAR(50) NOT NULL,
            reviewer_id VARCHAR(50) NULL,
            status VARCHAR(20) NOT NULL,
            feedback TEXT NULL,
            internal_note TEXT NULL,
            checks JSON NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_screening_team (team_id),
            INDEX idx_screening_hackathon (hackathon_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        // Databases created before the checklist was stored.
        await pool.query('ALTER TABLE screening_reviews ADD COLUMN checks JSON NULL').catch(() => {});
        const [dbReviews] = await pool.query('SELECT * FROM screening_reviews ORDER BY created_at ASC');
        this.screeningReviews = dbReviews.map((r) => ({
          id: r.id,
          teamId: r.team_id,
          hackathonId: r.hackathon_id,
          reviewerId: r.reviewer_id,
          status: r.status,
          feedback: r.feedback || '',
          internalNote: r.internal_note || '',
          checks: typeof r.checks === 'string' ? JSON.parse(r.checks) : r.checks || null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        }));
        for (const r of this.screeningReviews) {
          const team = this.findTeamById(r.teamId);
          if (team) {
            team.screeningFeedback = r.feedback;
            team.screeningChecks = r.checks;
            team.screenedAt = r.createdAt;
          }
        }
      } catch (revErr) {
        console.warn('screening_reviews sync warning:', revErr.message);
      }

      // 11. Organizer Invitations (Admin-governed authorization codes)
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS organizer_invitations (
            id VARCHAR(64) NOT NULL,
            code_hash VARCHAR(64) NOT NULL,
            masked_code VARCHAR(32) NOT NULL,
            organization_name VARCHAR(150) NOT NULL,
            created_by VARCHAR(64) NOT NULL,
            status ENUM('pending', 'redeemed', 'revoked', 'expired') NOT NULL DEFAULT 'pending',
            redeemed_by_user_id VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            redeemed_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY idx_org_inv_hash (code_hash),
            INDEX idx_org_inv_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        const [dbInvs] = await pool.query('SELECT * FROM organizer_invitations');
        if (dbInvs.length === 0) {
          for (const inv of this.organizerInvitations) {
            await pool.query(
              `INSERT INTO organizer_invitations
               (id, code_hash, masked_code, organization_name, created_by, status, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE status = VALUES(status)`,
              [inv.id, inv.codeHash, inv.maskedCode, inv.organizationName, inv.createdBy, inv.status, toSqlDate(inv.createdAt) || toSqlDate(new Date()), toSqlDate(inv.expiresAt) || toSqlDate(new Date(Date.now() + 30 * 86400000))]
            );
          }
        } else {
          this.organizerInvitations = dbInvs.map((r) => ({
            id: r.id,
            codeHash: r.code_hash,
            maskedCode: r.masked_code,
            organizationName: r.organization_name,
            createdBy: r.created_by,
            status: r.status,
            redeemedByUserId: r.redeemed_by_user_id,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : new Date().toISOString(),
            redeemedAt: r.redeemed_at ? new Date(r.redeemed_at).toISOString() : null,
          }));
        }
      } catch (invErr) {
        console.warn('organizer_invitations sync warning:', invErr.message);
      }

      console.log('✓ Store successfully synchronized with MySQL database.');
      return true;
    } catch (err) {
      console.error('❌ Failed to load from MySQL:', err.message);
      return false;
    }
  }

  // --- Users & Auth ---
  findUserByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const clean = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === clean) || null;
  }

  findUserById(id) {
    if (!id || typeof id !== 'string') return null;
    const clean = id.trim().toLowerCase();
    return this.users.find((u) => u.id === id || (u.email && u.email.toLowerCase() === clean)) || null;
  }

  getAllUsers(filters = {}) {
    let list = this.users.map(toSafeUser);
    if (filters.role && filters.role !== 'all') {
      list = list.filter((u) => u.role === filters.role);
    }
    if (filters.status === 'active') {
      list = list.filter((u) => u.isActive !== false);
    } else if (filters.status === 'inactive') {
      list = list.filter((u) => u.isActive === false);
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter((u) =>
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.memberId && u.memberId.toLowerCase().includes(q))
      );
    }
    return list;
  }

  /**
   * Retrieves users directly from MySQL with parameterized SQL queries.
   * Strictly excludes passwords, password hashes, and reset tokens.
   */
  async getUsersFromDb(filters = {}) {
    if (isTestMode()) {
      return this.getAllUsers(filters);
    }

    try {
      const connStatus = await testConnection();
      if (!connStatus.connected) {
        return this.getAllUsers(filters);
      }

      let query = `
        SELECT id, email, full_name AS fullName, role, role_category AS roleCategory,
               university, member_id AS memberId, is_active AS isActive,
               created_at AS createdAt, updated_at AS updatedAt
        FROM users
      `;
      const whereClauses = [];
      const params = [];

      if (filters.role && filters.role !== 'all') {
        whereClauses.push('role = ?');
        params.push(filters.role);
      }

      if (filters.status === 'active') {
        whereClauses.push('is_active = 1');
      } else if (filters.status === 'inactive') {
        whereClauses.push('is_active = 0');
      }

      if (filters.search && filters.search.trim()) {
        whereClauses.push('(full_name LIKE ? OR email LIKE ? OR member_id LIKE ?)');
        const searchPattern = `%${filters.search.trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await pool.query(query, params);

      const safeUsers = rows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.fullName,
        role: r.role,
        roleCategory: r.roleCategory || this.getRoleCategory(r.role),
        university: r.university || 'University / Organization',
        memberId: r.memberId || null,
        isActive: Boolean(r.isActive),
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
      }));

      // Keep in-memory store in sync
      if (!filters.role && !filters.search && !filters.status) {
        for (const u of safeUsers) {
          const existing = this.users.find((eu) => eu.id === u.id || (eu.email && eu.email.toLowerCase() === u.email.toLowerCase()));
          if (!existing) {
            this.users.push({
              ...u,
              passwordHash: '',
              assignedHackathonIds: [],
            });
          } else {
            existing.role = u.role;
            existing.roleCategory = u.roleCategory;
            existing.fullName = u.fullName;
            existing.university = u.university;
            existing.memberId = u.memberId;
            existing.isActive = u.isActive;
          }
        }
      }

      return safeUsers;
    } catch (err) {
      console.warn('⚠️ Falling back to in-memory store for getUsers:', err.message);
      return this.getAllUsers();
    }
  }

  createUser({ email, password, fullName, role = 'student', university, memberId, roleCategory, id: fixedId }) {
    const cleanEmail = email.trim().toLowerCase();
    if (this.findUserByEmail(cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = fixedId || `usr-${crypto.randomBytes(4).toString('hex')}`;

    // Student ID must only apply to student-based roles (student, leader).
    // Non-student roles (screening, judge, organizer, admin) must store NULL, never fabricated IDs.
    const isStudentRole = ['student', 'leader'].includes(role);
    const resolvedMemberId = isStudentRole && memberId && String(memberId).trim()
      ? String(memberId).trim()
      : null;

    const newUser = {
      id,
      email: cleanEmail,
      passwordHash,
      fullName: fullName.trim(),
      role,
      roleCategory: roleCategory || this.getRoleCategory(role),
      university: university || 'University / Organization',
      memberId: resolvedMemberId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, role_category, university, member_id, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
        [
          newUser.id,
          newUser.email,
          newUser.passwordHash,
          newUser.fullName,
          newUser.role,
          newUser.roleCategory,
          newUser.university,
          newUser.memberId,
          1,
          toSqlDate(newUser.createdAt),
        ]
      )
    );
    const { passwordHash: _hash, ...safeUser } = newUser;
    return safeUser;
  }

  verifyPassword(user, password) {
    if (!user || !user.passwordHash || typeof password !== 'string') return false;
    return bcrypt.compareSync(password, user.passwordHash);
  }

  createPasswordResetToken(email) {
    const user = this.findUserByEmail(email);
    if (!user) return null;
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 3600 * 1000; // 1 hour
    // Only the newest link works: requesting a reset invalidates earlier ones.
    for (const [t, rec] of this.resetTokens) if (rec.email === user.email) this.resetTokens.delete(t);
    this.resetTokens.set(token, { email: user.email, expiresAt });

    asyncDbWrite(() =>
      pool.query(
        'UPDATE users SET reset_token = ?, reset_token_expiry = ?, updated_at = NOW() WHERE email = ?',
        [token, new Date(expiresAt), user.email]
      )
    );

    return { token, email: user.email, expiresAt };
  }

  resetPasswordWithToken(token, newPassword) {
    const record = this.resetTokens.get(token);
    if (!record) throw new Error('Invalid or expired password reset token.');
    if (Date.now() > record.expiresAt) {
      this.resetTokens.delete(token);
      throw new Error('Password reset token has expired.');
    }
    const user = this.findUserByEmail(record.email);
    if (!user) throw new Error('User not found.');

    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(newPassword, salt);
    this.resetTokens.delete(token);

    asyncDbWrite(() =>
      pool.query(
        'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL, updated_at = NOW() WHERE email = ?',
        [user.passwordHash, user.email]
      )
    );

    return true;
  }

  async updateUserRole(userId, newRole) {
    let user = this.findUserById(userId);
    if (!user && !isTestMode()) {
      try {
        const [rows] = await pool.query(
          'SELECT id, email, password_hash, full_name, role, role_category, university, member_id, is_active, created_at FROM users WHERE id = ? OR email = ? LIMIT 1',
          [userId, userId]
        );
        if (rows.length > 0) {
          const r = rows[0];
          user = {
            id: r.id,
            email: r.email,
            passwordHash: r.password_hash,
            fullName: r.full_name,
            role: r.role,
            roleCategory: r.role_category || this.getRoleCategory(r.role),
            university: r.university,
            memberId: r.member_id,
            isActive: Boolean(r.is_active),
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            assignedHackathonIds: [],
          };
          this.users.push(user);
        }
      } catch (err) {
        console.warn('MySQL lookup in updateUserRole:', err.message);
      }
    }

    if (!user) throw new Error('User not found');
    user.role = newRole;
    user.roleCategory = this.getRoleCategory(newRole);

    try {
      await pool.query(
        'UPDATE users SET role = ?, role_category = ?, updated_at = NOW() WHERE id = ? OR email = ?',
        [newRole, user.roleCategory, user.id, user.email]
      );
    } catch (dbErr) {
      console.warn('MySQL update role error:', dbErr.message);
    }

    return user;
  }

  /**
   * Sets a user's active status (deactivation / reactivation).
   * Persists change in MySQL using parameterized queries.
   * Safeguards:
   * 1. Prevents self-deactivation.
   * 2. Prevents deactivation of the last active platform administrator.
   */
  async setUserActiveStatus(targetId, isActive, currentAdminId = null) {
    let user = this.findUserById(targetId);
    if (!user && !isTestMode()) {
      try {
        const [rows] = await pool.query(
          'SELECT id, email, password_hash, full_name, role, role_category, university, member_id, is_active, created_at FROM users WHERE id = ? OR email = ? LIMIT 1',
          [targetId, targetId]
        );
        if (rows.length > 0) {
          const r = rows[0];
          user = {
            id: r.id,
            email: r.email,
            passwordHash: r.password_hash,
            fullName: r.full_name,
            role: r.role,
            roleCategory: r.role_category || this.getRoleCategory(r.role),
            university: r.university,
            memberId: r.member_id,
            isActive: Boolean(r.is_active),
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            assignedHackathonIds: [],
          };
          this.users.push(user);
        }
      } catch (err) {
        console.warn('MySQL lookup in setUserActiveStatus:', err.message);
      }
    }

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    // 1. Prevent self-deactivation
    if (!isActive && currentAdminId) {
      if (user.id === currentAdminId || (user.email && user.email.toLowerCase() === currentAdminId.toLowerCase())) {
        const err = new Error('Administrators cannot deactivate their own account.');
        err.statusCode = 400;
        throw err;
      }
    }

    // 2. Prevent deactivation of the last active administrator
    if (!isActive && user.role === 'admin') {
      let activeAdminCount = 0;
      try {
        const [rows] = await pool.query(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1"
        );
        activeAdminCount = Number(rows[0]?.count || 0);
      } catch {
        // Fallback to in-memory count
        activeAdminCount = this.users.filter((u) => u.role === 'admin' && u.isActive !== false).length;
      }

      if (activeAdminCount <= 1) {
        const err = new Error('Cannot deactivate the last active platform administrator.');
        err.statusCode = 400;
        throw err;
      }
    }

    user.isActive = Boolean(isActive);

    // Persist to MySQL
    try {
      await pool.query(
        'UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ? OR email = ?',
        [user.isActive ? 1 : 0, user.id, user.email]
      );
    } catch (dbErr) {
      console.warn('MySQL update active status error:', dbErr.message);
    }

    const { passwordHash: _p, ...safeUser } = user;
    return safeUser;
  }

  getRoleCategory(role) {
    const map = {
      leader: 'Team Leader',
      student: 'Student / Participant',
      judge: 'Judge / Evaluator',
      screening: 'Screening Committee',
      mentor: 'Technical Mentor',
      admin: 'Platform Administrator',
      organizer: 'Organizer',
    };
    return map[role] || 'Participant';
  }

  // --- Hackathons ---
  getAllHackathons() {
    return this.hackathons;
  }

  getHackathonById(id) {
    if (!id) return null;
    const raw = String(id).trim();
    const cleanId = raw.toLowerCase();
    const alphaNumericOnly = cleanId.replace(/[^a-z0-9]/g, '');

    // 1. Exact ID match (case-sensitive or case-insensitive)
    const exact = this.hackathons.find((h) => h.id === raw || h.id.toLowerCase() === cleanId);
    if (exact) return exact;

    // 2. Known standard platform aliases
    const aliases = {
      'pccoe-innovatex-2026': 'hack-002',
      'innovatex-2026': 'hack-002',
      'innovatex': 'hack-002',
      'she-solves-2026': 'hack-shesolves-001',
      'shesolves': 'hack-shesolves-001',
      'she-solves': 'hack-shesolves-001',
      'shesolves-2026': 'hack-shesolves-001',
      'shesolves2026': 'hack-shesolves-001',
      'hack-shesolves': 'hack-shesolves-001',
    };
    if (aliases[cleanId]) {
      const target = this.hackathons.find((h) => h.id === aliases[cleanId]);
      if (target) return target;
    }

    // 3. Exact title or title slug match
    const titleMatch = this.hackathons.find((h) => {
      const hTitle = String(h.title || '').toLowerCase();
      const hSlug = hTitle.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return hTitle === cleanId || hSlug === cleanId;
    });
    if (titleMatch) return titleMatch;

    // 4. Normalized alphanumeric match (stripping all hyphens, spaces, symbols)
    const normMatch = this.hackathons.find((h) => {
      const hNormId = h.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hNormTitle = String(h.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return hNormId === alphaNumericOnly || hNormTitle === alphaNumericOnly;
    });
    if (normMatch) return normMatch;

    // 5. Keyword containment (e.g. "shesolves" in "she solves", "devpulse" in "devpulse national sprint")
    if (alphaNumericOnly.length >= 4) {
      const containMatch = this.hackathons.find((h) => {
        const hNormId = h.id.toLowerCase().replace(/[^a-z0-9]/g, '');
        const hNormTitle = String(h.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (
          hNormId.includes(alphaNumericOnly) ||
          alphaNumericOnly.includes(hNormId) ||
          hNormTitle.includes(alphaNumericOnly) ||
          alphaNumericOnly.includes(hNormTitle)
        );
      });
      if (containMatch) return containMatch;
    }

    return null;
  }

  // --- Hackathon Registrations ---
  registerUserForHackathon({ hackathonId, userId, userEmail, status, details = null }) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found');

    const canonicalHackathonId = hackathon.id;

    let user = null;
    if (userId) user = this.findUserById(userId);
    if (!user && userEmail) user = this.findUserByEmail(userEmail);
    if (!user) throw new Error('User not found');

    // Check if already registered
    const existing = this.registrations.find(
      (r) =>
        r.hackathonId === canonicalHackathonId &&
        (r.userId === user.id || (r.userEmail && r.userEmail.toLowerCase() === user.email.toLowerCase()))
    );
    if (existing) {
      return existing;
    }

    const id = `reg-${crypto.randomBytes(4).toString('hex')}`;
    const newReg = {
      id,
      hackathonId: canonicalHackathonId,
      hackathonTitle: hackathon.title,
      userId: user.id,
      userEmail: user.email,
      fullName: user.fullName,
      role: user.role,
      university: user.university || 'University / Organization',
      memberId: user.memberId || null,
      status: status || 'Registration Verified',
      // Details the participant confirmed in the registration form.
      details: details || null,
      registeredAt: new Date().toISOString(),
    };

    this.registrations.push(newReg);

    // Persist to MySQL
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO hackathon_registrations (id, hackathon_id, user_id, user_email, status, details, registered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [id, canonicalHackathonId, user.id, user.email, newReg.status, newReg.details ? JSON.stringify(newReg.details) : null, toSqlDate(newReg.registeredAt)]
      )
    );

    return newReg;
  }

  isUserRegisteredForHackathon(userIdOrEmail, hackathonId) {
    if (!userIdOrEmail || !hackathonId) return false;
    const hackathon = this.getHackathonById(hackathonId);
    const targetHackId = hackathon ? hackathon.id : hackathonId;
    const cleanUser = String(userIdOrEmail).trim().toLowerCase();
    const user = this.findUserById(userIdOrEmail) || this.findUserByEmail(userIdOrEmail);
    const targetUserId = user ? user.id : cleanUser;
    const targetUserEmail = user ? user.email.toLowerCase() : cleanUser;

    return this.registrations.some(
      (r) =>
        (r.hackathonId === targetHackId || (hackathon && r.hackathonId === hackathon.id)) &&
        (r.userId === targetUserId || (r.userEmail && r.userEmail.toLowerCase() === targetUserEmail))
    );
  }

  getUserRegistrations(userIdOrEmail) {
    if (!userIdOrEmail) return [];
    const cleanUser = String(userIdOrEmail).trim().toLowerCase();
    const user = this.findUserById(userIdOrEmail) || this.findUserByEmail(userIdOrEmail);
    const targetUserId = user ? user.id : cleanUser;
    const targetUserEmail = user ? user.email.toLowerCase() : cleanUser;

    return this.registrations
      .filter(
        (r) =>
          r.userId === targetUserId ||
          (r.userEmail && r.userEmail.toLowerCase() === targetUserEmail)
      )
      .map((r) => {
        const hackathon = this.getHackathonById(r.hackathonId);
        return {
          id: r.id,
          hackathonId: r.hackathonId,
          hackathonTitle: hackathon ? hackathon.title : r.hackathonTitle || r.hackathonId,
          userId: r.userId,
          userEmail: r.userEmail,
          status: r.status,
          registeredAt: r.registeredAt,
        };
      });
  }

  getRegistrationsForHackathon(hackathonId) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) return [];
    const canonicalId = hackathon.id;

    return this.registrations
      .filter((r) => r.hackathonId === canonicalId)
      .map((r) => {
        const user = this.findUserById(r.userId) || this.findUserByEmail(r.userEmail);
        const teamMember = this.teamMembers.find(
          (m) => m.hackathonId === canonicalId && m.userId === (user?.id || r.userId) && m.status === 'accepted'
        );
        const team = teamMember ? this.findTeamById(teamMember.teamId) : null;
        return {
          ...r,
          fullName: user?.fullName || r.fullName || 'Registered Participant',
          email: user?.email || r.userEmail,
          role: user?.role || r.role || 'student',
          university: user?.university || r.university || 'University / Organization',
          memberId: user?.memberId || r.memberId || null,
          isActive: user ? user.isActive : true,
          team: team ? { id: team.id, name: team.teamName, code: team.teamCode, role: teamMember.role } : null,
        };
      });
  }

  getAllRegistrations(filters = {}) {
    let list = this.registrations.map((r) => {
      const user = this.findUserById(r.userId) || this.findUserByEmail(r.userEmail);
      const hackathon = this.getHackathonById(r.hackathonId);
      const canonicalHackId = hackathon ? hackathon.id : r.hackathonId;

      const teamMember = this.teamMembers.find((m) => {
        const matchHack = m.hackathonId === r.hackathonId || m.hackathonId === canonicalHackId;
        const matchUser = m.userId === (user?.id || r.userId) ||
          (user && this.findUserById(m.userId)?.email?.toLowerCase() === user.email.toLowerCase());
        return matchHack && matchUser && m.status === 'accepted';
      });
      const team = teamMember ? this.findTeamById(teamMember.teamId) : null;

      const pendingMember = !teamMember ? this.teamMembers.find((m) => {
        const matchHack = m.hackathonId === r.hackathonId || m.hackathonId === canonicalHackId;
        const matchUser = m.userId === (user?.id || r.userId) ||
          (user && this.findUserById(m.userId)?.email?.toLowerCase() === user.email.toLowerCase());
        return matchHack && matchUser && m.status === 'pending';
      }) : null;
      const pendingTeam = pendingMember ? this.findTeamById(pendingMember.teamId) : null;

      return {
        ...r,
        hackathonId: canonicalHackId,
        hackathonTitle: hackathon?.title || r.hackathonTitle || r.hackathonId,
        fullName: user?.fullName || r.fullName || 'Registered Participant',
        email: user?.email || r.userEmail,
        role: user?.role || r.role || 'student',
        university: user?.university || r.university || 'University / Organization',
        memberId: user?.memberId || r.memberId || null,
        isActive: user ? user.isActive : true,
        team: team ? { id: team.id, name: team.teamName, code: team.teamCode, role: teamMember.role, status: 'Active' } : null,
        pendingRequest: pendingTeam ? { id: pendingTeam.id, name: pendingTeam.teamName, code: pendingTeam.teamCode, status: 'Pending' } : null,
      };
    });

    if (filters.hackathonId && filters.hackathonId !== 'all') {
      const hackathon = this.getHackathonById(filters.hackathonId);
      const targetId = hackathon ? hackathon.id : filters.hackathonId;
      list = list.filter((r) => r.hackathonId === targetId || (hackathon && r.hackathonId === filters.hackathonId));
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.fullName && r.fullName.toLowerCase().includes(q)) ||
          (r.email && r.email.toLowerCase().includes(q)) ||
          (r.hackathonTitle && r.hackathonTitle.toLowerCase().includes(q)) ||
          (r.university && r.university.toLowerCase().includes(q))
      );
    }

    return list;
  }

  createHackathon(data) {
    const id = data.id || `hack-${crypto.randomBytes(3).toString('hex')}`;
    const newHackathon = {
      id,
      title: data.title,
      tagLine: data.tagLine || '',
      description: data.description || '',
      status: data.status || 'published',
      minTeamSize: data.minTeamSize || 1,
      maxTeamSize: data.maxTeamSize || 4,
      startDate: data.startDate || new Date().toISOString(),
      endDate: data.endDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      registrationDeadline: data.registrationDeadline,
      submissionDeadline: data.submissionDeadline,
      evaluationDeadline: data.evaluationDeadline || null,
      hasScreeningRound: !!data.hasScreeningRound,
      screeningRoundsCount: data.screeningRoundsCount || 1,
      hasMentorship: !!data.hasMentorship,
      evaluationWorkflow: data.evaluationWorkflow || 'direct_judging',
      resultsPublished: false,
      resultsPublishedAt: null,
      createdBy: data.createdBy,
      assignedOrganizers: [data.createdBy],
      criteria: data.criteria || [
        { id: `crit-${Date.now()}-1`, name: 'Innovation', maxScore: 25, weightage: 1.0 },
        { id: `crit-${Date.now()}-2`, name: 'Execution', maxScore: 25, weightage: 1.0 },
        { id: `crit-${Date.now()}-3`, name: 'Design', maxScore: 25, weightage: 1.0 },
        { id: `crit-${Date.now()}-4`, name: 'Feasibility', maxScore: 25, weightage: 1.0 },
      ],
      createdAt: new Date().toISOString(),
    };
    this.hackathons.push(newHackathon);

    // Persist to MySQL
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO hackathons (id, title, tag_line, description, status, min_team_size, max_team_size, start_date, end_date, registration_deadline, submission_deadline, evaluation_deadline, has_screening_round, screening_rounds_count, has_mentorship, evaluation_workflow, results_published, results_published_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status), registration_deadline = VALUES(registration_deadline), submission_deadline = VALUES(submission_deadline)`,
        [
          newHackathon.id,
          newHackathon.title,
          newHackathon.tagLine || null,
          newHackathon.description || null,
          newHackathon.status || 'published',
          newHackathon.minTeamSize || 1,
          newHackathon.maxTeamSize || 4,
          toSqlDate(newHackathon.startDate),
          toSqlDate(newHackathon.endDate),
          toSqlDate(newHackathon.registrationDeadline),
          toSqlDate(newHackathon.submissionDeadline),
          toSqlDate(newHackathon.evaluationDeadline),
          newHackathon.hasScreeningRound ? 1 : 0,
          newHackathon.screeningRoundsCount || 1,
          newHackathon.hasMentorship ? 1 : 0,
          newHackathon.evaluationWorkflow || 'direct_judging',
          newHackathon.resultsPublished ? 1 : 0,
          toSqlDate(newHackathon.resultsPublishedAt),
          newHackathon.createdBy || 'usr-admin-006',
          toSqlDate(newHackathon.createdAt) || toSqlDate(new Date()),
        ]
      ).then(() => this.persistCriteria(newHackathon))
    );

    return newHackathon;
  }

  /** Saves a hackathon's rubric to MySQL (evaluations reference these rows). */
  persistCriteria(hackathon) {
    if (isTestMode() || !Array.isArray(hackathon?.criteria)) return Promise.resolve();
    return (async () => {
      const ids = hackathon.criteria.map((c) => c.id);
      let order = 0;
      for (const c of hackathon.criteria) {
        await pool.query(
          `INSERT INTO evaluation_criteria (id, hackathon_id, name, description, max_score, weightage, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), max_score = VALUES(max_score), weightage = VALUES(weightage), display_order = VALUES(display_order)`,
          [c.id, hackathon.id, c.name, c.description || '', c.maxScore || 25, c.weightage || 1.0, order++]
        );
      }
      if (ids.length) {
        await pool.query('DELETE FROM evaluation_criteria WHERE hackathon_id = ? AND id NOT IN (?)', [hackathon.id, ids]).catch(() => {});
      }
    })().catch((err) => console.warn('MySQL criteria write error:', err.message));
  }

  updateHackathon(id, updates) {
    const hackathon = this.getHackathonById(id);
    if (!hackathon) throw new Error('Hackathon not found');
    Object.assign(hackathon, updates, { updatedAt: new Date().toISOString() });
    if (updates.criteria) this.persistCriteria(hackathon);

    // Persist to MySQL
    asyncDbWrite(() =>
      pool.query(
        `UPDATE hackathons SET status = ?, title = ?, tag_line = ?, description = ?, min_team_size = ?, max_team_size = ?,
           start_date = ?, end_date = ?, registration_deadline = ?, submission_deadline = ?, evaluation_deadline = ?,
           has_screening_round = ?, screening_rounds_count = ?, has_mentorship = ?, evaluation_workflow = ?,
           results_published = ?, results_published_at = ? WHERE id = ?`,
        [
          hackathon.status, hackathon.title, hackathon.tagLine || null, hackathon.description || null,
          hackathon.minTeamSize || 1, hackathon.maxTeamSize || 4,
          toSqlDate(hackathon.startDate), toSqlDate(hackathon.endDate), toSqlDate(hackathon.registrationDeadline),
          toSqlDate(hackathon.submissionDeadline), toSqlDate(hackathon.evaluationDeadline),
          hackathon.hasScreeningRound ? 1 : 0, hackathon.screeningRoundsCount || 1, hackathon.hasMentorship ? 1 : 0,
          hackathon.evaluationWorkflow || 'direct_judging', hackathon.resultsPublished ? 1 : 0, toSqlDate(hackathon.resultsPublishedAt),
          hackathon.id,
        ]
      )
    );
    return hackathon;
  }

  deleteHackathon(id) {
    const index = this.hackathons.findIndex((h) => h.id === id);
    if (index === -1) throw new Error('Hackathon not found');
    const [deleted] = this.hackathons.splice(index, 1);
    asyncDbWrite(() => pool.query('DELETE FROM hackathons WHERE id = ?', [id]));
    return deleted;
  }

  publishResults(hackathonId) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found');
    hackathon.resultsPublished = true;
    hackathon.resultsPublishedAt = new Date().toISOString();
    hackathon.status = 'completed';

    // Automatically issue certificates for participants (FR-32)
    const teams = this.getTeamsByHackathon(hackathonId);
    const leaderboard = this.calculateLeaderboard(hackathonId);

    teams.forEach((team) => {
      const rankEntry = leaderboard.find((l) => l.teamId === team.id);
      const isWinner = rankEntry && rankEntry.rank === 1;
      const isRunnerUp = rankEntry && (rankEntry.rank === 2 || rankEntry.rank === 3);

      // Certificates go to accepted members only (not pending or rejected requests).
      const members = this.getTeamMembers(team.id).filter((m) => m.status === 'accepted');
      members.forEach((m) => {
        const user = this.findUserById(m.userId);
        if (!user) return;

        let certType = 'participation';
        if (isWinner) certType = 'winner';
        else if (isRunnerUp) certType = 'runner_up';

        const code = `HT-CERT-${hackathon.id.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const existing = this.certificates.find((c) => c.hackathonId === hackathonId && c.userId === user.id);
        if (!existing) {
          this.certificates.push({
            id: `cert-${crypto.randomBytes(4).toString('hex')}`,
            certificateCode: code,
            hackathonId,
            userId: user.id,
            teamId: team.id,
            certificateType: certType,
            participantName: user.fullName,
            hackathonTitle: hackathon.title,
            issuedAt: new Date().toISOString(),
            qrPayload: `https://hacktrack.io/verify/${code}`,
          });
        }
      });
    });

    // Persist to MySQL
    asyncDbWrite(() =>
      pool.query(
        `UPDATE hackathons SET results_published = 1, results_published_at = ?, status = 'completed' WHERE id = ?`,
        [toSqlDate(hackathon.resultsPublishedAt), hackathonId]
      )
    );

    for (const c of this.certificates.filter((x) => x.hackathonId === hackathonId)) {
      asyncDbWrite(() =>
        pool.query(
          `INSERT INTO certificates (id, certificate_code, hackathon_id, user_id, team_id, certificate_type, participant_name, hackathon_title, issued_at, qr_payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE certificate_code = VALUES(certificate_code)`,
          [c.id, c.certificateCode, c.hackathonId, c.userId, c.teamId, c.certificateType, c.participantName, c.hackathonTitle, toSqlDate(c.issuedAt), c.qrPayload]
        )
      );
    }

    return hackathon;
  }

  // --- Teams (FR-12 to FR-16, BR-1 to BR-3) ---
  getAllTeams() {
    return this.teams;
  }

  getTeamsByHackathon(hackathonId) {
    const hackathon = this.getHackathonById(hackathonId);
    const targetId = hackathon ? hackathon.id : hackathonId;
    return this.teams.filter((t) => t.hackathonId === targetId || (hackathon && t.hackathonId === hackathonId));
  }

  findTeamById(teamId) {
    return this.teams.find((t) => t.id === teamId) || null;
  }

  findTeamByCode(code) {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    return this.teams.find((t) => t.teamCode.toUpperCase() === clean) || null;
  }

  createTeam({ hackathonId, leaderId, teamName, track, id: fixedId }) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found');

    if (hackathon.status === 'draft') {
      throw new Error('Hackathon is not published for team registration.');
    }

    // Deadline check (FR-11)
    if (new Date() > new Date(hackathon.registrationDeadline)) {
      throw new Error('Registration deadline has passed for this hackathon.');
    }

    // Leader verification (FR-12, BR-1)
    const leader = this.findUserById(leaderId);
    if (!leader) throw new Error('Leader not found');
    if (leader.role !== 'leader') {
      throw new Error('Only users with the Team Leader role may create a team (BR-1).');
    }

    // Single team membership check (FR-16, BR-2)
    const canonicalHackathonId = hackathon.id;

    // Ensure leader is recorded in registrations for this hackathon
    if (!this.isUserRegisteredForHackathon(leaderId, canonicalHackathonId)) {
      this.registerUserForHackathon({
        hackathonId: canonicalHackathonId,
        userId: leaderId,
        userEmail: leader.email,
        status: 'Registration Verified',
      });
    }

    const existingMembership = this.teamMembers.find(
      (m) => m.hackathonId === canonicalHackathonId && m.userId === leaderId && m.status === 'accepted'
    );
    if (existingMembership) {
      throw new Error('You are already a member of a team in this hackathon (BR-2).');
    }

    // Unique Team Code generation (FR-13)
    let teamCode;
    do {
      teamCode = `HT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    } while (this.findTeamByCode(teamCode));

    const id = fixedId || `team-${crypto.randomBytes(4).toString('hex')}`;
    const newTeam = {
      id,
      hackathonId: canonicalHackathonId,
      hackathonTitle: hackathon.title,
      leaderId,
      teamName: teamName.trim(),
      teamCode,
      track: track || 'General',
      status: 'active',
      rosterLocked: false,
      screeningStatus: 'pending',
      mentorId: null,
      createdAt: new Date().toISOString(),
    };

    this.teams.push(newTeam);

    const leaderMember = {
      id: `tm-${crypto.randomBytes(4).toString('hex')}`,
      teamId: id,
      hackathonId: canonicalHackathonId,
      userId: leaderId,
      role: 'leader',
      status: 'accepted',
      requestedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    };
    this.teamMembers.push(leaderMember);

    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO teams (id, hackathon_id, leader_id, team_name, team_code, track, status, roster_locked, screening_status, mentor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newTeam.id, newTeam.hackathonId, newTeam.leaderId, newTeam.teamName, newTeam.teamCode, newTeam.track, newTeam.status, 0, newTeam.screeningStatus, newTeam.mentorId, toSqlDate(newTeam.createdAt)]
      )
    );

    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, status, requested_at, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [leaderMember.id, leaderMember.teamId, leaderMember.hackathonId, leaderMember.userId, leaderMember.role, leaderMember.status, toSqlDate(leaderMember.requestedAt), toSqlDate(leaderMember.reviewedAt)]
      )
    );

    return newTeam;
  }

  requestJoinTeam({ teamCode, userId }) {
    const team = this.findTeamByCode(teamCode);
    if (!team) throw new Error('Invalid Team Code. Team not found.');

    if (team.rosterLocked) {
      throw new Error('This team roster is locked by the Team Leader and no longer accepting join requests.');
    }

    const hackathon = this.getHackathonById(team.hackathonId);
    if (!hackathon) throw new Error('Hackathon not found.');

    if (new Date() > new Date(hackathon.registrationDeadline)) {
      throw new Error('Registration deadline has passed.');
    }

    // Constraint: 1 team per student per hackathon (FR-16, BR-2)
    const existing = this.teamMembers.find(
      (m) => m.hackathonId === team.hackathonId && m.userId === userId && m.status === 'accepted'
    );
    if (existing) {
      throw new Error('You are already an accepted member of a team for this hackathon (BR-2).');
    }

    const isLeading = this.teams.some(
      (t) => (t.hackathonId === team.hackathonId || t.hackathonId === hackathon.id) && t.leaderId === userId
    );
    if (isLeading) {
      throw new Error('You are already the leader of a team in this hackathon (BR-2).');
    }

    const hasPendingOtherTeam = this.teamMembers.find(
      (m) => (m.hackathonId === team.hackathonId || m.hackathonId === hackathon.id) && m.userId === userId && m.status === 'pending' && m.teamId !== team.id
    );
    if (hasPendingOtherTeam) {
      throw new Error('You already have a pending join request for another team in this hackathon (BR-2).');
    }

    // Check if request already pending
    const pending = this.teamMembers.find((m) => m.teamId === team.id && m.userId === userId);
    if (pending) {
      if (pending.status === 'pending') {
        throw new Error('Join request already pending approval by the Team Leader.');
      }
      if (pending.status === 'rejected') {
        pending.status = 'pending';
        pending.requestedAt = new Date().toISOString();
        pending.reviewedAt = null;
        asyncDbWrite(() =>
          pool.query(
            `UPDATE team_members SET status = 'pending', requested_at = ?, reviewed_at = NULL WHERE id = ?`,
            [toSqlDate(pending.requestedAt), pending.id]
          )
        );
        return pending;
      }
    }

    // Check maximum team size
    const acceptedCount = this.teamMembers.filter((m) => m.teamId === team.id && m.status === 'accepted').length;
    if (acceptedCount >= hackathon.maxTeamSize) {
      throw new Error(`Team has already reached the maximum size of ${hackathon.maxTeamSize} members.`);
    }

    const newRequest = {
      id: `tm-${crypto.randomBytes(4).toString('hex')}`,
      teamId: team.id,
      hackathonId: team.hackathonId,
      userId,
      role: 'member',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      reviewedAt: null,
    };

    this.teamMembers.push(newRequest);
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, status, requested_at, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), requested_at = VALUES(requested_at), reviewed_at = NULL`,
        [newRequest.id, newRequest.teamId, newRequest.hackathonId, newRequest.userId, newRequest.role, newRequest.status, toSqlDate(newRequest.requestedAt), null]
      )
    );
    return newRequest;
  }

  respondToJoinRequest({ teamId, requestId, leaderId, action }) {
    const team = this.findTeamById(teamId);
    if (!team) throw new Error('Team not found');
    if (team.leaderId !== leaderId) {
      throw new Error('Only the Team Leader can approve or reject join requests (FR-15, BR-3).');
    }

    const memberRecord = this.teamMembers.find((m) => m.id === requestId && m.teamId === teamId);
    if (!memberRecord) throw new Error('Join request not found.');
    // Only pending requests can be decided; accepted members aren't "rejected" through this.
    if (memberRecord.status !== 'pending') throw new Error('This join request has already been decided.');

    if (action === 'accept') {
      if (team.rosterLocked) {
        throw new Error('This team roster is locked by the Team Leader. Join requests cannot be accepted while the roster is locked.');
      }

      const hackathon = this.getHackathonById(team.hackathonId);
      const acceptedCount = this.teamMembers.filter((m) => m.teamId === team.id && m.status === 'accepted').length;
      if (hackathon && acceptedCount >= hackathon.maxTeamSize) {
        throw new Error(`Team limit reached (${hackathon.maxTeamSize} members).`);
      }

      // Safeguard: participant cannot be accepted in two teams of the same hackathon (BR-2)
      const alreadyAcceptedElsewhere = this.teamMembers.find(
        (m) =>
          m.hackathonId === team.hackathonId &&
          m.userId === memberRecord.userId &&
          m.status === 'accepted' &&
          m.id !== memberRecord.id
      );
      if (alreadyAcceptedElsewhere) {
        throw new Error('This participant is already an accepted member of another team in this hackathon (BR-2).');
      }

      memberRecord.status = 'accepted';
      memberRecord.reviewedAt = new Date().toISOString();
    } else if (action === 'reject') {
      memberRecord.status = 'rejected';
      memberRecord.reviewedAt = new Date().toISOString();
    } else {
      throw new Error('Invalid action. Use "accept" or "reject".');
    }

    asyncDbWrite(() =>
      pool.query(
        `UPDATE team_members SET status = ?, reviewed_at = ? WHERE id = ?`,
        [memberRecord.status, toSqlDate(memberRecord.reviewedAt), memberRecord.id]
      )
    );

    return memberRecord;
  }

  setTeamRosterLock({ teamId, leaderId, locked }) {
    const team = this.findTeamById(teamId);
    if (!team) throw new Error('Team not found');
    if (team.leaderId !== leaderId) {
      throw new Error('Only the Team Leader can lock or unlock the roster (BR-3).');
    }
    if (team.rosterLocked !== Boolean(locked)) team.rosterLockChangedAt = new Date().toISOString();
    team.rosterLocked = Boolean(locked);
    asyncDbWrite(() =>
      pool.query('UPDATE teams SET roster_locked = ? WHERE id = ?', [team.rosterLocked ? 1 : 0, teamId])
    );
    return team;
  }

  /**
   * Screening decision for a team. `feedback` is shown to the team;
   * `internalNote` is visible only to the committee, organizers and admins.
   * Shortlisting assigns the team's submission to every judge bound to the
   * hackathon, so it appears in their workspace automatically.
   */
  recordScreeningDecision(teamId, status, { reviewerId = null, feedback = '', internalNote = '', checks = null } = {}) {
    const team = this.updateTeamScreeningStatus(teamId, status);
    if (!team) return null;
    team.screeningFeedback = feedback || '';
    team.screenedAt = new Date().toISOString();
    // The compliance checklist is the basis of the decision: it is saved with
    // it, kept across sessions and shown to the team (unlike internal notes).
    team.screeningChecks = checks || null;
    const review = {
      id: `scr-${crypto.randomBytes(4).toString('hex')}`,
      teamId: team.id,
      hackathonId: team.hackathonId,
      reviewerId,
      status,
      feedback: feedback || '',
      internalNote: internalNote || '',
      checks: checks || null,
      createdAt: team.screenedAt,
    };
    this.screeningReviews.push(review);
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO screening_reviews (id, team_id, hackathon_id, reviewer_id, status, feedback, internal_note, checks, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [review.id, review.teamId, review.hackathonId, review.reviewerId, review.status, review.feedback, review.internalNote, review.checks ? JSON.stringify(review.checks) : null, toSqlDate(review.createdAt)]
      )
    );
    if (status === 'shortlisted') {
      const submission = this.getSubmissionByTeamId(team.id);
      if (submission) {
        this.users
          .filter((u) => u.role === 'judge' && u.isActive !== false && Array.isArray(u.assignedHackathonIds) && u.assignedHackathonIds.includes(team.hackathonId))
          .forEach((judge) => {
            try {
              this.assignJudgeToSubmission({ hackathonId: team.hackathonId, judgeId: judge.id, submissionId: submission.id });
            } catch {
              /* already assigned or not eligible */
            }
          });
      }
    }
    return { team, review };
  }

  /**
   * Screening status as everyone outside the committee should see it: a team
   * only enters screening once its submission is finalized (locked), so a
   * missing or draft submission reads "not_submitted" whatever was recorded.
   */
  effectiveScreeningStatus(team) {
    if (!team) return 'not_submitted';
    const submission = this.getSubmissionByTeamId(team.id);
    if (!submission || !submission.isLocked) return 'not_submitted';
    return team.screeningStatus || 'pending';
  }

  addMentorNote({ teamId, mentorId, note }) {
    const team = this.findTeamById(teamId);
    const mentor = this.findUserById(mentorId);
    if (!team || !mentor) throw new Error('Team or mentor not found.');
    const entry = {
      id: `mn-${crypto.randomBytes(4).toString('hex')}`,
      teamId: team.id,
      hackathonId: team.hackathonId,
      mentorId: mentor.id,
      mentorName: mentor.fullName,
      note,
      createdAt: new Date().toISOString(),
    };
    this.mentorNotes.push(entry);
    return entry;
  }

  getMentorNotes(teamId) {
    return this.mentorNotes.filter((n) => n.teamId === teamId);
  }

  getScreeningReviews(teamId) {
    return this.screeningReviews.filter((r) => r.teamId === teamId);
  }

  /** Judging progress for a team without any scores (safe before publication). */
  getJudgingProgress(teamId) {
    const submission = this.getSubmissionByTeamId(teamId);
    if (!submission) return { status: 'no_submission', judgesAssigned: 0, judgesCompleted: 0 };
    const assigned = new Set(this.judgeAssignments.filter((a) => a.submissionId === submission.id).map((a) => a.judgeId));
    const completed = new Set(this.evaluations.filter((e) => e.submissionId === submission.id && e.isLocked).map((e) => e.judgeId));
    const done = [...assigned].filter((j) => completed.has(j)).length;
    let status = 'not_started';
    if (!assigned.size) status = 'awaiting_assignment';
    else if (done === assigned.size) status = 'complete';
    else if (done > 0) status = 'in_progress';
    return { status, judgesAssigned: assigned.size, judgesCompleted: done };
  }

  /**
   * What a team is told once results are published: its outcome (selected as
   * winner / runner-up / finalist, or not selected) and certificate — never the
   * judges' individual scores, which stay with organizers and admins.
   */
  getTeamOutcome(teamId) {
    const team = this.findTeamById(teamId);
    if (!team) return null;
    const hackathon = this.getHackathonById(team.hackathonId);
    if (!hackathon?.resultsPublished) return null;
    const ranked = this.calculateLeaderboard(hackathon.id).filter((l) => l.judgeCount > 0);
    const entry = ranked.find((l) => l.teamId === team.id);
    let outcome = 'not_selected';
    if (entry && entry.rank === 1) outcome = 'winner';
    else if (entry && entry.rank <= 3) outcome = 'runner_up';
    else if (entry) outcome = 'finalist';
    return {
      teamId: team.id,
      hackathonId: hackathon.id,
      hackathonTitle: hackathon.title,
      outcome,
      rank: entry ? entry.rank : null,
      finalists: ranked.length,
      shortlisted: team.screeningStatus === 'shortlisted',
      publishedAt: hackathon.resultsPublishedAt,
    };
  }

  /** A team's own result, only once results are published (BR-9). */
  getTeamResults(teamId) {
    const team = this.findTeamById(teamId);
    if (!team) return null;
    const hackathon = this.getHackathonById(team.hackathonId);
    if (!hackathon?.resultsPublished) return null;
    const entry = this.calculateLeaderboard(hackathon.id).find((l) => l.teamId === team.id);
    const submission = this.getSubmissionByTeamId(team.id);
    const evals = submission ? this.evaluations.filter((e) => e.submissionId === submission.id) : [];
    const criteria = (hackathon.criteria || []).map((c) => {
      const scores = evals.filter((e) => e.criterionId === c.id).map((e) => Number(e.score));
      return {
        id: c.id,
        name: c.name,
        maxScore: Number(c.maxScore) || 0,
        averageScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      };
    });
    const remarks = [...new Set(evals.map((e) => e.remarks).filter(Boolean))];
    return {
      teamId: team.id,
      hackathonId: hackathon.id,
      rank: entry?.rank ?? null,
      teamsRanked: this.calculateLeaderboard(hackathon.id).length,
      totalScore: entry?.totalScore ?? 0,
      maxTotal: (hackathon.criteria || []).reduce((s, c) => s + (Number(c.maxScore) || 0) * (Number(c.weightage) || 1), 0),
      judgeCount: entry?.judgeCount ?? 0,
      criteria,
      feedback: remarks,
      publishedAt: hackathon.resultsPublishedAt,
    };
  }

  /** Lifecycle counts for an event (organizer/admin overview). */
  getHackathonProgress(hackathonId) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) return null;
    const teams = this.getTeamsByHackathon(hackathon.id);
    const subs = this.getSubmissionsByHackathon(hackathon.id);
    const screening = { pending: 0, shortlisted: 0, rejected: 0 };
    // Only finalized submissions are in screening.
    teams.forEach((t) => {
      if (subs.some((s) => s.teamId === t.id && s.isLocked)) screening[t.screeningStatus || 'pending'] = (screening[t.screeningStatus || 'pending'] || 0) + 1;
    });
    const judging = { awaiting_assignment: 0, not_started: 0, in_progress: 0, complete: 0 };
    teams.filter((t) => t.screeningStatus === 'shortlisted').forEach((t) => {
      const p = this.getJudgingProgress(t.id);
      if (judging[p.status] !== undefined) judging[p.status] += 1;
    });
    return {
      hackathonId: hackathon.id,
      title: hackathon.title,
      status: hackathon.status,
      registrations: this.registrations.filter((r) => r.hackathonId === hackathon.id).length,
      teams: teams.length,
      participants: new Set(this.teamMembers.filter((m) => m.hackathonId === hackathon.id && m.status === 'accepted').map((m) => m.userId)).size,
      submissions: subs.length,
      lockedSubmissions: subs.filter((s) => s.isLocked).length,
      screening,
      judging,
      resultsPublished: Boolean(hackathon.resultsPublished),
      resultsPublishedAt: hackathon.resultsPublishedAt || null,
      certificates: this.certificates.filter((c) => c.hackathonId === hackathon.id).length,
    };
  }

  /** Removes every activity record of one hackathon (demo reset only). */
  purgeHackathonActivity(hackathonId, userIds = []) {
    const teamIds = new Set(this.teams.filter((t) => t.hackathonId === hackathonId).map((t) => t.id));
    const subIds = new Set(this.submissions.filter((s) => s.hackathonId === hackathonId).map((s) => s.id));
    this.teams = this.teams.filter((t) => t.hackathonId !== hackathonId);
    this.teamMembers = this.teamMembers.filter((m) => m.hackathonId !== hackathonId && !teamIds.has(m.teamId));
    this.submissions = this.submissions.filter((s) => s.hackathonId !== hackathonId);
    this.judgeAssignments = this.judgeAssignments.filter((a) => !subIds.has(a.submissionId));
    this.evaluations = this.evaluations.filter((e) => !subIds.has(e.submissionId));
    this.certificates = this.certificates.filter((c) => c.hackathonId !== hackathonId);
    this.registrations = this.registrations.filter((r) => r.hackathonId !== hackathonId);
    this.screeningReviews = this.screeningReviews.filter((r) => r.hackathonId !== hackathonId);
    this.mentorNotes = this.mentorNotes.filter((n) => n.hackathonId !== hackathonId);
    const users = new Set(userIds);
    this.notifications = this.notifications.filter((n) => !users.has(n.userId));
    for (const key of [...this.notificationKeys]) if ([...users].some((u) => key.endsWith(`:${u}`))) this.notificationKeys.delete(key);
    asyncDbWrite(async () => {
      for (const table of ['evaluations', 'judge_assignments', 'certificates', 'submissions', 'team_members', 'teams', 'hackathon_registrations', 'screening_reviews']) {
        try {
          await pool.query(`DELETE FROM ${table} WHERE hackathon_id = ?`, [hackathonId]);
        } catch {
          /* table may not exist on older databases */
        }
      }
      if (userIds.length) await pool.query('DELETE FROM notifications WHERE user_id IN (?)', [userIds]).catch(() => {});
    });
  }

  updateTeamScreeningStatus(teamId, status) {
    const team = this.findTeamById(teamId);
    if (!team) return null;
    team.screeningStatus = status;
    asyncDbWrite(() =>
      pool.query('UPDATE teams SET screening_status = ? WHERE id = ?', [status, teamId])
    );
    return team;
  }

  getTeamMembers(teamId) {
    return this.teamMembers
      .filter((m) => m.teamId === teamId)
      .map((m) => {
        const user = this.findUserById(m.userId);
        return {
          ...m,
          name: user?.fullName || 'Unknown User',
          userName: user?.fullName || 'Unknown User',
          email: user?.email || '',
          userEmail: user?.email || '',
          userUniversity: user?.university || '',
        };
      });
  }

  // --- Submissions (FR-17 to FR-21, BR-1, BR-8) ---
  getSubmissionsByHackathon(hackathonId) {
    const hackathon = this.getHackathonById(hackathonId);
    const canonicalId = hackathon ? hackathon.id : hackathonId;
    return this.submissions.filter((s) => s.hackathonId === hackathonId || s.hackathonId === canonicalId);
  }

  getSubmissionById(submissionId) {
    return this.submissions.find((s) => s.id === submissionId) || null;
  }

  getSubmissionByTeamId(teamId) {
    return this.submissions.find((s) => s.teamId === teamId) || null;
  }

  createOrUpdateSubmission({ teamId, submittedBy, projectTitle, abstract, track, repoUrl, demoUrl, presentationUrl, fileUrl, id: fixedId }) {
    const team = this.findTeamById(teamId);
    if (!team) throw new Error('Team not found.');

    // Only leader role can submit (FR-17, BR-1)
    if (team.leaderId !== submittedBy) {
      const err = new Error('Only the Team Leader is permitted to submit a project on behalf of the team (FR-17, BR-1).');
      err.statusCode = 403;
      throw err;
    }

    const hackathon = this.getHackathonById(team.hackathonId);
    if (!hackathon) throw new Error('Hackathon not found.');

    // Deadline check (FR-18, FR-21, BR-8)
    if (new Date() > new Date(hackathon.submissionDeadline)) {
      throw new Error('The submission deadline for this hackathon has passed. Submissions are permanently locked (FR-21, BR-8).');
    }

    let submission = this.getSubmissionByTeamId(teamId);
    if (submission) {
      if (submission.isLocked) {
        throw new Error('This submission has already been locked and cannot be edited.');
      }
      Object.assign(submission, {
        projectTitle: projectTitle.trim(),
        abstract: abstract.trim(),
        track: track || team.track,
        repoUrl: repoUrl || submission.repoUrl,
        demoUrl: demoUrl || submission.demoUrl,
        presentationUrl: presentationUrl || submission.presentationUrl,
        fileUrl: fileUrl || submission.fileUrl,
        updatedAt: new Date().toISOString(),
      });
    } else {
      submission = {
        id: fixedId || `sub-${crypto.randomBytes(4).toString('hex')}`,
        hackathonId: team.hackathonId,
        teamId,
        submittedBy,
        projectTitle: projectTitle.trim(),
        abstract: abstract.trim(),
        track: track || team.track,
        repoUrl: repoUrl || '',
        demoUrl: demoUrl || '',
        presentationUrl: presentationUrl || '',
        fileUrl: fileUrl || '',
        isLocked: false,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.submissions.push(submission);
    }

    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO submissions (id, hackathon_id, team_id, submitted_by, project_title, abstract, track, repo_url, demo_url, presentation_url, file_url, is_locked, submitted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE project_title = VALUES(project_title), abstract = VALUES(abstract), track = VALUES(track), repo_url = VALUES(repo_url), demo_url = VALUES(demo_url), presentation_url = VALUES(presentation_url), file_url = VALUES(file_url), is_locked = VALUES(is_locked), updated_at = VALUES(updated_at)`,
        [
          submission.id,
          submission.hackathonId,
          submission.teamId,
          submission.submittedBy,
          submission.projectTitle,
          submission.abstract,
          submission.track,
          submission.repoUrl,
          submission.demoUrl,
          submission.presentationUrl,
          submission.fileUrl,
          submission.isLocked ? 1 : 0,
          toSqlDate(submission.submittedAt),
          toSqlDate(submission.updatedAt),
        ]
      )
    );

    return submission;
  }

  lockSubmission(submissionId) {
    const submission = this.getSubmissionById(submissionId);
    if (!submission) return null;
    const wasLocked = Boolean(submission.isLocked);
    submission.isLocked = true;
    submission.updatedAt = new Date().toISOString();
    asyncDbWrite(() =>
      pool.query('UPDATE submissions SET is_locked = 1, updated_at = ? WHERE id = ?', [toSqlDate(submission.updatedAt), submissionId])
    );
    if (!wasLocked) {
      submission.lockedAt = submission.updatedAt;
      this.startScreeningFresh(submission);
    }
    return submission;
  }

  /**
   * A finalized submission enters screening fresh. Anything recorded while it
   * was still a draft — a preset/stale screening status, checklist, remarks,
   * judge assignments or scores — is not a decision on the finalized work and
   * is cleared, so the team is "pending" until the committee actually decides.
   */
  startScreeningFresh(submission) {
    const team = this.findTeamById(submission.teamId);
    if (team) {
      team.screeningStatus = 'pending';
      team.screeningFeedback = '';
      team.screeningChecks = null;
      team.screenedAt = null;
      asyncDbWrite(() => pool.query("UPDATE teams SET screening_status = 'pending' WHERE id = ?", [team.id]));
    }
    const hadJudging = this.judgeAssignments.some((a) => a.submissionId === submission.id) || this.evaluations.some((e) => e.submissionId === submission.id);
    if (hadJudging) {
      this.judgeAssignments = this.judgeAssignments.filter((a) => a.submissionId !== submission.id);
      this.evaluations = this.evaluations.filter((e) => e.submissionId !== submission.id);
      asyncDbWrite(async () => {
        await pool.query('DELETE FROM evaluations WHERE submission_id = ?', [submission.id]);
        await pool.query('DELETE FROM judge_assignments WHERE submission_id = ?', [submission.id]);
      });
    }
  }

  // --- Evaluations & Judge Assignments (FR-22 to FR-27, BR-7, BR-8) ---
  assignJudgeToSubmission({ hackathonId, judgeId, submissionId }) {
    const judge = this.findUserById(judgeId);
    if (!judge || judge.role !== 'judge') {
      throw new Error('User is not a designated Judge.');
    }

    const submission = this.getSubmissionById(submissionId);
    if (!submission) throw new Error('Submission not found.');
    // The submission decides the hackathon; a mismatched body id can't move it across events.
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon || hackathon.id !== submission.hackathonId) {
      throw new Error('This submission does not belong to the specified hackathon.');
    }
    // BR-5: judges review an event only after binding to it with its access code.
    if (!Array.isArray(judge.assignedHackathonIds) || !judge.assignedHackathonIds.includes(submission.hackathonId)) {
      throw new Error('This judge has not joined this hackathon with its judge access code yet.');
    }

    const existing = this.judgeAssignments.find((ja) => ja.judgeId === judgeId && ja.submissionId === submissionId);
    if (existing) return existing;

    const assignment = {
      id: `ja-${crypto.randomBytes(4).toString('hex')}`,
      hackathonId: submission.hackathonId,
      judgeId,
      submissionId,
      assignedAt: new Date().toISOString(),
    };
    this.judgeAssignments.push(assignment);
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO judge_assignments (id, hackathon_id, judge_id, submission_id, assigned_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at)`,
        [assignment.id, assignment.hackathonId, assignment.judgeId, assignment.submissionId, toSqlDate(assignment.assignedAt)]
      )
    );
    return assignment;
  }

  getJudgeAssignedSubmissions(judgeId) {
    const assignedIds = this.judgeAssignments
      .filter((ja) => ja.judgeId === judgeId)
      .map((ja) => ja.submissionId);

    return this.submissions
      .filter((s) => assignedIds.includes(s.id))
      .map((s) => {
        const team = this.findTeamById(s.teamId);
        const evals = this.evaluations.filter((e) => e.submissionId === s.id && e.judgeId === judgeId);
        return {
          ...s,
          teamName: team?.teamName || 'Unknown Team',
          isEvaluatedByMe: evals.length > 0,
          myEvaluations: evals,
        };
      });
  }

  submitEvaluation({ hackathonId, submissionId, judgeId, scores, remarks }) {
    const judge = this.findUserById(judgeId);
    if (!judge || judge.role !== 'judge') {
      throw new Error('Only authorized Judges can evaluate submissions.');
    }

    // Constraint: Judge may evaluate only assigned projects (FR-25, BR-7)
    const isAssigned = this.judgeAssignments.some(
      (ja) => ja.judgeId === judgeId && ja.submissionId === submissionId
    );
    if (!isAssigned) {
      throw new Error('Judge is not assigned to this project (FR-25, BR-7).');
    }

    // The hackathon (deadline, rubric) always comes from the submission itself.
    const submission = this.getSubmissionById(submissionId);
    if (!submission) throw new Error('Submission not found.');
    const hackathon = this.getHackathonById(submission.hackathonId);
    if (hackathonId && this.getHackathonById(hackathonId)?.id !== submission.hackathonId) {
      throw new Error('This submission does not belong to the specified hackathon.');
    }
    hackathonId = submission.hackathonId;
    if (hackathon?.evaluationDeadline && new Date() > new Date(hackathon.evaluationDeadline)) {
      throw new Error('Evaluation deadline has passed. Scores are locked (FR-27, BR-8).');
    }

    // Validate every item before writing anything (no partial evaluations).
    const criteria = Array.isArray(hackathon?.criteria) ? hackathon.criteria : [];
    const seen = new Set();
    for (const s of scores) {
      const criterionId = s && (s.criterionId || s.criteriaId || s.rubricId || s.id);
      if (!criterionId) throw new Error('criterionId is required for each evaluation score item.');
      const criterion = criteria.find((c) => c.id === criterionId);
      if (criteria.length && !criterion) throw new Error(`Unknown criterion "${criterionId}" for this hackathon.`);
      if (seen.has(criterionId)) throw new Error(`Criterion "${criterionId}" is scored more than once.`);
      seen.add(criterionId);
      const max = Number(criterion?.maxScore) || 100;
      const value = Number(s.score);
      if (s.score === null || s.score === '' || !Number.isFinite(value) || value < 0 || value > max) {
        throw new Error(`Score for "${criterion?.name || criterionId}" must be a number from 0 to ${max}.`);
      }
      const locked = this.evaluations.find((e) => e.submissionId === submissionId && e.judgeId === judgeId && e.criterionId === criterionId && e.isLocked);
      if (locked) throw new Error('Evaluation has already been finalized and locked from further edits (FR-27).');
    }
    if (typeof remarks !== 'undefined' && remarks !== null && (typeof remarks !== 'string' || remarks.length > 5000)) {
      throw new Error('remarks must be text of at most 5000 characters.');
    }

    // Record criteria scores
    const recorded = [];
    scores.forEach((s) => {
      const criterionId = s.criterionId || s.criteriaId || s.rubricId || s.id;
      const score = s.score;

      let evalRecord = this.evaluations.find(
        (e) => e.submissionId === submissionId && e.judgeId === judgeId && e.criterionId === criterionId
      );

      if (evalRecord && evalRecord.isLocked) {
        throw new Error('Evaluation has already been finalized and locked from further edits (FR-27).');
      }

      if (!evalRecord) {
        evalRecord = {
          id: `eval-${crypto.randomBytes(4).toString('hex')}`,
          hackathonId,
          submissionId,
          judgeId,
          criterionId,
          score: Number(score),
          remarks: remarks || '',
          isLocked: true, // Locked once submitted as per BR-8
          submittedAt: new Date().toISOString(),
        };
        this.evaluations.push(evalRecord);
      } else {
        evalRecord.score = Number(score);
        evalRecord.remarks = remarks || evalRecord.remarks;
        evalRecord.isLocked = true;
      }
      recorded.push(evalRecord);
    });

    for (const e of recorded) {
      asyncDbWrite(() =>
        pool.query(
          `INSERT INTO evaluations (id, hackathon_id, submission_id, judge_id, criterion_id, score, remarks, is_locked, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE score = VALUES(score), remarks = VALUES(remarks), is_locked = VALUES(is_locked)`,
          [e.id, e.hackathonId, e.submissionId, e.judgeId, e.criterionId, e.score, e.remarks, e.isLocked ? 1 : 0, toSqlDate(e.submittedAt)]
        )
      );
    }

    return recorded;
  }

  // --- Leaderboard & Results (FR-28 to FR-31, BR-9) ---
  calculateLeaderboard(hackathonId) {
    const teams = this.getTeamsByHackathon(hackathonId);
    const submissions = this.getSubmissionsByHackathon(hackathonId);

    const scoresByTeam = teams.map((team) => {
      const submission = submissions.find((s) => s.teamId === team.id);
      if (!submission) {
        return {
          teamId: team.id,
          teamName: team.teamName,
          submissionId: null,
          projectTitle: null,
          totalScore: 0,
          evalCount: 0,
        };
      }

      // Weighted rubric total per judge, averaged across judges, so the number
      // of judges never changes a team's score (FR-28).
      const hackathon = this.getHackathonById(hackathonId);
      const weightOf = (criterionId) => {
        const c = (hackathon?.criteria || []).find((x) => x.id === criterionId);
        const w = Number(c?.weightage);
        return Number.isFinite(w) && w > 0 ? w : 1;
      };
      const teamEvals = this.evaluations.filter((e) => e.submissionId === submission.id && Number.isFinite(Number(e.score)));
      const perJudge = new Map();
      for (const e of teamEvals) {
        perJudge.set(e.judgeId, (perJudge.get(e.judgeId) || 0) + Number(e.score) * weightOf(e.criterionId));
      }
      const judgeTotals = [...perJudge.values()];
      const totalScore = judgeTotals.length ? Math.round((judgeTotals.reduce((a, b) => a + b, 0) / judgeTotals.length) * 100) / 100 : 0;
      return {
        judgeCount: judgeTotals.length,
        teamId: team.id,
        teamName: team.teamName,
        submissionId: submission.id,
        projectTitle: submission.projectTitle,
        track: submission.track,
        totalScore,
        evalCount: teamEvals.length,
      };
    });

    // Sort descending by total score
    scoresByTeam.sort((a, b) => b.totalScore - a.totalScore);

    return scoresByTeam.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));
  }

  // --- Certificates (FR-32 to FR-34) ---
  getUserCertificates(userId) {
    return this.certificates.filter((c) => c.userId === userId);
  }

  getCertificateByCode(code) {
    return this.certificates.find((c) => c.certificateCode.toUpperCase() === code.trim().toUpperCase()) || null;
  }

  createCertificate({ hackathonId, userId, teamId, certificateType = 'participation', participantName, hackathonTitle }) {
    const code = `HT-CERT-${hackathonId.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const cert = {
      id: `cert-${crypto.randomBytes(4).toString('hex')}`,
      certificateCode: code,
      hackathonId,
      userId,
      teamId: teamId || null,
      certificateType,
      participantName,
      hackathonTitle: hackathonTitle || 'HackTrack Hackathon',
      issuedAt: new Date().toISOString(),
      qrPayload: `https://hacktrack.io/verify/${code}`,
    };
    this.certificates.push(cert);
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO certificates (id, certificate_code, hackathon_id, user_id, team_id, certificate_type, participant_name, hackathon_title, issued_at, qr_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE certificate_code = VALUES(certificate_code)`,
        [cert.id, cert.certificateCode, cert.hackathonId, cert.userId, cert.teamId, cert.certificateType, cert.participantName, cert.hackathonTitle, toSqlDate(cert.issuedAt), cert.qrPayload]
      )
    );
    return cert;
  }

  // --- Announcements & Notifications (FR-35 to FR-39, FR-46) ---
  getAnnouncements(hackathonId = null) {
    if (!hackathonId) return this.announcements;
    return this.announcements.filter((a) => !a.hackathonId || a.hackathonId === hackathonId);
  }

  createAnnouncement({ hackathonId, title, content, targetRole = 'all', createdBy }) {
    const ann = {
      id: `ann-${crypto.randomBytes(4).toString('hex')}`,
      hackathonId: hackathonId || null,
      title: title.trim(),
      content: content.trim(),
      targetRole,
      createdBy,
      createdAt: new Date().toISOString(),
    };
    this.announcements.unshift(ann);
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO announcements (id, hackathon_id, title, content, target_role, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ann.id, ann.hackathonId, ann.title, ann.content, ann.targetRole, ann.createdBy, toSqlDate(ann.createdAt)]
      )
    );
    return ann;
  }

  // In-app notifications (FR-35 to FR-39) — persisted per user, with the
  // email delivery status of the matching email recorded alongside.
  // Returns null when `dedupeKey` was already used, so retried requests or
  // repeated operations never create duplicate notifications or emails.
  addNotification({ userId, type, category, title, message, link = null, dedupeKey = null }) {
    if (dedupeKey) {
      if (this.notificationKeys.has(dedupeKey)) return null;
      this.notificationKeys.add(dedupeKey);
    }
    const notification = {
      id: `ntf-${crypto.randomBytes(5).toString('hex')}`,
      userId,
      type,
      category,
      title,
      message,
      link,
      isRead: false,
      // queued | sent | failed | skipped
      emailStatus: 'pending',
      emailStatusReason: null,
      emailAttempts: 0,
      emailSentAt: null,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(notification);
    asyncDbWrite(() =>
      pool.query(
        `INSERT INTO notifications (id, user_id, type, title, message, is_read, email_sent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [notification.id, notification.userId, notification.type, notification.title, notification.message, 0, notification.emailStatus === 'sent' ? 1 : 0, toSqlDate(notification.createdAt)]
      )
    );
    return notification;
  }

  getUserNotifications(userId) {
    return this.notifications.filter((n) => n.userId === userId);
  }

  findNotificationById(id) {
    return this.notifications.find((n) => n.id === id) || null;
  }

  markNotificationRead(id, userId) {
    const notification = this.notifications.find((n) => n.id === id && n.userId === userId);
    if (!notification) return null;
    notification.isRead = true;
    return notification;
  }

  markAllNotificationsRead(userId) {
    let count = 0;
    this.notifications.forEach((n) => {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        count += 1;
      }
    });
    return count;
  }

  updateNotificationEmailStatus(id, patch) {
    const notification = this.findNotificationById(id);
    if (notification) Object.assign(notification, patch);
    return notification;
  }

  // Email preferences — every category defaults to on. Unknown keys are ignored.
  getEmailPreferences(userId, categories) {
    const user = this.findUserById(userId);
    if (!user) return null;
    const saved = user.emailPreferences || {};
    return Object.fromEntries(categories.map((c) => [c, saved[c] !== false]));
  }

  updateEmailPreferences(userId, updates, categories) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found.');
    const next = { ...(user.emailPreferences || {}) };
    for (const c of categories) {
      if (typeof updates[c] === 'boolean') next[c] = updates[c];
    }
    user.emailPreferences = next;
    return this.getEmailPreferences(userId, categories);
  }

  getSystemStats() {
    return {
      totalUsers: this.users.length,
      totalHackathons: this.hackathons.length,
      activeHackathons: this.hackathons.filter((h) => h.status === 'published').length,
      totalTeams: this.teams.length,
      totalSubmissions: this.submissions.length,
      totalEvaluations: this.evaluations.length,
      totalCertificates: this.certificates.length,
    };
  }

  // --- Hackathon Access Codes (Judge / Screening / Mentor assignment) ---

  generateHackathonCode(hackathonId, role, createdBy) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found.');
    if (!['judge', 'screening', 'mentor'].includes(role)) throw new Error('Role must be judge, screening or mentor.');

    // Revoke previous unused code for same hackathon+role if organizer regenerates
    this.hackathonCodes = this.hackathonCodes.filter(
      (c) => !(c.hackathonId === hackathonId && c.role === role)
    );

    const abbrev = hackathon.title
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.substring(0, 4).toUpperCase())
      .join('');
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${role.toUpperCase()}-${abbrev}-${suffix}`;

    const record = {
      id: `code-${crypto.randomBytes(4).toString('hex')}`,
      hackathonId,
      hackathonTitle: hackathon.title,
      role,
      code,
      createdBy,
      createdAt: new Date().toISOString(),
      redeemedBy: [], // [{ userId, redeemedAt }]
    };

    this.hackathonCodes.push(record);

    // Sync to MySQL if available
    try {
      if (!isTestMode()) {
        pool.query(
          `INSERT INTO hackathon_codes (id, hackathon_id, role, code, created_by, created_at, redeemed_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE code = VALUES(code)`,
          [record.id, record.hackathonId, record.role, record.code, record.createdBy, toSqlDate(record.createdAt), JSON.stringify([])]
        ).catch(() => {});
      }
    } catch { /* ignore */ }

    return record;
  }

  redeemHackathonCode(code, userId) {
    const clean = (code || '').trim().toUpperCase();
    const record = this.hackathonCodes.find((c) => c.code.toUpperCase() === clean);
    if (!record) throw new Error('Invalid or unavailable access code.');

    const user = this.findUserById(userId);
    if (!user) throw new Error('Invalid or unavailable access code.');

    // Check role matches — judge code for judge role, mentor code for mentor, etc.
    if (user.role !== record.role) {
      console.warn(`[AccessCode] Role mismatch for user ${userId} (${user.role}) attempting to redeem ${record.role} code.`);
      throw new Error('Invalid or unavailable access code.');
    }

    // Check if already redeemed by this user
    const alreadyRedeemed = record.redeemedBy.some((r) => r.userId === userId);
    if (!alreadyRedeemed) {
      record.redeemedBy.push({ userId, redeemedAt: new Date().toISOString() });
    }

    // Attach hackathon assignment to user
    if (!user.assignedHackathonIds) user.assignedHackathonIds = [];
    if (!user.assignedHackathonIds.includes(record.hackathonId)) {
      user.assignedHackathonIds.push(record.hackathonId);
    }

    // Sync redemption to MySQL
    try {
      if (!isTestMode()) {
        pool.query(
          'UPDATE hackathon_codes SET redeemed_by = ? WHERE code = ?',
          [JSON.stringify(record.redeemedBy), record.code]
        ).catch(() => {});
        pool.query(
          'UPDATE users SET assigned_hackathon_ids = ? WHERE id = ?',
          [JSON.stringify(user.assignedHackathonIds), user.id]
        ).catch(() => {});
      }
    } catch { /* ignore */ }

    return {
      hackathonId: record.hackathonId,
      hackathonTitle: record.hackathonTitle,
      role: record.role,
      redeemedAt: new Date().toISOString(),
    };
  }

  getCodesForHackathon(hackathonId) {
    return this.hackathonCodes.filter((c) => c.hackathonId === hackathonId);
  }

  getUserAssignedHackathons(userId) {
    const user = this.findUserById(userId);
    if (!user || !user.assignedHackathonIds) return [];
    return user.assignedHackathonIds
      .map((id) => this.getHackathonById(id))
      .filter(Boolean);
  }

  /**
   * Committee members bound to an event (optionally one role). Read from the
   * users' own bindings, not from code redemptions, so regenerating a code
   * never hides people who joined with the previous one.
   */
  getHackathonAssignedUsers(hackathonId, role) {
    const roles = role ? [role] : ['judge', 'screening', 'mentor'];
    return this.users
      .filter((u) => roles.includes(u.role) && Array.isArray(u.assignedHackathonIds) && u.assignedHackathonIds.includes(hackathonId))
      .map(toSafeUser);
  }

  // --- Admin-Governed Organizer Authorization System ---

  async createOrganizerInvitation({ organizationName, createdBy, expiresInDays = 7, notes = '' }) {
    if (!organizationName || !String(organizationName).trim()) {
      throw new Error('Organization name is mandatory to issue an Organizer invitation.');
    }
    const cleanOrg = String(organizationName).trim();
    // Cryptographically secure random 12-char unique key (ORG-XXXX-XXXX)
    const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const rawCode = `ORG-${p1}-${p2}`;
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const maskedCode = `ORG-****-${p2}`;
    const id = `inv-${crypto.randomBytes(6).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + Math.max(1, Number(expiresInDays) || 7) * 86400000).toISOString();

    const record = {
      id,
      codeHash,
      maskedCode,
      organizationName: cleanOrg,
      createdBy,
      status: 'pending',
      redeemedByUserId: null,
      notes: notes ? String(notes).trim() : null,
      createdAt,
      expiresAt,
      redeemedAt: null,
    };

    this.organizerInvitations.unshift(record);

    // Persist to MySQL
    try {
      const connStatus = await testConnection();
      if (connStatus.connected) {
        await pool.query(
          `INSERT INTO organizer_invitations
           (id, code_hash, masked_code, organization_name, created_by, status, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [id, codeHash, maskedCode, cleanOrg, createdBy, toSqlDate(createdAt), toSqlDate(expiresAt)]
        );
      }
    } catch (err) {
      console.warn('organizer_invitations insert DB error:', err.message);
    }

    return {
      ...record,
      code: rawCode, // Revealed once to Admin for copy-to-clipboard
    };
  }

  async getOrganizerInvitations() {
    try {
      const connStatus = await testConnection();
      if (connStatus.connected) {
        const [rows] = await pool.query(`
          SELECT oi.id, oi.masked_code AS maskedCode, oi.organization_name AS organizationName,
                 oi.created_by AS createdBy, oi.status, oi.redeemed_by_user_id AS redeemedByUserId,
                 oi.created_at AS createdAt, oi.expires_at AS expiresAt, oi.redeemed_at AS redeemedAt,
                 u.full_name AS redeemedByName, u.email AS redeemedByEmail,
                 admin.full_name AS creatorName, admin.email AS creatorEmail
          FROM organizer_invitations oi
          LEFT JOIN users u ON oi.redeemed_by_user_id = u.id
          LEFT JOIN users admin ON oi.created_by = admin.id
          ORDER BY oi.created_at DESC
        `);
        if (rows.length > 0) {
          const now = new Date();
          return rows.map((r) => {
            let status = r.status;
            if (status === 'pending' && r.expiresAt && new Date(r.expiresAt) < now) {
              status = 'expired';
            }
            return {
              id: r.id,
              maskedCode: r.maskedCode,
              organizationName: r.organizationName,
              status,
              createdBy: r.createdBy,
              creatorName: r.creatorName || 'Platform Administrator',
              creatorEmail: r.creatorEmail,
              redeemedByUserId: r.redeemedByUserId,
              redeemedByName: r.redeemedByName,
              redeemedByEmail: r.redeemedByEmail,
              createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
              expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
              redeemedAt: r.redeemedAt ? new Date(r.redeemedAt).toISOString() : null,
            };
          });
        }
      }
    } catch (err) {
      console.warn('getOrganizerInvitations DB query fallback to memory:', err.message);
    }

    // In-memory fallback
    const now = new Date();
    return this.organizerInvitations.map((inv) => {
      let status = inv.status;
      if (status === 'pending' && inv.expiresAt && new Date(inv.expiresAt) < now) {
        status = 'expired';
      }
      const redeemer = inv.redeemedByUserId ? this.findUserById(inv.redeemedByUserId) : null;
      const creator = inv.createdBy ? this.findUserById(inv.createdBy) : null;
      return {
        id: inv.id,
        maskedCode: inv.maskedCode,
        organizationName: inv.organizationName,
        status,
        createdBy: inv.createdBy,
        creatorName: creator?.fullName || 'Platform Administrator',
        creatorEmail: creator?.email,
        redeemedByUserId: inv.redeemedByUserId,
        redeemedByName: redeemer?.fullName,
        redeemedByEmail: redeemer?.email,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        redeemedAt: inv.redeemedAt,
      };
    });
  }

  async revokeOrganizerInvitation(id, adminUserId) {
    let inv = this.organizerInvitations.find((i) => i.id === id);
    if (inv && inv.status === 'redeemed') {
      throw new Error('Cannot revoke an invitation that has already been redeemed.');
    }
    if (inv) inv.status = 'revoked';

    try {
      const connStatus = await testConnection();
      if (connStatus.connected) {
        const [result] = await pool.query(
          "UPDATE organizer_invitations SET status = 'revoked' WHERE id = ? AND status != 'redeemed'",
          [id]
        );
        if (result.affectedRows === 0 && (!inv || inv.status === 'redeemed')) {
          throw new Error('Cannot revoke an already-redeemed or non-existent invitation.');
        }
      }
    } catch (err) {
      if (err.message.includes('Cannot revoke')) throw err;
      console.warn('Revoke invitation DB warning:', err.message);
    }

    return { success: true, message: 'Organizer invitation successfully revoked.' };
  }

  async regenerateOrganizerInvitation(id, adminUserId) {
    const list = await this.getOrganizerInvitations();
    const existing = list.find((i) => i.id === id);
    if (!existing) throw new Error('Original invitation not found.');

    if (existing.status === 'pending') {
      await this.revokeOrganizerInvitation(id, adminUserId);
    }

    return this.createOrganizerInvitation({
      organizationName: existing.organizationName,
      createdBy: adminUserId,
      expiresInDays: 7,
      notes: `Replacement for ${existing.maskedCode}`,
    });
  }

  async preValidateOrganizerCode(rawCode) {
    if (!rawCode || !String(rawCode).trim()) {
      throw new Error('Organizer authorization code is required for organizer registration.');
    }
    const cleanCode = String(rawCode).trim().toUpperCase();
    const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

    // 1. Look up invitation by hash in memory
    let inv = this.organizerInvitations.find((i) => i.codeHash === inputHash);

    // 2. Query MySQL if not found in memory
    if (!inv) {
      try {
        const connStatus = await testConnection();
        if (connStatus.connected) {
          const [rows] = await pool.query(
            'SELECT * FROM organizer_invitations WHERE code_hash = ?',
            [inputHash]
          );
          if (rows.length > 0) {
            const r = rows[0];
            inv = {
              id: r.id,
              codeHash: r.code_hash,
              maskedCode: r.masked_code,
              organizationName: r.organization_name,
              status: r.status,
              expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
              redeemedByUserId: r.redeemed_by_user_id,
              redeemedAt: r.redeemed_at,
            };
          }
        }
      } catch (err) {
        console.warn('preValidateOrganizerCode DB query warning:', err.message);
      }
    }

    if (!inv) {
      throw new Error('Invalid or unrecognized Organizer Authorization Code. Please obtain a valid authorization code from Platform Administration.');
    }

    if (inv.status === 'revoked') {
      throw new Error('This Organizer invitation code has been revoked by Platform Administration.');
    }

    if (inv.status === 'redeemed' || inv.redeemedByUserId) {
      throw new Error('This Organizer invitation code has already been redeemed and cannot be reused.');
    }

    if (inv.expiresAt && new Date() > new Date(inv.expiresAt)) {
      inv.status = 'expired';
      throw new Error('This Organizer invitation code has expired. Please request a new invitation from Platform Administration.');
    }

    return inv;
  }

  async validateAndRedeemOrganizerInvitation(rawCode, userId) {
    const inv = await this.preValidateOrganizerCode(rawCode);
    const nowIso = new Date().toISOString();

    inv.status = 'redeemed';
    inv.redeemedByUserId = userId;
    inv.redeemedAt = nowIso;

    try {
      const connStatus = await testConnection();
      if (connStatus.connected) {
        await pool.query(
          "UPDATE organizer_invitations SET status = 'redeemed', redeemed_by_user_id = ?, redeemed_at = NOW() WHERE id = ? AND status = 'pending'",
          [userId, inv.id]
        );
      }
    } catch (err) {
      console.warn('validateAndRedeemOrganizerInvitation DB warning:', err.message);
    }

    return {
      success: true,
      invitationId: inv.id,
      organizationName: inv.organizationName,
    };
  }
}

export const store = new HackTrackStore();
export default store;
