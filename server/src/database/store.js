import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Default Demo Users matching SRS and frontend seeds
const RAW_DEMO_USERS = [
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
    createdBy: 'usr-admin-006',
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
    createdBy: 'usr-admin-006',
    criteria: [
      { id: 'crit-201', name: 'Problem Impact', maxScore: 30, weightage: 1.0, description: 'Significance of problem addressed.' },
      { id: 'crit-202', name: 'Implementation', maxScore: 40, weightage: 1.0, description: 'Working prototype and code structure.' },
      { id: 'crit-203', name: 'Presentation & Demo', maxScore: 30, weightage: 1.0, description: 'Clarity of presentation and live demonstration.' },
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
];

// Initial Evaluations
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
    this.hackathonCodes = []; // Access codes for judge/screening assignment
    this.resetTokens = new Map();

    this.init();
  }

  init() {
    // Hash passwords for initial users
    const salt = bcrypt.genSaltSync(10);
    this.users = RAW_DEMO_USERS.map((u) => ({
      ...u,
      passwordHash: bcrypt.hashSync(u.password, salt),
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
    ];

    // Pre-assign demo users to hack-001
    const judgeUser = this.users.find((u) => u.id === 'usr-judge-005');
    if (judgeUser) judgeUser.assignedHackathonIds = ['hack-001'];
    const screenUser = this.users.find((u) => u.id === 'usr-screening-004');
    if (screenUser) screenUser.assignedHackathonIds = ['hack-001'];
  }

  // --- Users & Auth ---
  findUserByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === clean) || null;
  }

  findUserById(id) {
    return this.users.find((u) => u.id === id) || null;
  }

  getAllUsers() {
    return this.users.map(({ passwordHash: _p, ...safeUser }) => safeUser);
  }

  createUser({ email, password, fullName, role = 'student', university, memberId }) {
    const cleanEmail = email.trim().toLowerCase();
    if (this.findUserByEmail(cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = `usr-${crypto.randomBytes(4).toString('hex')}`;

    const newUser = {
      id,
      email: cleanEmail,
      passwordHash,
      fullName: fullName.trim(),
      role,
      roleCategory: this.getRoleCategory(role),
      university: university || 'University / Organization',
      memberId: memberId || `ID-${Math.floor(10000 + Math.random() * 90000)}`,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    const { passwordHash: _hash, ...safeUser } = newUser;
    return safeUser;
  }

  verifyPassword(user, password) {
    if (!user || !user.passwordHash) return false;
    return bcrypt.compareSync(password, user.passwordHash);
  }

  createPasswordResetToken(email) {
    const user = this.findUserByEmail(email);
    if (!user) return null;
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 3600 * 1000; // 1 hour
    this.resetTokens.set(token, { email: user.email, expiresAt });
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
    return true;
  }

  updateUserRole(userId, newRole) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');
    user.role = newRole;
    user.roleCategory = this.getRoleCategory(newRole);
    return user;
  }

  getRoleCategory(role) {
    const map = {
      leader: 'Team Leader',
      student: 'Student / Participant',
      judge: 'Judge / Evaluator',
      screening: 'Screening Committee',
      mentor: 'Technical Mentor',
      admin: 'Platform Administrator',
      organizer: 'Hackathon Organizer',
    };
    return map[role] || 'Participant';
  }

  // --- Hackathons ---
  getAllHackathons() {
    return this.hackathons;
  }

  getHackathonById(id) {
    return this.hackathons.find((h) => h.id === id) || null;
  }

  createHackathon(data) {
    const id = `hack-${crypto.randomBytes(3).toString('hex')}`;
    const newHackathon = {
      id,
      title: data.title,
      tagLine: data.tagLine || '',
      description: data.description || '',
      status: data.status || 'draft',
      minTeamSize: data.minTeamSize || 1,
      maxTeamSize: data.maxTeamSize || 4,
      startDate: data.startDate,
      endDate: data.endDate,
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
      criteria: data.criteria || [
        { id: `crit-${Date.now()}-1`, name: 'Innovation', maxScore: 25, weightage: 1.0 },
        { id: `crit-${Date.now()}-2`, name: 'Execution', maxScore: 25, weightage: 1.0 },
        { id: `crit-${Date.now()}-3`, name: 'Design', maxScore: 25, weightage: 1.0 },
        { id: `crit-${Date.now()}-4`, name: 'Feasibility', maxScore: 25, weightage: 1.0 },
      ],
      createdAt: new Date().toISOString(),
    };
    this.hackathons.push(newHackathon);
    return newHackathon;
  }

  updateHackathon(id, updates) {
    const hackathon = this.getHackathonById(id);
    if (!hackathon) throw new Error('Hackathon not found');
    Object.assign(hackathon, updates, { updatedAt: new Date().toISOString() });
    return hackathon;
  }

  deleteHackathon(id) {
    const index = this.hackathons.findIndex((h) => h.id === id);
    if (index === -1) throw new Error('Hackathon not found');
    const [deleted] = this.hackathons.splice(index, 1);
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

      const members = this.getTeamMembers(team.id);
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

    return hackathon;
  }

  // --- Teams (FR-12 to FR-16, BR-1 to BR-3) ---
  getAllTeams() {
    return this.teams;
  }

  getTeamsByHackathon(hackathonId) {
    return this.teams.filter((t) => t.hackathonId === hackathonId);
  }

  findTeamById(teamId) {
    return this.teams.find((t) => t.id === teamId) || null;
  }

  findTeamByCode(code) {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    return this.teams.find((t) => t.teamCode.toUpperCase() === clean) || null;
  }

  createTeam({ hackathonId, leaderId, teamName, track }) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found');

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
    const existingMembership = this.teamMembers.find(
      (m) => m.hackathonId === hackathonId && m.userId === leaderId && m.status === 'accepted'
    );
    if (existingMembership) {
      throw new Error('You are already a member of a team in this hackathon (BR-2).');
    }

    // Unique Team Code generation (FR-13)
    let teamCode;
    do {
      teamCode = `HT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    } while (this.findTeamByCode(teamCode));

    const id = `team-${crypto.randomBytes(4).toString('hex')}`;
    const newTeam = {
      id,
      hackathonId,
      leaderId,
      teamName: teamName.trim(),
      teamCode,
      track: track || 'General',
      status: 'active',
      screeningStatus: 'pending',
      mentorId: null,
      createdAt: new Date().toISOString(),
    };

    this.teams.push(newTeam);

    // Add leader as accepted member
    this.teamMembers.push({
      id: `tm-${crypto.randomBytes(4).toString('hex')}`,
      teamId: id,
      hackathonId,
      userId: leaderId,
      role: 'leader',
      status: 'accepted',
      requestedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    });

    return newTeam;
  }

  requestJoinTeam({ teamCode, userId }) {
    const team = this.findTeamByCode(teamCode);
    if (!team) throw new Error('Invalid Team Code. Team not found.');

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

    // Check if request already pending
    const pending = this.teamMembers.find((m) => m.teamId === team.id && m.userId === userId);
    if (pending) {
      if (pending.status === 'pending') {
        throw new Error('Join request already pending approval by the Team Leader.');
      }
      if (pending.status === 'rejected') {
        pending.status = 'pending';
        pending.requestedAt = new Date().toISOString();
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

    if (action === 'accept') {
      const hackathon = this.getHackathonById(team.hackathonId);
      const acceptedCount = this.teamMembers.filter((m) => m.teamId === team.id && m.status === 'accepted').length;
      if (hackathon && acceptedCount >= hackathon.maxTeamSize) {
        throw new Error(`Team limit reached (${hackathon.maxTeamSize} members).`);
      }
      memberRecord.status = 'accepted';
      memberRecord.reviewedAt = new Date().toISOString();
    } else if (action === 'reject') {
      memberRecord.status = 'rejected';
      memberRecord.reviewedAt = new Date().toISOString();
    } else {
      throw new Error('Invalid action. Use "accept" or "reject".');
    }

    return memberRecord;
  }

  getTeamMembers(teamId) {
    return this.teamMembers
      .filter((m) => m.teamId === teamId)
      .map((m) => {
        const user = this.findUserById(m.userId);
        return {
          ...m,
          userName: user?.fullName || 'Unknown User',
          userEmail: user?.email || '',
          userUniversity: user?.university || '',
        };
      });
  }

  // --- Submissions (FR-17 to FR-21, BR-1, BR-8) ---
  getSubmissionsByHackathon(hackathonId) {
    return this.submissions.filter((s) => s.hackathonId === hackathonId);
  }

  getSubmissionById(submissionId) {
    return this.submissions.find((s) => s.id === submissionId) || null;
  }

  getSubmissionByTeamId(teamId) {
    return this.submissions.find((s) => s.teamId === teamId) || null;
  }

  createOrUpdateSubmission({ teamId, submittedBy, projectTitle, abstract, track, repoUrl, demoUrl, presentationUrl, fileUrl }) {
    const team = this.findTeamById(teamId);
    if (!team) throw new Error('Team not found.');

    // Only leader role can submit (FR-17, BR-1)
    if (team.leaderId !== submittedBy) {
      throw new Error('Only the Team Leader is permitted to submit a project on behalf of the team (FR-17, BR-1).');
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
        id: `sub-${crypto.randomBytes(4).toString('hex')}`,
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

    return submission;
  }

  // --- Evaluations & Judge Assignments (FR-22 to FR-27, BR-7, BR-8) ---
  assignJudgeToSubmission({ hackathonId, judgeId, submissionId }) {
    const judge = this.findUserById(judgeId);
    if (!judge || judge.role !== 'judge') {
      throw new Error('User is not a designated Judge.');
    }

    const submission = this.getSubmissionById(submissionId);
    if (!submission) throw new Error('Submission not found.');

    const existing = this.judgeAssignments.find((ja) => ja.judgeId === judgeId && ja.submissionId === submissionId);
    if (existing) return existing;

    const assignment = {
      id: `ja-${crypto.randomBytes(4).toString('hex')}`,
      hackathonId,
      judgeId,
      submissionId,
      assignedAt: new Date().toISOString(),
    };
    this.judgeAssignments.push(assignment);
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

    const hackathon = this.getHackathonById(hackathonId);
    if (hackathon?.evaluationDeadline && new Date() > new Date(hackathon.evaluationDeadline)) {
      throw new Error('Evaluation deadline has passed. Scores are locked (FR-27, BR-8).');
    }

    // Record criteria scores
    const recorded = [];
    scores.forEach(({ criterionId, score }) => {
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

      const teamEvals = this.evaluations.filter((e) => e.submissionId === submission.id);
      const totalScore = teamEvals.reduce((sum, e) => sum + Number(e.score), 0);
      return {
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
    return ann;
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

  // --- Hackathon Access Codes (Judge / Screening assignment) ---

  generateHackathonCode(hackathonId, role, createdBy) {
    const hackathon = this.getHackathonById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found.');
    if (!['judge', 'screening'].includes(role)) throw new Error('Role must be judge or screening.');

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
    return record;
  }

  redeemHackathonCode(code, userId) {
    const clean = (code || '').trim().toUpperCase();
    const record = this.hackathonCodes.find((c) => c.code.toUpperCase() === clean);
    if (!record) throw new Error('Invalid access code. Please check the code and try again.');

    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found.');

    // Check role matches — judge code for judge role, etc.
    if (user.role !== record.role) {
      throw new Error(`This code is for the '${record.role}' role but you are logged in as '${user.role}'.`);
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

  getHackathonAssignedUsers(hackathonId, role) {
    const codes = this.hackathonCodes.filter(
      (c) => c.hackathonId === hackathonId && (!role || c.role === role)
    );
    const userIds = new Set(
      codes.flatMap((c) => c.redeemedBy.map((r) => r.userId))
    );
    return [...userIds]
      .map((id) => this.findUserById(id))
      .filter(Boolean)
      .map(({ passwordHash: _p, ...safe }) => safe);
  }
}

export const store = new HackTrackStore();
export default store;
