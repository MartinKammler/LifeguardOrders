import { createWebDavClient } from './webdav.js';
import { load, save } from './storage.js';

export const STORAGE_KEY_E = 'lo_einstellungen';
export const STORAGE_KEY_U = 'lo_benutzer';
export const NC_PFAD_U = '/LifeguardOrders/benutzer.json';

function defaultStorage() {
  return { load, save };
}

function encoder() {
  return new TextEncoder();
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function randomSalt(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export function normalizeLogin(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeBenutzer(user) {
  return {
    id: normalizeLogin(user?.id),
    name: String(user?.name || '').trim(),
    rolle: String(user?.rolle || 'lesen').trim() || 'lesen',
    aktiv: user?.aktiv !== false,
    salt: String(user?.salt || ''),
    passwordHash: String(user?.passwordHash || ''),
    authType: 'lokal',
  };
}

export function isValidBenutzerListe(data) {
  return Array.isArray(data) && data.every(user => {
    const normalized = normalizeBenutzer(user);
    return !!normalized.id && !!normalized.name && !!normalized.salt && !!normalized.passwordHash;
  });
}

export async function hashPassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder().encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: encoder().encode(String(salt || '')),
    iterations: 120000,
  }, keyMaterial, 256);
  return bytesToBase64(new Uint8Array(bits));
}

export async function verifyPassword(password, user) {
  const normalized = normalizeBenutzer(user);
  if (!normalized.salt || !normalized.passwordHash) return false;
  return (await hashPassword(password, normalized.salt)) === normalized.passwordHash;
}

export function leseNcKonfiguration(storage = defaultStorage()) {
  const einstellungen = storage.load(STORAGE_KEY_E) || {};
  return {
    url: einstellungen?.nc?.url || '',
    user: einstellungen?.nc?.user || '',
  };
}

export function speichereNcKonfiguration(nc, storage = defaultStorage()) {
  const einstellungen = storage.load(STORAGE_KEY_E) || {};
  storage.save(STORAGE_KEY_E, {
    ...einstellungen,
    nc: {
      ...(einstellungen.nc || {}),
      url: String(nc?.url || '').trim(),
      user: String(nc?.user || '').trim(),
      pass: '',
    },
  });
}

export function createNcClient(nc) {
  if (!nc?.url || !nc?.user || !nc?.pass) return null;
  return createWebDavClient({
    url: String(nc.url).trim(),
    user: String(nc.user).trim(),
    pass: String(nc.pass),
  });
}

function istDateiNichtGefunden(error) {
  return String(error || '').toLowerCase().includes('datei nicht gefunden');
}

export async function ladeBenutzer(client, storage = defaultStorage()) {
  const remote = await client.readJson(NC_PFAD_U);
  if (!remote.ok && istDateiNichtGefunden(remote.error)) {
    return { ok: true, users: [], missing: true };
  }
  if (!remote.ok) {
    return { ok: false, error: remote.error || 'Benutzerdatei konnte nicht geladen werden.' };
  }
  if (!isValidBenutzerListe(remote.data)) {
    return { ok: false, error: 'Benutzerdatei ist ungültig.' };
  }

  const users = remote.data.map(normalizeBenutzer);
  return { ok: true, users, missing: false, remote };
}

export async function initialisiereErstenBenutzer({ client, login, name, password, storage = defaultStorage() }) {
  const id = normalizeLogin(login);
  if (!id) return { ok: false, error: 'Login-ID fehlt.' };
  if (!String(name || '').trim()) return { ok: false, error: 'Name fehlt.' };
  if (!String(password || '')) return { ok: false, error: 'Passwort fehlt.' };

  const existing = await ladeBenutzer(client, storage);
  if (!existing.ok && !existing.missing) {
    return existing;
  }
  if (existing.users?.length) {
    return { ok: false, error: 'Es existieren bereits App-Benutzer.' };
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = normalizeBenutzer({
    id,
    name,
    rolle: 'admin',
    aktiv: true,
    salt,
    passwordHash,
  });

  const write = await client.writeJson(NC_PFAD_U, [user]);
  if (!write.ok) {
    return { ok: false, error: write.error || 'Erster Benutzer konnte nicht gespeichert werden.' };
  }
  return { ok: true, user, users: [user] };
}

export async function authentifiziereBenutzer({ client, login, password, storage = defaultStorage() }) {
  const geladen = await ladeBenutzer(client, storage);
  if (!geladen.ok) return geladen;
  if (!geladen.users.length) {
    return { ok: false, bootstrapRequired: true, error: 'Es existieren noch keine App-Benutzer.' };
  }

  const loginId = normalizeLogin(login);
  const user = geladen.users.find(entry => entry.aktiv && normalizeLogin(entry.id) === loginId);
  if (!user) {
    return { ok: false, error: 'Benutzer nicht gefunden oder deaktiviert.' };
  }
  if (!(await verifyPassword(password, user))) {
    return { ok: false, error: 'App-Passwort ist falsch.' };
  }
  return { ok: true, user, users: geladen.users };
}
