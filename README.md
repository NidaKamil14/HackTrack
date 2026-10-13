# HackTrack — Hackathon Competition Management System

[![Build & Test](https://img.shields.io/badge/tests-47%20passing-brightgreen.svg)]()
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TailwindCSS-blue.svg)]()
[![Express](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-lightgrey.svg)]()
[![Database](https://img.shields.io/badge/Database-MySQL%20%2B%20Resilient%20Store-orange.svg)]()
[![SRS Compliance](https://img.shields.io/badge/SRS%20v1.0-100%25%20Compliant-success.svg)]()

> **HackTrack** is a centralized, end-to-end hackathon management platform built strictly in compliance with the **Software Requirements Specification (SRS v1.0, PCCOE)**. It unifies the complete hackathon lifecycle: registration, team formation, project submissions, screening, judging rubrics, automated leaderboard generation, certificate issuance, and administrative reporting.

---

## 🚀 Key Features & SRS Traceability

### 1. User Authentication & RBAC (FR-1 to FR-5)
- **FR-1 & FR-2:** Secure registration with unique email constraints, bcrypt salted password hashing (NFR-9), and JWT bearer tokens.
- **FR-3 & FR-4:** Automatic role-based redirects and protected route access guards.
- **FR-5:** End-to-end password reset workflow via timed cryptographic reset tokens.

### 2. Hackathon Management (FR-6 to FR-11, FR-23)
- **FR-6 & FR-8:** Multi-track hackathon creation with customizable team sizes (`min_team_size`, `max_team_size`).
- **FR-7:** Chronological deadline scheduling (`registration_deadline` < `submission_deadline`).
- **FR-9:** Weighted criteria rubric builder (e.g., Innovation, Impact, Technical Execution, UI/UX).
- **FR-10 & FR-11:** State machine transitions (`draft` → `published` → `active` → `closed`) with automated deadline enforcement.

### 3. Team Formation & Join Code Engine (FR-12 to FR-16, BR-1 to BR-3)
- **FR-12 & FR-13:** Only Team Leaders can form teams (BR-1); system generates unique join codes (e.g., `HT-XXXXXX`).
- **FR-14 & FR-15:** Prospective members submit join requests using Team Codes; Team Leaders review and approve/reject.
- **FR-16:** Strict enforcement of 1 team per student per hackathon (BR-2).

### 4. Project Submissions & Deadline Locking (FR-17 to FR-21, BR-8)
- **FR-17 & FR-19:** Team Leader project submission supporting abstract, GitHub repository URL, demo video, and documentation.
- **FR-18 & FR-21:** Hard submission deadline enforcement (BR-8); rejection and locking after submission window closes.

### 5. Multi-Stage Evaluation & Leaderboards (FR-22 to FR-31, BR-4 to BR-7, BR-9)
- **FR-23:** Configurable evaluation workflows (optional Screening Committee and Mentor allocation).
- **FR-24 & FR-25:** Judge assignment matrix; judges only access assigned submissions (BR-7).
- **FR-26 & FR-27:** Rubric-based scoring (0-100 scale) and remarks, locking once finalized.
- **FR-28 & FR-29:** Automated weighted scoring engine and real-time sorted leaderboard generation.
- **FR-30 & FR-31:** Admin result publication (BR-9) and automated participant notification broadcasts.

### 6. Certificates, Analytics & Administration (FR-32 to FR-46)
- **FR-32 to FR-34:** Automated cryptographic certificate issuance upon result publication with public verification (`/api/v1/certificates/verify/:code`).
- **FR-40 to FR-42:** System-wide platform statistics, hackathon audit reports, and user role management.
- **FR-46:** Platform-wide and hackathon-scoped broadcast announcements.

---

## 🏗️ Architecture & Technology Stack

```
HackTrack/
├── src/                          # React 19 Frontend
│   ├── components/               # Reusable UI components & DashboardLayout
│   ├── context/                  # AuthContext (resilient API + localStorage fallback)
│   ├── pages/                    # Public pages & Role-Specific Dashboards
│   │   └── dashboards/           # Student, Leader, Judge, Screening, Mentor, Admin
│   ├── routes/                   # ProtectedRoute & AppRoutes
│   └── utils/                    # api.js client & hackathonService
│
└── server/                       # Express Backend
    ├── src/
    │   ├── app.js                # Express app configuration & middleware
    │   ├── server.js             # HTTP server entrypoint
    │   ├── database/
    │   │   ├── connection.js     # MySQL connection pool
    │   │   ├── schema.sql        # Relational schema (11 tables with constraints)
    │   │   ├── seed.js           # Automated MySQL seed script
    │   │   └── store.js          # Resilient storage layer (MySQL + In-Memory fallback)
    │   ├── middleware/           # auth.js (JWT validation, requireRole guards)
    │   └── routes/               # Modular Express routers (v1 API)
    │       ├── auth.js           # /api/v1/auth
    │       ├── hackathons.js     # /api/v1/hackathons
    │       ├── teams.js          # /api/v1/teams
    │       ├── submissions.js    # /api/v1/submissions
    │       ├── evaluations.js    # /api/v1/evaluations
    │       ├── certificates.js   # /api/v1/certificates
    │       └── admin.js          # /api/v1/admin
    └── test/                     # Native Node.js Test Suite (47 automated tests)
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18+ (Node.js 20+ recommended)
- **npm**: v9+
- **MySQL** (Optional): A running MySQL instance (if omitted, server runs with high-performance in-memory persistence).

### 1. Installation
Clone the repository and install dependencies for both frontend and backend:

```bash
# Clone repository
git clone https://github.com/NidaKamil14/HackTrack.git
cd HackTrack

# Install Frontend dependencies
npm install

# Install Backend dependencies
cd server
npm install
cd ..
```

### 2. Environment Configuration
Create a `.env` file in `/server` (sample provided below):

```env
PORT=5001
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
JWT_SECRET=hacktrack_super_secret_jwt_key_2026

# Optional: MySQL Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hacktrack_db
```

### 3. Running the Backend Server

```bash
cd server
npm start
# Server listens on http://localhost:5001
```

### 4. Running the Frontend Application

```bash
npm run dev
# Vite runs on http://localhost:5173
```

---

## 🧪 Automated Testing

The backend includes a comprehensive, 47-test automated test suite using native `node:test` covering all SRS business rules:

```bash
cd server
npm test
```

### Test Coverage Highlights
- ✅ **Authentication & RBAC**: Register, duplicate detection, login, `/me` guard, forgot/reset password.
- ✅ **Hackathon Lifecycle**: Chronological deadline validation, team size constraints, rubric definition, publishing.
- ✅ **Team Management & Join Codes**: Leader exclusivity (BR-1), unique team codes, student join approval (BR-3), 1 team constraint (BR-2).
- ✅ **Submissions & Deadlines**: Leader-only submission, deadline locking (BR-8), multi-link project payloads.
- ✅ **Judge Scoring & Leaderboard**: Judge assignment matrix (BR-7), rubric scoring (0-100), automated ranking, publishing (BR-9).
- ✅ **Admin & Certificates**: User management, system metrics, hackathon reports, announcements, certificate verification.

---

## 🔑 Demo & Test Accounts

All accounts use the default password: `password123`

| Role | Email | Capabilities & Access Codes |
|---|---|---|
| **Platform Admin** | `admin@hacktrack.io` | Platform overview, per-hackathon scoped inspection, user role management |
| **Organizer** | `organizer@hacktrack.io` | Create hackathons, customize weighted rubrics, generate access codes |
| **Team Leader** | `alex@university.edu` | Team creation, join request approval, project deliverable submission |
| **Student** | `priya@university.edu` | Browse hackathons, join teams via Team Code, view certificates |
| **Judge** | `judge@hacktrack.io` | Evaluate shortlisted finalists; unlock via code `JUDGE-DEVPULSE-7X9K` |
| **Screening** | `screening@hacktrack.io` | Verify git freshness & live URLs; unlock via code `SCREEN-DEVPULSE-3M2P` |
| **Mentor** | `mentor@hacktrack.io` | Review student submissions and offer guidance |

---

## 🔒 Core Business Rules & Integrity Constraints

* **BR-1 (Team Creation Exclusivity)**: Only users registered with the Team Leader role can sanction and create squads.
* **BR-2 (Single Team per Hackathon)**: A participant or leader cannot join or create multiple teams within the same competition. (Cross-hackathon participation is allowed).
* **BR-3 (Team Leader Roster Guard)**: Join requests submitted with team codes require explicit leader authorization.
* **BR-4 (Stage-Gated Evaluation Workflow)**:
  1. **Stage 1 (Screening Committee)**: Evaluates raw submissions for git commit freshness, documentation, and live preview URLs. Decisions: `Shortlist ✓` or `Reject ✗`.
  2. **Stage 2 (Judges & Evaluators)**: Evaluates *only shortlisted finalists* against that hackathon's specific weighted rubrics criteria (0–100 total score).
* **BR-5 (Access Code Binding)**: Organizers generate distinct access codes for judges and screening committee members. Entering the code once binds the reviewer to that competition.

---

## 📜 Authors & Academic Affiliation
- **Apoorv Arora**
- **Nida Kamil**
- **Shruti Mane**
- **Mandar Patil**  
*Department of Computer Engineering, Pimpri Chinchwad College of Engineering (PCCOE), Pune.*
