# HackTrack demo guide — one event, one team, every panel

The server creates a shared demonstration scenario on startup (and never resets it on restart):

| Record | Value |
|---|---|
| Event | **HackTrack Innovation Challenge** (`hack-demo-2026`), published, registration open |
| Team | **Team Apex Innovators** (`team-demo-apex` when built by a stage jump) |
| Project | **EcoTrack AI** (`sub-demo-ecotrack` when built by a stage jump) |
| Rubric | Innovation 30 · Technical Execution 30 · Impact & Sustainability 25 · Presentation 15 (= 100) |

Every dashboard reads these records from the backend, so the same team, members, submission and statuses appear everywhere.

## Accounts (fictional; password `password123`, like every seeded demo account)

| Role | Name | Email |
|---|---|---|
| Organizer | Riya Kapoor | organizer@demo.hacktrack.io |
| Screening committee | Arjun Mehta | screening@demo.hacktrack.io |
| Judge | Dr. Leela Nair | judge.nair@demo.hacktrack.io |
| Judge | Prof. Daniel Fernandes | judge.fernandes@demo.hacktrack.io |
| Team leader | Aanya Sharma | aanya.leader@demo.hacktrack.io |
| Member | Kabir Rao | kabir.member@demo.hacktrack.io |
| Member | Meera Iyer | meera.member@demo.hacktrack.io |
| Platform admin | Sarah Jenkins | admin@hacktrack.io |

The login page lists these under **Shared demo**: click one to fill in its email. Emails are never sent to `@demo.hacktrack.io`; the in-app notifications still appear.

## Running the demo live (from "Event published")

1. **Registration**: sign in as Aanya, open the event from *Discover*, then click *Register*. In *Team & roster*, create "Team Apex Innovators" and copy the invite code. Then Kabir and Meera each register and use *Join with team code*. Back as Aanya, *Accept* both.
   - The Organizer card for the event shows 3 registrations and 3 participants; the Admin view (*Hackathons → Inspect*) lists the team and the registrations.
2. **Submission**: as Aanya, in *Project submission*, enter EcoTrack AI and click *Finalize*. Kabir and Meera now see the same submission, and it appears in Arjun's *Screening Review Queue*.
3. **Screening**: as Arjun, open the entry, add remarks (shared with the team) and an optional internal note (never shown to the team), then click *Shortlist team*.
   - All three members get a notification and see "Shortlisted" with the remarks.
   - Both judges are assigned automatically.
4. **Judging**: as Dr. Nair (then Prof. Fernandes), the Judge dashboard shows EcoTrack AI with the real rubric. Score it and *Commit & certify*. Members see "1 of 2 judges", but no scores; the Organizer card shows judging progress.
5. **Results**: as Riya, click *Publish results* on the event card.
   - Members see the total, the per-criterion averages, the judges' feedback and their rank, plus a Winner certificate under *Certificates*.
   - The Admin view shows the results as released.

## Jumping between stages

As admin, open **Admin → Demo scenario** and choose *Jump here* on any stage:
- Event published
- Participants registered
- Team formed
- Project submitted
- Screening passed
- Judging complete
- Results published

A jump rebuilds only the demo event's records, using the same business operations the API uses, with fixed IDs. API equivalent: `POST /api/v1/demo/reset {"stage":"shortlisted"}` (admin token).

## Notes

- `DEMO_MODE=false` disables the scenario. In production it is off unless `DEMO_MODE=true`.
- Without MySQL the server keeps data in memory, so a server restart recreates the demo at "Event published".
