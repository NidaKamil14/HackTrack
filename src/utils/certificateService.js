const STORAGE_KEY = "hacktrack_certificates";

const DEFAULT_CERTIFICATES = [
  {
    certificateId: "HT-CERT-DP26-AC42",
    recipientName: "Alex Chen",
    recipientEmail: "alex@university.edu",
    teamName: "AsyncCoders",
    projectTitle: "ResilientQueue Engine",
    hackathonId: "devpulse-2026",
    hackathonTitle: "DevPulse National Sprint",
    track: "Full-Stack & Cloud Systems",
    issueDate: "October 20, 2026",
    awardTitle: "Grand Prize Champion (1st Place)",
    rank: "1st Place",
    score: 96,
    verificationCode: "HT-VERIFY-88219-DP26",
    signedBy: "HackTrack Governance Committee & ACM Review Panel"
  },
  {
    certificateId: "HT-CERT-AI99-SJ01",
    recipientName: "Sarah Jenkins",
    recipientEmail: "sarah.jenkins@example.com",
    teamName: "NeuralShift",
    projectTitle: "Agentic Autonomous Workflow Engine",
    hackathonId: "ai-catalyst-2026",
    hackathonTitle: "AI Catalyst Challenge",
    track: "Applied Machine Learning & Agents",
    issueDate: "October 05, 2026",
    awardTitle: "Runner-Up Finalist (2nd Place)",
    rank: "2nd Place",
    score: 95,
    verificationCode: "HT-VERIFY-99214-AI26",
    signedBy: "HackTrack AI Review Board"
  }
];

export function getAllCertificates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CERTIFICATES));
      return DEFAULT_CERTIFICATES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_CERTIFICATES;
  } catch {
    return DEFAULT_CERTIFICATES;
  }
}

export function saveAllCertificates(certs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(certs));
  } catch (err) {
    console.error("Failed to save certificates:", err);
  }
}

export function getUserCertificates(userEmail) {
  if (!userEmail) return [];
  const cleanEmail = userEmail.toLowerCase().trim();
  const all = getAllCertificates();
  return all.filter((c) => c.recipientEmail && c.recipientEmail.toLowerCase().trim() === cleanEmail);
}

export function issueCertificate({
  recipientName,
  recipientEmail,
  teamName,
  projectTitle,
  hackathonId,
  hackathonTitle,
  track,
  awardTitle,
  rank,
  score
}) {
  const all = getAllCertificates();
  const certId = `HT-CERT-${hackathonId.toUpperCase().substring(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newCert = {
    certificateId: certId,
    recipientName,
    recipientEmail: (recipientEmail || "").toLowerCase().trim(),
    teamName: teamName || "Team",
    projectTitle: projectTitle || "Hackathon Project",
    hackathonId,
    hackathonTitle,
    track: track || "General Track",
    issueDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    awardTitle: awardTitle || "Certificate of Participation",
    rank: rank || "Participant",
    score: score || 0,
    verificationCode: `HT-VERIFY-${Math.floor(10000 + Math.random() * 90000)}`,
    signedBy: "HackTrack Governance Committee"
  };

  const updated = [newCert, ...all];
  saveAllCertificates(updated);
  return newCert;
}
