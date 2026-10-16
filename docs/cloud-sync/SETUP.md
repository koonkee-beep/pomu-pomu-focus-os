# Set up private POMU POMU cloud sync

This feature is prepared for project `ohbrkopbdfpetwemarnr`. Its URL and **publishable** key are public browser configuration in `cloud-config.js`. No password, secret key, or service-role key belongs in this repository.

The application can stay on GitHub Pages. You and your sister use separate app accounts; each account has its own list. The same email/password account on your laptop and phone loads the same cloud list.

## 1. Create the database table and privacy rules

1. Open your [Supabase project](https://supabase.com/dashboard/project/ohbrkopbdfpetwemarnr).
2. Open **SQL Editor → New query**.
3. Copy the complete contents of [`supabase/setup.sql`](../../supabase/setup.sql) into the editor and click **Run**.
4. Keep row-level security enabled. Do not add public read/write policies or grants.

The script creates one snapshot per authenticated user, an owner-only read policy, and a save function which gets the owner from Supabase Auth. Anonymous access and direct table writes are denied. A stale device cannot overwrite another device's newer revision. The SQL is transactional and safe to rerun for this schema.

## 2. Configure email sign-in

In **Authentication**:

1. Keep **Email** authentication enabled and **Confirm email** enabled.
2. In **URL Configuration**, set **Site URL** to:

   `https://koonkee-beep.github.io/pomu-pomu-focus-os/`

3. Add that exact URL to the allowed **Redirect URLs**, including the trailing slash. Leave the default confirmation/password-recovery templates in place; they send users back to the app.
4. Configure **custom SMTP** before inviting your sister or other public users. Supabase's default email sender is for testing and only sends to project team addresses, with a small rate limit. Do not add your sister as a project administrator just to receive emails. SMTP credentials belong in Supabase settings, not the website or chat.

References: [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords), [custom SMTP and its default restrictions](https://supabase.com/docs/guides/auth/auth-smtp), [publishable vs secret keys](https://supabase.com/docs/guides/getting-started/api-keys).

No account or email was created/sent by the implementation tests. Live signup, confirmation delivery, password reset, and the hosted SQL configuration must be checked after completing these dashboard steps. The development environment could not connect to this project because its outbound network policy blocked the domain; that is not evidence that the project itself is broken.

## 3. Publish and move your existing tasks

1. Review and merge the cloud-sync pull request when the dashboard setup is ready. Wait for GitHub Pages to update.
2. On the device holding your current list, open **Data → Export JSON** for a backup.
3. Under **Data → Your account & sync**, create an account. Confirm its email, then sign in.
4. The account starts with its own list. Your browser's local-only list is retained and is **not automatically uploaded**.
5. Choose **Copy local-only list to account** to use your existing tasks. If the account already has a list, this is an explicit replacement on all its devices, with a confirmation. The original local-only list stays in this browser. A previous account copy is available using **Download previous account copy**.
6. On your phone, open the same website and sign in with the same app email/password. Your cloud list appears there. Create a test task and check it on the laptop, then delete it.
7. Your sister creates a different app account. She does not need access to your Supabase dashboard or GitHub repository.

## Daily behaviour

- Changes save in the signed-in device's account cache first and sync shortly afterwards. Other open devices check about every 10 seconds and when brought to the foreground. **Sync now** requests a check immediately.
- Cloud updates wait while you are typing or have an unsaved category/anchor draft. Save or finish that draft, then sync.
- Tasks, categories, due dates, inbox, parking, accumulated focus minutes, and tomorrow's anchor travel together. A running timer and the Professional/Cozy appearance preference stay local to each device.
- Keep the app open and signed in while working offline. Pending edits survive refresh and are sent after you reconnect/sign in. A fresh offline page cannot reverify its account until it reconnects; it does not display another account's cached tasks as a guest list.
- Pending edits from a closed tab are shown under **Pending copy** after your next verified sign-in. Choose **Load pending copy** to recover them. The current list is downloaded as a backup and sync checks for conflicts before saving.
- If both devices edit before syncing, the app stops and asks which complete copy to keep. It does not merge task-by-task. The replaced copy is downloaded as a JSON backup, so you can recover any other edits manually.
- Signing out restores the original local-only list and stops the account's timer. It never copies the account list into guest storage. Sign-out also takes effect in other tabs sharing the same browser session.
- Import JSON and Reset affect the currently selected list. While signed in, those changes also sync to your account. Export before replacing/resetting. Appearance is not part of the JSON backup.
- Local caches and the last five automatic account backups are stored in the browser profile, like the original local-only data. Use separate browser profiles for people sharing a computer; app sign-in is not protection against someone with access to that profile's developer tools/storage.
- Lists up to 2 MiB of JSON are supported by the save function. Oversized lists are rejected with the device copy retained.

## Verify before relying on sync

- Account A on two devices: create a task, change due date/category, and confirm both see it.
- Account B on a different browser profile: confirm it cannot see A's tasks.
- Edit both devices before syncing: confirm the copy-choice panel appears, and export both copies before testing resolution.
- Disconnect a signed-in device, add a task, reconnect, and confirm it syncs.
- Export/Import, email confirmation, password recovery, and sign-out should all work.

If setup fails, keep using the local-only app and JSON backups. A missing table/RPC shows a setup message. Do not disable privacy rules or paste privileged credentials into the app to work around it.
