# POMU POMU Focus OS — local prototype

**POMU POMU · Do One Thing**

A single-user, local-first work management prototype derived from the workflow shown in the supplied video:

1. Reduce context switching with a single active task and focus timer.
2. Capture interruptions immediately instead of switching tasks.
3. Keep one structured task inventory with status, project, priority, estimate, and due date.
4. Capture ideas/notes quickly, then triage them later.
5. Use a deliberate end-of-day shutdown review to close loops.

## Run

Open `index.html` in Chrome/Edge. No install is required.

The app stores local-only data in browser `localStorage`. Optional **Data → Your account & sync** adds private cross-device lists with Supabase. See [cloud setup](docs/cloud-sync/SETUP.md) before enabling it. Use **Data → Export JSON** for backups.

## Current modules

- Today: automatic Now / Next prioritisation + live board
- Tasks: project, priority, estimate, due date, workflow status
- Focus: 25/50 minute timer + distraction parking lot
- Inbox / Ideas: rapid capture + heuristic auto-triage
- Shutdown: end-of-day review and tomorrow anchor
- Export/import: local JSON backup

## Recommended production upgrade

Optional future integrations (the current private sync does not require a frontend rewrite):

- Frontend: Next.js / React
- Database: Supabase Postgres
- Real-time: Supabase Realtime
- Auth: Supabase Auth
- AI triage: OpenAI API structured outputs
- Calendar sync: Google Calendar
- Notification layer: email / Telegram / Slack / mobile push
- Audit/export: immutable activity log + CSV/JSON export

Never put AI provider keys or Supabase secret/service-role keys in the browser. The Supabase publishable key is public; database access is enforced by authentication and row-level rules. Route any future AI calls through a backend/edge function.


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

## V1.3 custom task categories

In **Tasks**, choose **Manage Categories** next to the category dropdown to add, rename, or delete categories. Names are trimmed and must be nonempty and unique (ignoring case). The original seven categories remain the starting defaults; your changes persist in this browser.

Renaming updates every assigned task, including completed tasks. Deletion asks you to confirm and, when tasks use the category, lets you move them to another category or **Uncategorized**. It never deletes tasks. Uncategorized is always available, even if you remove every category. Inbox triage uses Personal when it exists and Uncategorized otherwise.

Categories are included in the existing JSON export under `categories`, alongside the unchanged task `project` field. Older backups without category settings receive the defaults plus any custom project names already used by their tasks. Importing a backup replaces the current dataset as before. An explicitly empty category list stays empty unless imported tasks reference category names that need to be recovered.


## Optional private cloud sync

Email/password sign-in, per-account lists, local-data copying, offline pending edits, and explicit cross-device conflict resolution are implemented without an SDK or app dependencies. The public project settings are in `cloud-config.js`; the owner-only database schema is in `supabase/setup.sql`.

[Set up the Supabase project](docs/cloud-sync/SETUP.md) · [Verification and limits](docs/cloud-sync/VERIFICATION.md). Your original local-only data and JSON backup format are retained.


## Keep the focus screen awake

While the immersive focus timer is running and its tab is visible, the app requests a screen wake lock on supported HTTPS browsers. Pausing, completing, resetting, leaving the focus screen, or hiding the page releases the lock. Returning to a running focus screen requests it again. The timer remains usable when wake lock is unsupported or refused; the focus screen shows a short status and, when appropriate, a retry button.

The browser/device can release or refuse keep-awake (for example, power-saving restrictions). It cannot override manually locking the device or keep the screen awake in another app. Physical iPad Safari verification is still needed. No timer accounting, task storage, or cloud sync changes are introduced.
