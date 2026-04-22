/**
 * sync.js
 * Remote-required Speicherung mit nachvollziehbarem Nextcloud-Sync-Status.
 *
 * Öffentliche API:
 *   getSyncState(storage?)                    → state
 *   getScopeSyncStatus(state, scope)          → status|null
 *   hasPendingSync(state, scope)              → boolean (Legacy: immer false)
 *   pendingSyncScopes(state)                  → string[] (Legacy: immer [])
 *   isConflictSync(state, scope)              → boolean
 *   isWriteBlockedSync(status)                → boolean
 *   markSyncSuccess(state, scope, path, meta) → state
 *   persistJsonWithSync(opts)                 → { ok, remote, sync }
 *   hydrateJsonFromSync(opts)                 → { data, source, sync, remote? }
 *   syncHinweisText(status, label?)           → string
 *
 * Seit Sprint 13: `storageKey` ist kein Parameter mehr –
 * `persistJsonWithSync` schreibt nicht mehr in localStorage.
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

function cleanMeta(meta = {}) {
  return {
    etag: meta.etag || '',
    lastModified: meta.lastModified || '',
  };
}

function versionToken(meta = {}) {
  return meta.etag || meta.lastModified || '';
}

function schreibeSyncState(state, storage = defaultStorage()) {
  storage.save(STORAGE_KEY_SYNC, state);
  return state;
}

function buildStatus(vorher, patch) {
  const merged = {
    ...vorher,
    ...patch,
    pending: false,
  };
  if (!merged.scope && vorher?.scope) merged.scope = vorher.scope;
  if (!merged.remotePath && vorher?.remotePath) merged.remotePath = vorher.remotePath;
  return merged;
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

export function pendingSyncScopes() {
  return [];
}

export function isConflictSync(state, scope) {
  return getScopeSyncStatus(state, scope)?.mode === 'conflict';
}

export function isWriteBlockedSync(status) {
  return ['conflict', 'offline-readonly', 'auth-required'].includes(status?.mode);
}

export function markSyncSuccess(state, scope, remotePath, meta = {}, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: buildStatus(vorher, {
      scope,
      remotePath,
      mode: 'synced',
      writable: true,
      lastAttemptAt: now,
      lastSuccessAt: now,
      lastRemoteReadAt: now,
      lastError: '',
      conflict: null,
      ...cleanMeta(meta),
    }),
  };
}

function markSyncConflict(state, scope, remotePath, details = {}, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: buildStatus(vorher, {
      scope,
      remotePath,
      mode: 'conflict',
      writable: false,
      lastAttemptAt: now,
      lastError: details.error || 'Remote-Konflikt erkannt.',
      conflict: {
        reason: details.reason || 'remote-changed',
        remoteVersion: versionToken(details.remoteMeta),
        localVersion: versionToken(vorher),
        detectedAt: now,
      },
      ...cleanMeta(details.remoteMeta),
    }),
  };
}

function markSyncOfflineReadonly(state, scope, remotePath, error, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: buildStatus(vorher, {
      scope,
      remotePath,
      mode: 'offline-readonly',
      writable: false,
      lastAttemptAt: now,
      lastError: error || 'Nextcloud nicht erreichbar.',
    }),
  };
}

function markSyncAuthRequired(state, scope, remotePath, now = nowIso()) {
  const clean = cleanState(state);
  const vorher = getScopeSyncStatus(clean, scope) || {};
  return {
    ...clean,
    [scope]: buildStatus(vorher, {
      scope,
      remotePath,
      mode: 'auth-required',
      writable: false,
      lastAttemptAt: now,
      lastError: 'Nextcloud-Verbindung nicht konfiguriert.',
    }),
  };
}

function markSyncReadSuccess(state, scope, remotePath, meta = {}, now = nowIso()) {
  return markSyncSuccess(state, scope, remotePath, meta, now);
}

export async function persistJsonWithSync({
  scope,
  data,
  client,
  remotePath,
  storage = defaultStorage(),
}) {
  let state = getSyncState(storage);
  const vorher = getScopeSyncStatus(state, scope);

  if (!client) {
    state = markSyncAuthRequired(state, scope, remotePath);
    schreibeSyncState(state, storage);
    return {
      ok: false,
      remote: { ok: false, skipped: true, error: 'Nextcloud-Verbindung nicht konfiguriert.' },
      sync: getScopeSyncStatus(state, scope),
    };
  }

  if (vorher?.mode === 'conflict') {
    return {
      ok: false,
      remote: {
        ok: false,
        conflict: true,
        skipped: true,
        error: 'Remote-Daten wurden zwischenzeitlich geändert.',
      },
      sync: vorher,
    };
  }

  const meta = await client.head(remotePath);
  if (!meta.ok && !meta.missing) {
    state = markSyncOfflineReadonly(state, scope, remotePath, meta.error);
    schreibeSyncState(state, storage);
    return { ok: false, remote: meta, sync: getScopeSyncStatus(state, scope) };
  }

  const remote = await client.writeJson(remotePath, data, meta.missing
    ? {} // kein If-None-Match – Nextcloud blockiert diesen Header per CORS-Preflight
    : (meta.etag ? { ifMatch: meta.etag } : {}));

  if (!remote.ok) {
    state = remote.conflict
      ? markSyncConflict(state, scope, remotePath, {
          error: remote.error,
          remoteMeta: meta,
          reason: 'precondition-failed',
        })
      : markSyncOfflineReadonly(state, scope, remotePath, remote.error);
    schreibeSyncState(state, storage);
    return { ok: false, remote, sync: getScopeSyncStatus(state, scope) };
  }

  const bestaetigteMeta = remote.etag || remote.lastModified
    ? remote
    : await client.head(remotePath);
  state = markSyncSuccess(state, scope, remotePath, bestaetigteMeta.ok === false ? meta : bestaetigteMeta);
  schreibeSyncState(state, storage);

  return { ok: true, remote, sync: getScopeSyncStatus(state, scope) };
}

export async function hydrateJsonFromSync({
  scope,
  client,
  remotePath,
  isValidRemote = () => true,
  defaultData = null,
  storage = defaultStorage(),
}) {
  let state = getSyncState(storage);

  if (!client) {
    state = markSyncAuthRequired(state, scope, remotePath);
    schreibeSyncState(state, storage);
    return { data: defaultData, source: 'auth-required', sync: getScopeSyncStatus(state, scope) };
  }

  const remote = await client.readJson(remotePath);
  if (remote.ok && isValidRemote(remote.data)) {
    state = markSyncReadSuccess(state, scope, remotePath, remote);
    schreibeSyncState(state, storage);
    return { data: remote.data, source: 'remote', sync: getScopeSyncStatus(state, scope), remote };
  }

  // Datei existiert noch nicht auf NC → kein Fehler, lokaler Stand gilt
  if (remote.missing) {
    state = markSyncReadSuccess(state, scope, remotePath, {});
    schreibeSyncState(state, storage);
    return { data: defaultData, source: 'remote-missing', sync: getScopeSyncStatus(state, scope), remote };
  }

  state = markSyncOfflineReadonly(state, scope, remotePath, remote.error || 'Nextcloud nicht erreichbar.');
  schreibeSyncState(state, storage);
  return { data: defaultData, source: 'remote-required', sync: getScopeSyncStatus(state, scope), remote };
}

export function syncHinweisText(status, label = 'Daten') {
  if (!status) return '';
  if (status.mode === 'synced') {
    return `${label} mit Nextcloud synchronisiert.`;
  }
  if (status.mode === 'auth-required') {
    return `${label} können ohne Nextcloud-Verbindung nicht geladen werden.`;
  }
  if (status.mode === 'offline-readonly') {
    return `${label} können ohne erreichbare Nextcloud nicht geladen werden${status.lastError ? `: ${status.lastError}` : '.'}`;
  }
  if (status.mode === 'conflict') {
    return `${label} wurden remote geändert. Bitte zuerst Remote neu laden oder lokale Kopie exportieren.`;
  }
  return '';
}
