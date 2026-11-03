import store from '../database/store.js';
import {
  notifyRegistrationConfirmed,
  notifyTeamCreated,
  notifyJoinRequested,
  notifyJoinDecision,
  notifySubmissionSaved,
  notifyScreeningDecision,
  notifyResultsPublished,
  notifyAccessCodeRedeemed,
} from '../notifications/notifier.js';

/*
 * The shared demonstration scenario: ONE hackathon, ONE team and ONE
 * submission that every panel (participant, leader, organizer, screening,
 * judge, admin) reads from the backend.
 *
 * Every stage is produced by the same store operations the API routes call,
 * in the real order (register → create team → request to join → leader
 * approves → submit → lock → screen → judge → publish), so business rules
 * (deadlines, BR-1/2/3, judge binding, rubric validation…) apply unchanged.
 * Records use fixed ids so the same team/event/submission can be referenced
 * from every dashboard and in the demo guide.
 *
 * All demo accounts use the fictional domain demo.hacktrack.io; the notifier
 * never emails that domain (see notifier.js), so resets can't send mail.
 */

export const DEMO_DOMAIN = 'demo.hacktrack.io';
export const DEMO_PASSWORD = 'password123'; // same documented password as every seeded demo account

export const DEMO_IDS = {
  hackathon: 'hack-demo-2026',
  team: 'team-demo-apex',
  submission: 'sub-demo-ecotrack',
};

export const DEMO_ACCOUNTS = [
  { key: 'organizer', id: 'usr-demo-organizer', email: `organizer@${DEMO_DOMAIN}`, fullName: 'Riya Kapoor', role: 'organizer', university: 'HackTrack Demo Organizing Committee', memberId: 'DEMO-ORG-01' },
  { key: 'screening', id: 'usr-demo-screening', email: `screening@${DEMO_DOMAIN}`, fullName: 'Arjun Mehta', role: 'screening', university: 'Demo Screening Committee', memberId: 'DEMO-SCR-01' },
  { key: 'judge1', id: 'usr-demo-judge-1', email: `judge.nair@${DEMO_DOMAIN}`, fullName: 'Dr. Leela Nair', role: 'judge', university: 'Demo Judging Panel', memberId: 'DEMO-JDG-01' },
  { key: 'judge2', id: 'usr-demo-judge-2', email: `judge.fernandes@${DEMO_DOMAIN}`, fullName: 'Prof. Daniel Fernandes', role: 'judge', university: 'Demo Judging Panel', memberId: 'DEMO-JDG-02' },
  { key: 'leader', id: 'usr-demo-leader', email: `aanya.leader@${DEMO_DOMAIN}`, fullName: 'Aanya Sharma', role: 'leader', university: 'Demo Institute of Technology', memberId: 'DEMO-STU-101' },
  { key: 'member1', id: 'usr-demo-member-1', email: `kabir.member@${DEMO_DOMAIN}`, fullName: 'Kabir Rao', role: 'student', university: 'Demo Institute of Technology', memberId: 'DEMO-STU-102' },
  { key: 'member2', id: 'usr-demo-member-2', email: `meera.member@${DEMO_DOMAIN}`, fullName: 'Meera Iyer', role: 'student', university: 'Demo Institute of Technology', memberId: 'DEMO-STU-103' },
];
const account = (key) => DEMO_ACCOUNTS.find((a) => a.key === key);

export const DEMO_CRITERIA = [
  { id: 'crit-demo-innovation', name: 'Innovation & Originality', maxScore: 30, weightage: 1, description: 'Novelty of the idea and the approach.' },
  { id: 'crit-demo-technical', name: 'Technical Execution', maxScore: 30, weightage: 1, description: 'Architecture, code quality and completeness.' },
  { id: 'crit-demo-impact', name: 'Impact & Sustainability', maxScore: 25, weightage: 1, description: 'Real-world value and environmental benefit.' },
  { id: 'crit-demo-presentation', name: 'Presentation & Demo', maxScore: 15, weightage: 1, description: 'Clarity of the pitch and the live demo.' },
];

export const DEMO_STAGES = [
  { key: 'setup', label: 'Event published', description: 'Published event with rubric, screening committee and two bound judges. No participants yet — demonstrate registration live.' },
  { key: 'registered', label: 'Participants registered', description: 'Aanya, Kabir and Meera are registered for the event.' },
  { key: 'team', label: 'Team formed', description: 'Aanya created Team Apex Innovators; Kabir and Meera requested to join and were approved.' },
  { key: 'submitted', label: 'Project submitted', description: 'EcoTrack AI is submitted and locked; it is waiting in the screening queue.' },
  { key: 'shortlisted', label: 'Screening passed', description: 'The screening committee shortlisted the team; both judges were assigned automatically.' },
  { key: 'judged', label: 'Judging complete', description: 'Both judges scored EcoTrack AI on the rubric. Scores stay private until publication.' },
  { key: 'published', label: 'Results published', description: 'The organizer published results; certificates were issued to all three members.' },
];

