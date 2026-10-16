# Cloud sync verification

## Automated checks

The latest run passed 38 cloud-browser scenarios, 74 existing companion/task/timer/browser checks, and the real PostgreSQL privacy/concurrency suite. Hosted integration remains unverified as described below.

- `node --check cloud-sync.js`
- `tests/cloud-database.cjs` executes the actual setup SQL in PostgreSQL (PGlite): two-user row-level isolation, anonymous read/write denial, denial of direct authenticated updates/deletes, actor ownership, compare-and-swap revision conflicts, invalid/oversized payload rejection, and preservation of the other user's data.
- `tests/cloud-browser.py` runs the actual app in Chromium with mocked Supabase Auth/REST endpoints. It covers local-only continuity, explicit task migration, two browser contexts with the same account, an independent sister account, polling/manual sync, draft protection, conflict backups/resolution, offline changes/reload, sign-out, cross-tab account changes, late-response account races, closed-tab recovery, expired sessions, setup errors, recovery token cleanup and password update, validation/escaping, custom categories/due dates, existing focus timer, and responsive account controls.

Tests send no real email and create no hosted users. PGlite and Playwright are verification tools only; the app adds no dependencies or frameworks. The browser suite uses mock accounts `owner@example.com` and `sister@example.com`.

## Screenshots

- [Desktop signed-in account](screenshots/cloud-account-1440.png)
- [Mobile account controls](screenshots/cloud-account-390.png)
- [Narrow mobile account controls](screenshots/cloud-account-320.png)

## Material limits

Live Supabase endpoints were unreachable from this execution environment (outbound proxy 403). The supplied publishable key, hosted table deployment, hosted email configuration/delivery, and end-to-end hosted sessions could not be verified here. Run the dashboard setup and live checklist in [SETUP.md](SETUP.md) before publishing or relying on sync.

Sync uses whole-list snapshots with explicit conflict resolution, not automatic per-task merging or live collaboration. It pauses applying remote updates while the user has an unsaved draft. Local caching does not install an offline service worker; reopening the site still needs the browser to have the page available. Appearance and the active timer remain device-local.

## Run the checks

From the repository root, using development tools installed outside the application:

```sh
node --check cloud-sync.js
# Install the SQL verification engine in a scratch directory (not an app dependency).
npm install --prefix work/db-test --no-audit --no-fund @electric-sql/pglite
NODE_PATH="$PWD/work/db-test/node_modules" node tests/cloud-database.cjs
# Requires Python Playwright and Chromium (/usr/bin/chromium).
python tests/cloud-browser.py
```

Browser test output/screenshots are written under `work/`. No production secrets or real passwords are needed.

## Rollback

Revert the feature commit to return to local-only behaviour. It retains the original `kikiFocusOS` key and backup format; the guest data is never migrated out of it. Export each signed-in list before rollback if you want that cloud data in the local-only app. The Supabase table can remain private and unused; no automatic destructive database rollback is provided.
