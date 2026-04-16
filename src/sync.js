/**
 * sync.js
 * Lokale Speicherung mit nachvollziehbarem Nextcloud-Sync-Status.
 *
 * Öffentliche API:
 *   getSyncState(storage?)                    → state
 *   getScopeSyncStatus(state, scope)          → status|null
 *   hasPendingSync(state, scope)              → boolean
 *   pendingSyncScopes(state)                  → string[]
 *   markSyncPending(state, scope, path, now)  → state
 *   markSyncSuccess(state, scope, path, now)  → state
 *   markSyncFailure(state, scope, path, err)  → state
 *   markSyncLocalOnly(state, scope, now)      → state
 *   persistJsonWithSync(opts)                 → { ok, remote, sync }
 *   hydrateJsonFromSync(opts)                 → { data, source, sync, remote?, retry? }
 *   syncHinweisText(status, label?)           → string
 */

import { load, save } from './storage.js';

export const STORAGE_KEY_SYNC = 'lo_sync_status';

function nowIso() {
  return new Date().toISOString();
}

function defaultStorage() {
  return { load, save };
}

function cleanState(state) {
  return state && typeof state === 'object' ? state : {};
}

function schreibeSyncState(state, storage = defaultStorage()) {
  storage.save(STORAGE_KEY_SYNC, state);
  return state;
}

export function getSyncState(storage = defaultStorage()) {
  return cleanState(storage.load(STORAGE_KEY_SYNC));
}

export function getScopeSyncStatus(state, scope) {
  const clean = cleanState(state);
  return clean[scope] || null;
}

export function hasPendingSync(state, scope) {
  return !!getScopeSyncStatus(state, scope)?.pending;
}

export function pendingSyncScopes(state) {
  return Object.entries(cleanState(state))
    .filter(([, status]) => status?.pending)
    .map(([scope]) => scope);
}

export function markSyncPending(state, scope, remotePath, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: {
      ...vorher,
      scope,
      remotePath,
      pending: true,
      mode: 'pending',
      lastAttemptAt: now,
    },
  };
}

export function markSyncSuccess(state, scope, remotePath, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: {
      ...vorher,
      scope,
      remotePath,
      pending: false,
      mode: 'synced',
      lastAttemptAt: now,
      lastSuccessAt: now,
      lastError: '',
    },
  };
}

export function markSyncFailure(state, scope, remotePath, error, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: {
      ...vorher,
      scope,
      remotePath,
      pending: true,
      mode: 'pending',
      lastAttemptAt: now,
      lastError: error || 'Unbekannter Sync-Fehler.',
    },
  };
}

export function markSyncLocalOnly(state, scope, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: {
      ...vorher,
      scope,
      pending: false,
      mode: 'local-only',
      lastAttemptAt: now,
      lastError: '',
    },
  };
}

export async function persistJsonWithSync({
  scope,
  storageKey,
  data,
  client,
  remotePath,
  storage = defaultStorage(),
}) {
  storage.save(storageKey, data);

  let state = getSyncState(storage);
  if (!client) {
    state = markSyncLocalOnly(state, scope);
    schreibeSyncState(state, storage);
    return { ok: true, remote: { ok: false, skipped: true }, sync: getScopeSyncStatus(state, scope) };
  }

  state = markSyncPending(state, scope, remotePath);
  schreibeSyncState(state, storage);

  const remote = await client.writeJson(remotePath, data);
  state = remote.ok
    ? markSyncSuccess(state, scope, remotePath)
    : markSyncFailure(state, scope, remotePath, remote.error);
  schreibeSyncState(state, storage);

  return { ok: true, remote, sync: getScopeSyncStatus(state, scope) };
}

export async function hydrateJsonFromSync({
  scope,
  storageKey,
  client,
  remotePath,
  isValidRemote = () => true,
  storage = defaultStorage(),
}) {
  const lokal = storage.load(storageKey);
  let state = getSyncState(storage);
  let status = getScopeSyncStatus(state, scope);

  if (!client) {
    return { data: lokal, source: 'local', sync: status };
  }

  if (status?.pending && lokal != null) {
    state = markSyncPending(state, scope, remotePath);
    schreibeSyncState(state, storage);

    const retry = await client.writeJson(remotePath, lokal);
    state = retry.ok
      ? markSyncSuccess(state, scope, remotePath)
      : markSyncFailure(state, scope, remotePath, retry.error);
    schreibeSyncState(state, storage);
    status = getScopeSyncStatus(state, scope);

    return {
      data: lokal,
      source: retry.ok ? 'local-retried' : 'local-pending',
      sync: status,
      retry,
    };
  }

  const remote = await client.readJson(remotePath);
  if (remote.ok && isValidRemote(remote.data)) {
    storage.save(storageKey, remote.data);
    return { data: remote.data, source: 'remote', sync: status, remote };
  }

  return { data: lokal, source: 'local-fallback', sync: status, remote };
}

export function syncHinweisText(status, label = 'Daten') {
  if (!status) return '';
  if (status.pending) {
    return `${label} lokal gespeichert, Nextcloud-Sync ausstehend${status.lastError ? `: ${status.lastError}` : '.'}`;
  }
  if (status.mode === 'local-only') {
    return `${label} lokal gespeichert.`;
  }
  if (status.mode === 'synced') {
    return `${label} mit Nextcloud synchronisiert.`;
  }
  return '';
}
