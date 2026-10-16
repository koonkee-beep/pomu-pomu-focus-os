# Kiki Focus OS — local prototype

A single-user, local-first work management prototype derived from the workflow shown in the supplied video:

1. Reduce context switching with a single active task and focus timer.
2. Capture interruptions immediately instead of switching tasks.
3. Keep one structured task inventory with status, project, priority, estimate, and due date.
4. Capture ideas/notes quickly, then triage them later.
5. Use a deliberate end-of-day shutdown review to close loops.

## Run

Open `index.html` in Chrome/Edge. No install is required.

The app stores data in browser `localStorage`. Use **Data → Export JSON** for backups.

## Current modules

- Today: automatic Now / Next prioritisation + live board
- Tasks: project, priority, estimate, due date, workflow status
- Focus: 25/50 minute timer + distraction parking lot
- Inbox / Ideas: rapid capture + heuristic auto-triage
- Shutdown: end-of-day review and tomorrow anchor
- Export/import: local JSON backup

## Recommended production upgrade

For a true multi-device real-time system:

- Frontend: Next.js / React
- Database: Supabase Postgres
- Real-time: Supabase Realtime
- Auth: Supabase Auth
- AI triage: OpenAI API structured outputs
- Calendar sync: Google Calendar
- Notification layer: email / Telegram / Slack / mobile push
- Audit/export: immutable activity log + CSV/JSON export

Do not put an API key directly in the browser. Route AI calls through a backend/edge function.


## V1 focus experience

The prototype now includes an immersive breathing-focus screen:

- full-screen breathing orb
- 5-second inhale / 5-second exhale animation
- 3-breath settling transition
- 25 / 50 / 90 minute work blocks
- countdown embedded inside the orb
- one-task-only focus view
- distraction parking without leaving focus mode
- completion action that returns to Today