export function demoEnabled() {
  if (process.env.DEMO_MODE === 'false') return false;
  if (process.env.NODE_ENV === 'production') return process.env.DEMO_MODE === 'true';
  return true;
}

export const isDemoEmail = (email) => typeof email === 'string' && email.toLowerCase().endsWith(`@${DEMO_DOMAIN}`);

const day = 86400000;

function ensureAccounts() {
  for (const a of DEMO_ACCOUNTS) {
    let user = store.findUserById(a.id);
    if (!user) {
      store.createUser({ id: a.id, email: a.email, password: DEMO_PASSWORD, fullName: a.fullName, role: a.role, university: a.university, memberId: a.memberId });
      user = store.findUserById(a.id);
    }
    user.isActive = true;
    if (user.role !== a.role) user.role = a.role; // a demo reset restores the intended roles
  }
}

function ensureHackathon() {
  const now = Date.now();
  const dates = {
    startDate: new Date(now - 1 * day).toISOString(),
    registrationDeadline: new Date(now + 14 * day).toISOString(),
    submissionDeadline: new Date(now + 21 * day).toISOString(),
    evaluationDeadline: new Date(now + 28 * day).toISOString(),
    endDate: new Date(now + 30 * day).toISOString(),
  };
  let hackathon = store.getAllHackathons().find((h) => h.id === DEMO_IDS.hackathon);
  if (!hackathon) {
    hackathon = store.createHackathon({
      id: DEMO_IDS.hackathon,
      title: 'HackTrack Innovation Challenge',
      tagLine: 'Demonstration event · the complete HackTrack lifecycle',
      description:
        'A demonstration hackathon showcasing the complete HackTrack platform lifecycle, from team registration and project submission to screening, judging and certificate generation.',
      status: 'published',
      ...dates,
      minTeamSize: 1,
      maxTeamSize: 4,
      hasScreeningRound: true,
      screeningRoundsCount: 1,
      hasMentorship: false,
      evaluationWorkflow: 'screening_first',
      criteria: DEMO_CRITERIA,
      createdBy: account('organizer').id,
    });
  }
  // A reset always returns the event to an open, unpublished-results state.
  store.updateHackathon(hackathon.id, {
    ...dates,
    status: 'published',
    resultsPublished: false,
    resultsPublishedAt: null,
    criteria: DEMO_CRITERIA,
    isDemo: true,
    track: 'Sustainability & Climate Tech',
    category: 'AI & ML',
    tags: ['Demo', 'Sustainability', 'AI'],
  });
  return store.getAllHackathons().find((h) => h.id === DEMO_IDS.hackathon);
}

/** Organizer issues committee codes; reviewers redeem them (BR-5). */
function ensureCommittee() {
  const organizerId = account('organizer').id;
  const codes = {};
  for (const role of ['screening', 'judge']) {
    let record = store.getCodesForHackathon(DEMO_IDS.hackathon).find((c) => c.role === role);
    if (!record) record = store.generateHackathonCode(DEMO_IDS.hackathon, role, organizerId);
    codes[role] = record.code;
  }
  for (const key of ['screening', 'judge1', 'judge2']) {
    const a = account(key);
    const user = store.findUserById(a.id);
    if (!user.assignedHackathonIds?.includes(DEMO_IDS.hackathon)) {
      const result = store.redeemHackathonCode(codes[a.role], a.id);
      notifyAccessCodeRedeemed(result, a.id, organizerId);
    }
  }
  return codes;
}

let currentStage = null;

const STEPS = {
  registered() {
    for (const key of ['leader', 'member1', 'member2']) {
      const a = account(key);
      if (!store.isUserRegisteredForHackathon(a.id, DEMO_IDS.hackathon)) {
        const reg = store.registerUserForHackathon({ hackathonId: DEMO_IDS.hackathon, userId: a.id, userEmail: a.email, status: 'Registration Verified' });
        notifyRegistrationConfirmed(reg);
      }
    }
  },
  team() {
    const leader = account('leader');
    const team = store.createTeam({ id: DEMO_IDS.team, hackathonId: DEMO_IDS.hackathon, leaderId: leader.id, teamName: 'Team Apex Innovators', track: 'Sustainability & Climate Tech' });
    notifyTeamCreated(team);
    for (const key of ['member1', 'member2']) {
      const request = store.requestJoinTeam({ teamCode: team.teamCode, userId: account(key).id });
      notifyJoinRequested(request);
      const decision = store.respondToJoinRequest({ teamId: team.id, requestId: request.id, leaderId: leader.id, action: 'accept' });
      notifyJoinDecision(decision, leader.id);
    }
  },
  submitted() {
    const submission = store.createOrUpdateSubmission({
      id: DEMO_IDS.submission,
      teamId: DEMO_IDS.team,
      submittedBy: account('leader').id,
      projectTitle: 'EcoTrack AI',
      abstract:
        'EcoTrack AI estimates a campus’s daily carbon footprint from energy-meter, transport and canteen data, then recommends the three changes with the biggest impact. A lightweight forecasting model flags unusual spikes so facilities teams can act the same day.',
      track: 'Sustainability & Climate Tech',
      repoUrl: 'https://example.com/demo/ecotrack-ai',
      demoUrl: 'https://example.com/demo/ecotrack-ai/live',
      presentationUrl: 'https://example.com/demo/ecotrack-ai/pitch',
    });
    notifySubmissionSaved(submission, { isNew: true });
    store.lockSubmission(submission.id);
  },
  shortlisted() {
    const { team } = store.recordScreeningDecision(DEMO_IDS.team, 'shortlisted', {
      reviewerId: account('screening').id,
      feedback: 'Repository, live demo and documentation all check out. Shortlisted for the judging round — good luck!',
      internalNote: 'Commit history is recent and consistent; README setup verified on a clean machine.',
    });
    notifyScreeningDecision(team, 'shortlisted');
  },
  judged() {
    const scores = {
      judge1: { values: [26, 25, 22, 13], remarks: 'Clear problem framing and a convincing live demo. The forecasting component is well tested.' },
      judge2: { values: [24, 27, 21, 12], remarks: 'Solid architecture and data pipeline. Quantify the sustainability impact more precisely in the pitch.' },
    };
    for (const [key, { values, remarks }] of Object.entries(scores)) {
      store.submitEvaluation({
        hackathonId: DEMO_IDS.hackathon,
        submissionId: DEMO_IDS.submission,
        judgeId: account(key).id,
        scores: DEMO_CRITERIA.map((c, i) => ({ criterionId: c.id, score: values[i] })),
        remarks,
      });
    }
  },
  published() {
    store.publishResults(DEMO_IDS.hackathon);
    notifyResultsPublished(DEMO_IDS.hackathon);
  },
};

