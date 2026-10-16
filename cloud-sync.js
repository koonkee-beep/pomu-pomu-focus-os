/* Optional account sync. No framework/SDK; legacy guest storage stays untouched. */
(() => {
  'use strict';
  const config = window.POMU_CLOUD_CONFIG;
  const SESSION_KEY = 'pomuCloudSession';
  const TAB_KEY = 'pomuCloudTab';
  const $ = id => document.getElementById(id);
  const clone = value => structuredClone(value);
  let tabId;
  try { tabId = sessionStorage.getItem(TAB_KEY) || crypto.randomUUID(); sessionStorage.setItem(TAB_KEY, tabId); }
  catch { tabId = crypto.randomUUID(); }
  let session = null, user = null, epoch = 0, revision = 0, dirty = false;
  let ready = false, busy = false, authBusy = false, conflict = null, sequence = 0;
  let pendingTimer = null, refreshPromise = null, lastStatus = 'Local only — saved in this browser.';
  let cacheWarning = '', recovery = false, recoveredCache = null, lastFailed = false, waitingRemote = false;

  function storageGet(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
  function storageSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function cacheKey() { return `pomuCloudCache:${user.id}:${tabId}`; }
  function emptyList() { return { tasks: [], categories: [...DEFAULT_CATEGORIES], inbox: [], parking: [], focusMinutes: {}, anchor: '' }; }
  function numeric(value) { return typeof value === 'number' && Number.isFinite(value); }
  function validList(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (!['tasks', 'inbox', 'parking'].every(k => Array.isArray(value[k]))) return false;
    if (!value.focusMinutes || typeof value.focusMinutes !== 'object' || Array.isArray(value.focusMinutes)
      || Object.values(value.focusMinutes).some(v => !numeric(v) || v < 0)) return false;
    if (value.anchor !== undefined && typeof value.anchor !== 'string') return false;
    if (value.categories !== undefined && (!Array.isArray(value.categories) || value.categories.some(v => typeof v !== 'string'))) return false;
    if (value.tasks.some(t => !t || !numeric(t.id) || typeof t.title !== 'string' || typeof t.project !== 'string'
      || ![1, 2, 3].includes(t.priority) || !numeric(t.estimate) || t.estimate < 0 || typeof t.done !== 'boolean'
      || !['todo', 'doing', 'waiting', 'done'].includes(t.status)
      || (t.due !== '' && (typeof t.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.due))))) return false;
    return ['inbox', 'parking'].every(k => value[k].every(t => t && numeric(t.id) && typeof t.text === 'string'
      && (t.type === undefined || typeof t.type === 'string') && (t.processed === undefined || typeof t.processed === 'boolean')));
  }
  function readList(value) {
    if (!validList(value)) throw new Error('This list could not be read safely. Export your local backup and contact the app owner.');
    return normalizeCategories(clone(value));
  }
  function status(message) { lastStatus = message; paint(); }
  function paint() {
    if (!$('cloudStatus')) return;
    $('cloudSummary').hidden = !user;
    $('cloudSummary').textContent = conflict || lastFailed ? 'Sync needs attention' : busy ? 'Syncing…' : dirty ? 'Sync pending' : waitingRemote ? 'Updates waiting' : ready ? 'Account synced' : 'Check account sync';
    $('cloudStatus').textContent = lastStatus + (cacheWarning ? ` ${cacheWarning}` : '');
    $('cloudAccount').textContent = user ? `Signed in as ${user.email || 'your account'}` : 'Use the same account on your laptop and phone.';
    $('cloudAuthForm').hidden = !!user;
    $('cloudSignedIn').hidden = !user;
    $('cloudConflict').hidden = !conflict;
    $('cloudRecovery').hidden = !recovery || !user;
    $('cloudLocalCopy').hidden = !user || !localStorage.getItem('kikiFocusOS');
    $('cloudSyncNow').disabled = busy || !!conflict;
    $('cloudLocalCopy').disabled = busy || !ready || !!conflict;
    $('cloudSignOut').disabled = authBusy;
    const pending = pendingCopies();
    $('cloudPending').hidden = !user || !pending.length;
    const selected = $('cloudPendingSelect').value;
    $('cloudPendingSelect').replaceChildren(...pending.map(item => new Option(`${item.value.payload.tasks.length} tasks · ${new Date(item.value.savedAt || 0).toLocaleString()}`, item.key)));
    if (pending.some(item => item.key === selected)) $('cloudPendingSelect').value = selected;
    $('cloudAuthForm').querySelectorAll('button').forEach(el => el.disabled = authBusy);
  }
  function cache() {
    if (!user) return;
    try { storageSet(cacheKey(), { payload: db, revision, dirty, savedAt: Date.now() }); cacheWarning = ''; }
    catch { cacheWarning = 'Browser backup is full. Export JSON now to keep a backup.'; }
  }
  function backupCurrent() {
    if (!user) return;
    const key = `pomuCloudBackups:${user.id}`;
    const backups = storageGet(key);
    storageSet(key, [...(Array.isArray(backups) ? backups : []), { savedAt: new Date().toISOString(), payload: clone(db) }].slice(-5));
  }
  function download(value, name) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function stopAccountWork() {
    clearTimeout(pendingTimer); pendingTimer = null;
    clearInterval(breatheHandle); breatheHandle = null;
    resetTimer(focusLengthMin); activeTaskId = null; focusStartedAtSeconds = null;
    exitImmersiveFocus(); cancelCategoryDelete(false); categoryFeedback('');
    $('overlayTaskName').textContent = 'Choose one task';
    // Account boundaries must not retain drafts from another person's list.
    ['taskTitle', 'taskDue', 'inboxText', 'distraction', 'overlayDistraction', 'newCategoryName', 'cloudPassword', 'cloudNewPassword'].forEach(id => $(id).value = '');
  }
  function applyList(value) {
    db = readList(value);
    if (activeTaskId && !db.tasks.some(t => String(t.id) === String(activeTaskId))) {
      resetTimer(focusLengthMin); activeTaskId = null; exitImmersiveFocus();
    }
    renderAll();
  }
  function hasDrafts() {
    return document.activeElement?.matches('input,textarea,select,[contenteditable=true]')
      || $('tomorrowAnchor').value !== (db.anchor || '')
      || [...document.querySelectorAll('.category-row input')].some((el, i) => el.value !== db.categories[i]);
  }
  function persist() {
    if (!user) return false;
    dirty = true; sequence++; cache();
    status(conflict ? 'Both devices have changes. Choose a copy below; your changes are kept here.' : 'Saved on this device — sync pending.');
    clearTimeout(pendingTimer); pendingTimer = setTimeout(syncNow, 600);
    return true;
  }
  function errorMessage(error) {
    if (error.status === 401 || error.status === 403) return 'Your session needs attention. Export any pending changes, then sign out and sign in again.';
    if (error.status === 404 || error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205') return 'Cloud setup is not complete yet. Your list is kept on this device; ask the app owner to run the setup SQL.';
    return error.message || 'Could not connect. Your changes are kept on this device; try Sync now when online.';
  }
  async function request(path, { method = 'GET', body, token } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(config.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        // Never expose server response bodies or tokens in the UI/logs.
        const err = new Error(response.status === 429 ? 'Too many attempts. Please wait before trying again.' : response.status >= 500 ? 'Cloud is temporarily unavailable. Your changes are kept on this device.' : 'The request could not be completed. Check your sign-in details and project setup.');
        err.status = response.status; err.code = data?.code; throw err;
      }
      return data;
    } catch (error) {
      if (error instanceof TypeError || error.name === 'AbortError') throw new Error('You appear to be offline or the connection timed out. Your changes are kept on this device.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function saveSession(value) {
    if (!value?.access_token || !value.refresh_token) throw new Error('Could not read the sign-in session.');
    const next = { access_token: value.access_token, refresh_token: value.refresh_token,
      expires_at: value.expires_at || Math.floor(Date.now() / 1000) + (value.expires_in || 3600), user: value.user };
    storageSet(SESSION_KEY, next);
    session = next;
  }
  async function token() {
    if (!session) throw new Error('Sign in again to sync. Your changes remain on this device.');
    if (session.expires_at > Date.now() / 1000 + 45) return session.access_token;
    if (!refreshPromise) {
      const refresh = async () => {
        const existing = storageGet(SESSION_KEY);
        if (!existing || existing.user?.id !== user?.id) throw new Error('Your account changed in another tab. Sign in again.');
        if (existing.expires_at > Date.now() / 1000 + 45) { session = existing; return; }
        const generation = epoch;
        const fresh = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: existing.refresh_token } });
        if (generation !== epoch) return;
        if (fresh.user?.id !== user?.id) throw new Error('Could not verify the refreshed account.');
        saveSession(fresh);
      };
      refreshPromise = (navigator.locks ? navigator.locks.request('pomu-auth-refresh', refresh) : refresh()).finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
    return session?.access_token;
  }
  async function remoteList() {
    const authToken = await token();
    const rows = await request(`/rest/v1/pomu_snapshots?select=payload,revision&user_id=eq.${encodeURIComponent(user.id)}`, { token: authToken });
    if (!Array.isArray(rows) || rows.length > 1) throw new Error('Cloud returned an unreadable list. Local changes are safe.');
    if (!rows.length) return { payload: emptyList(), revision: 0 };
    if (!Number.isSafeInteger(rows[0].revision) || rows[0].revision < 1) throw new Error('Cloud returned an unreadable revision.');
    return { payload: readList(rows[0].payload), revision: rows[0].revision };
  }
  async function syncNow() {
    if (!user || busy || conflict) return;
    const generation = epoch;
    busy = true; lastFailed = false; paint();
    try {
      if (!ready || !dirty) {
        const remote = await remoteList();
        if (generation !== epoch) return;
        if (dirty && remote.revision !== revision) { conflict = remote; status('Both devices have changes. Choose which copy to keep.'); return; }
        if (!dirty && remote.revision !== revision) {
          if (hasDrafts()) { waitingRemote = true; status('Cloud updates are ready. Finish editing, then choose Sync now.'); return; }
          backupCurrent(); applyList(remote.payload); waitingRemote = false; revision = remote.revision; cache();
        }
        ready = true;
      }
      if (dirty) {
        const payload = readList(db), savedSequence = sequence;
        const authToken = await token();
        if (generation !== epoch) return;
        const next = await request('/rest/v1/rpc/pomu_write_snapshot', { method: 'POST', token: authToken, body: { p_expected_revision: revision, p_payload: payload } });
        if (generation !== epoch) return;
        if (next === null) { const remote = await remoteList(); if (generation === epoch) { conflict = remote; status('Another device saved first. Choose a copy; nothing has been overwritten.'); } return; }
        if (!Number.isSafeInteger(next) || next <= revision) throw new Error('Cloud did not confirm the save. Your local copy is retained.');
        revision = next; dirty = sequence !== savedSequence; cache();
        if (recoveredCache && JSON.stringify(storageGet(recoveredCache.key)) === recoveredCache.source) { localStorage.removeItem(recoveredCache.key); recoveredCache = null; }
      }
      status(dirty ? 'Saved on this device — more changes waiting to sync.' : 'Synced with your account.');
    } catch (error) { if (generation === epoch) { lastFailed = true; status(errorMessage(error)); } }
    finally {
      if (generation === epoch) { busy = false; paint(); if (dirty && !conflict && ready) { clearTimeout(pendingTimer); pendingTimer = setTimeout(syncNow, 10000); } }
    }
  }
  async function enterSession(value) {
    const generation = ++epoch;
    busy = false; ready = false; conflict = null; lastFailed = false; waitingRemote = false;
    const verified = await request('/auth/v1/user', { token: value.access_token });
    if (generation !== epoch) return;
    if (!verified?.id || !/^[0-9a-f-]{36}$/i.test(verified.id)) throw new Error('Could not verify your account.');
    const saved = storageGet(`pomuCloudCache:${verified.id}:${tabId}`);
    if (saved && (!validList(saved.payload) || !Number.isSafeInteger(saved.revision) || saved.revision < 0)) throw new Error('This device has an unreadable account cache. Keep a backup before continuing.');
    const nextUser = { id: verified.id, email: verified.email };
    saveSession({ ...value, user: nextUser });
    stopAccountWork(); user = nextUser;
    revision = saved?.revision || 0;
    dirty = !!saved?.dirty; sequence = 0; cacheWarning = ''; recoveredCache = null;
    applyList(saved ? saved.payload : emptyList());
    status('Signed in — checking your cloud list.');
    await syncNow();
  }
  async function authenticate(event, action) {
    event.preventDefault();
    if (authBusy) return;
    const form = $('cloudAuthForm');
    const email = $('cloudEmail').value.trim(), password = $('cloudPassword').value;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status('Enter your email address.'); return; }
    if (action !== 'recover' && !form.reportValidity()) return;
    if (action === 'signup' && password.length < 8) { status('Choose a password with at least 8 characters.'); return; }
    authBusy = true; paint();
    let generation = epoch;
    try {
      const redirect = location.origin + location.pathname;
      if (action === 'recover') {
        await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, { method: 'POST', body: { email } });
        if (generation === epoch) status('If that account exists, a password-reset email is on its way.');
      } else {
        const result = await request(action === 'signup' ? `/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}` : '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
        if (generation !== epoch) return;
        if (result?.access_token) { const entering = enterSession(result); generation = epoch; await entering; }
        else status('Check your email to confirm your account, then sign in here.');
      }
    } catch (error) { if (generation === epoch) status(errorMessage(error)); }
    finally { $('cloudPassword').value = ''; authBusy = false; paint(); }
  }
  async function signOut(localOnly = false) {
    if (!user || (authBusy && !localOnly)) return;
    const oldToken = session?.access_token;
    cache(); const oldKey = cacheKey(), pending = dirty;
    ++epoch; stopAccountWork(); user = null; session = null; busy = false; ready = false; dirty = false; conflict = null; recovery = false;
    if (!localOnly) localStorage.removeItem(SESSION_KEY);
    if (!pending) localStorage.removeItem(oldKey);
    applyList(storageGet('kikiFocusOS') || clone(DEFAULT));
    status(pending ? 'Signed out. Pending account edits are kept on this device for your next sign-in. Local-only list restored.' : 'Signed out — local-only list restored.');
    if (oldToken && !localOnly) request('/auth/v1/logout?scope=local', { method: 'POST', token: oldToken }).catch(() => {});
  }
  async function copyLocal() {
    if (!user || !ready || busy || conflict) return;
    try {
      const local = readList(storageGet('kikiFocusOS'));
      const hasAccountData = db.tasks.length || db.inbox.length || db.parking.length || db.anchor || Object.keys(db.focusMinutes).length || revision;
      if (hasAccountData && !confirm('Replace your account list on all devices with this browser’s local-only list? Export a backup first if you want to keep both. Your original local-only list will remain here.')) return;
      backupCurrent(); applyList(local); persist(); await syncNow();
    } catch (error) { status(errorMessage(error)); }
  }
  async function resolveConflict(useLocal) {
    if (!user || !conflict || busy) return;
    if (!confirm(useLocal ? 'Replace the cloud list with this device’s copy? The cloud copy will be downloaded as a backup.' : 'Use the cloud copy? Your device’s pending copy will be downloaded as a backup.')) return;
    const remote = conflict;
    if (useLocal) download(remote.payload, 'pomu-cloud-before-replacement.json');
    else { download(db, 'pomu-device-before-replacement.json'); backupCurrent(); applyList(remote.payload); }
    revision = remote.revision; dirty = useLocal; sequence++; conflict = null; ready = true; cache();
    status(useLocal ? 'Saving this device’s copy.' : 'Cloud copy loaded.'); await syncNow();
  }

  function pendingCopies() {
    if (!user) return [];
    const prefix = `pomuCloudCache:${user.id}:`, values = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix) || key === cacheKey()) continue;
      const value = storageGet(key);
      if (value?.dirty && validList(value.payload) && Number.isSafeInteger(value.revision)) values.push({ key, value });
    }
    return values.sort((a, b) => (b.value.savedAt || 0) - (a.value.savedAt || 0));
  }
  async function restorePending() {
    if (!user || busy) return;
    const pending = pendingCopies().find(item => item.key === $('cloudPendingSelect').value);
    if (!pending || !confirm('Load this device’s pending copy? Your current account list will be downloaded as a backup. Sync will check for newer cloud changes before saving.')) return;
    download(db, 'pomu-before-recovering-pending-copy.json'); backupCurrent();
    applyList(pending.value.payload); revision = pending.value.revision; dirty = true; sequence++;
    ready = false; conflict = null; recoveredCache = { key: pending.key, source: JSON.stringify(pending.value) };
    cache(); status('Recovered pending edits — checking the cloud before saving.'); await syncNow();
  }

  async function changePassword(event) {
    event.preventDefault();
    const password = $('cloudNewPassword').value;
    if (password.length < 8) return;
    const generation = epoch;
    try {
      await request('/auth/v1/user', { method: 'PUT', token: await token(), body: { password } });
      if (generation === epoch) { recovery = false; status('Password updated.'); }
    } catch (error) { if (generation === epoch) status(errorMessage(error)); }
    finally { $('cloudNewPassword').value = ''; }
  }
  async function init() {
    $('cloudAuthForm').addEventListener('submit', event => authenticate(event, 'signin'));
    $('cloudSignUp').addEventListener('click', event => authenticate(event, 'signup'));
    $('cloudRecover').addEventListener('click', event => authenticate(event, 'recover'));
    $('cloudSignOut').addEventListener('click', () => signOut());
    $('cloudPendingRestore').addEventListener('click', restorePending);
    $('cloudSyncNow').addEventListener('click', syncNow);
    $('cloudSummary').addEventListener('click', () => go('settings'));
    $('cloudLocalCopy').addEventListener('click', copyLocal);
    $('cloudUseRemote').addEventListener('click', () => resolveConflict(false));
    $('cloudUseLocal').addEventListener('click', () => resolveConflict(true));
    $('cloudExportPending').addEventListener('click', () => download(db, 'pomu-device-copy.json'));
    $('cloudRecovery').addEventListener('submit', changePassword);
    $('cloudBackupDownload').addEventListener('click', () => {
      const backups = user && storageGet(`pomuCloudBackups:${user.id}`);
      if (backups?.length) download(backups[backups.length - 1].payload, 'pomu-previous-account-copy.json');
      else status('No previous account copy is stored in this browser yet.');
    });
    window.addEventListener('storage', event => {
      if (event.key !== SESSION_KEY) return;
      const stored = storageGet(SESSION_KEY);
      if (!stored) { if (user) signOut(true); else ++epoch; }
      else if (stored.user?.id !== user?.id) {
        if (user) signOut(true); else ++epoch;
        status('The account changed in another tab. Sign in here to continue.');
      } else session = stored;
    });
    paint();
    // Supabase confirmation/recovery uses a URL fragment. Remove tokens immediately.
    const hash = new URLSearchParams(location.hash.slice(1));
    const callback = hash.get('access_token') && hash.get('refresh_token');
    if (callback || hash.has('error')) history.replaceState(null, '', location.pathname + location.search);
    try {
      if (hash.has('error')) { status('The sign-in link expired or was not accepted. Request another email.'); return; }
      if (callback) {
        const isRecovery = hash.get('type') === 'recovery';
        await enterSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'), expires_in: Number(hash.get('expires_in')) || 3600 });
        recovery = isRecovery; go('settings'); paint();
      } else {
        const stored = storageGet(SESSION_KEY), generation = epoch;
        if (stored?.access_token) {
          let value = stored;
          if (stored.expires_at <= Date.now() / 1000 + 45) {
            value = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: stored.refresh_token } });
          }
          if (generation !== epoch) return;
          await enterSession(value);
        }
      }
    } catch (error) { status(errorMessage(error)); }
    setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 10000);
    window.addEventListener('online', syncNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });

  }
  window.PomuSync = Object.freeze({ init, persist, isSignedIn: () => !!user, backupCurrent, validList });
})();
