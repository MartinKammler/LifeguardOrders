import { load } from './storage.js';
import { createWebDavClient } from './webdav.js';
import { hydrateJsonFromSync } from './sync.js';
import { ORPHAN_LOCAL_KEYS } from './session.js';

export const STORAGE_KEY_E = 'lo_einstellungen';
export const NC_PFAD_E = '/LifeguardOrders/einstellungen.json';
export const SYNC_SCOPE_E = 'einstellungen';

const ORPHAN_CLEANUP_FLAG = 'lo_orphan_cleanup_v1';

/**
 * Entfernt lokal gecachte Daten, die seit Sprint 12 nur noch remote leben.
 * Läuft nur einmalig pro Browser-Install (per localStorage-Flag).
 */
export function cleanupOrphanLocalCaches() {
  try {
    if (localStorage.getItem(ORPHAN_CLEANUP_FLAG)) return;
    for (const key of ORPHAN_LOCAL_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.setItem(ORPHAN_CLEANUP_FLAG, new Date().toISOString());
  } catch {
    // Cleanup darf den App-Start nie blockieren.
  }
}

cleanupOrphanLocalCaches();

export function createClientFromLocalNc() {
  const einstellungen = load(STORAGE_KEY_E) || {};
  const nc = einstellungen?.nc || {};
  const pass = sessionStorage.getItem('lo_nc_pass') || '';
  if (!nc.url || !nc.user || !pass) return null;
  return createWebDavClient({ ...nc, pass });
}

export async function ladeRemoteEinstellungen(client) {
  if (!client) return { data: null, source: 'auth-required', sync: null };
  const result = await hydrateJsonFromSync({
    scope: SYNC_SCOPE_E,
    storageKey: STORAGE_KEY_E,
    client,
    remotePath: NC_PFAD_E,
    isValidRemote: data => !!data && typeof data === 'object' && !Array.isArray(data),
    defaultData: null,
  });
  return {
    ...result,
    data: result.data && typeof result.data === 'object' && !Array.isArray(result.data)
      ? result.data
      : null,
  };
}