/**
 * Rebuilds the demo from scratch up to `stage` (default: "setup").
 * Only the demo hackathon's records and the demo accounts' notifications are
 * touched; nothing else on the platform changes.
 */
export function resetDemo(stage = 'setup') {
  const index = DEMO_STAGES.findIndex((s) => s.key === stage);
  if (index < 0) throw new Error(`Unknown demo stage "${stage}".`);
  ensureAccounts();
  store.purgeHackathonActivity(DEMO_IDS.hackathon, DEMO_ACCOUNTS.map((a) => a.id));
  ensureHackathon();
  // Committee bindings are re-made each reset so the redemption is real.
  for (const key of ['screening', 'judge1', 'judge2']) {
    const user = store.findUserById(account(key).id);
    user.assignedHackathonIds = (user.assignedHackathonIds || []).filter((h) => h !== DEMO_IDS.hackathon);
  }
  ensureCommittee();
  for (const s of DEMO_STAGES.slice(1, index + 1)) STEPS[s.key]();
  currentStage = stage;
  return demoStatus();
}

/** Creates the demo at startup if it doesn't exist yet; never resets progress. */
export function ensureDemo() {
  if (!demoEnabled()) return null;
  const exists = store.getAllHackathons().some((h) => h.id === DEMO_IDS.hackathon);
  if (!exists) return resetDemo('setup');
  ensureAccounts();
  ensureCommittee();
  return demoStatus();
}

/** Where the scenario currently is, derived from the live records. */
export function detectStage() {
  const hackathon = store.getAllHackathons().find((h) => h.id === DEMO_IDS.hackathon);
  if (!hackathon) return null;
  if (hackathon.resultsPublished) return 'published';
  const team = store.findTeamById(DEMO_IDS.team) || store.getTeamsByHackathon(DEMO_IDS.hackathon)[0];
  const submission = team ? store.getSubmissionByTeamId(team.id) : null;
  if (team && submission) {
    const progress = store.getJudgingProgress(team.id);
    if (progress.status === 'complete') return 'judged';
    if (team.screeningStatus === 'shortlisted') return 'shortlisted';
    return 'submitted';
  }
  if (team) return 'team';
  const regs = store.registrations.filter((r) => r.hackathonId === DEMO_IDS.hackathon);
  return regs.length ? 'registered' : 'setup';
}

export function demoStatus() {
  const hackathon = store.getAllHackathons().find((h) => h.id === DEMO_IDS.hackathon);
  const team = store.findTeamById(DEMO_IDS.team) || (hackathon ? store.getTeamsByHackathon(DEMO_IDS.hackathon)[0] : null);
  const codes = hackathon ? store.getCodesForHackathon(DEMO_IDS.hackathon) : [];
  currentStage = detectStage();
  return {
    enabled: demoEnabled(),
    stage: currentStage,
    stages: DEMO_STAGES,
    ids: {
      hackathonId: DEMO_IDS.hackathon,
      teamId: team?.id || null,
      teamCode: team?.teamCode || null,
      submissionId: team ? store.getSubmissionByTeamId(team.id)?.id || null : null,
    },
    accessCodes: Object.fromEntries(codes.map((c) => [c.role, c.code])),
    accounts: DEMO_ACCOUNTS.map(({ key, id, email, fullName, role }) => ({ key, id, email, fullName, role })),
    progress: hackathon ? store.getHackathonProgress(DEMO_IDS.hackathon) : null,
  };
}
