import { findeMitgliedsSperre, ladeZugriff } from './zugriff.js';

export const NC_PFAD_LGC_USERS = '/LifeguardClock/lgc_users.json';
export const MEMBER_PIN_STATE_KEY = 'lo_member_pin_state';
export const MEMBER_PIN_MAX_FAILED = 5;
export const MEMBER_PIN_COOLDOWN_MS = 5 * 60 * 1000;

function encoder() {
  return new TextEncoder();
}

function toHex(bytes) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeClockUser(user) {
  return {
    id: String(user?.id || '').trim(),
    name: String(user?.name || '').trim(),
    pin: String(user?.pin || ''),
    salt: String(user?.salt || ''),
    mustChangePIN: user?.mustChangePIN === true,
    aktiv: user?.aktiv !== false,
    permissions: Array.isArray(user?.permissions) ? [...user.permissions] : [],
  };
}

export function isValidClockUserListe(data) {
  return Array.isArray(data) && data.every(user => {
    const normalized = normalizeClockUser(user);
    return !!normalized.id && !!normalized.name && !!normalized.pin;
  });
}

export async function hashClockPin(pin, salt) {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    encoder().encode(`${String(salt || '')}:${String(pin || '')}`)
  );
  return toHex(new Uint8Array(buffer));
}

export async function verifyClockPin(pin, user) {
  const normalized = normalizeClockUser(user);
  if (!normalized.salt) {
    // Kein Salt: Klartext-Vergleich nur erlaubt um mustChangePIN-Nutzer zu identifizieren
    return normalized.mustChangePIN && String(pin || '') === normalized.pin;
  }
  return (await hashClockPin(pin, normalized.salt)) === normalized.pin;
}

export async function ladeStempeluhrBenutzer(client) {
  const remote = await client.readJson(NC_PFAD_LGC_USERS);
  if (!remote.ok) {
    return { ok: false, error: remote.error || 'Stempeluhr-Benutzer konnten nicht geladen werden.' };
  }
  if (!isValidClockUserListe(remote.data)) {
    return { ok: false, error: 'Stempeluhr-Benutzerdatei ist ungültig.' };
  }
  return {
    ok: true,
    users: remote.data.map(normalizeClockUser),
    etag: remote.etag || '',
    lastModified: remote.lastModified || '',
  };
}

export async function ladeAktiveStempeluhrBenutzer(client) {
  const result = await ladeStempeluhrBenutzer(client);
  if (!result.ok) return result;
  return {
    ...result,
    users: result.users.filter(user => user.aktiv),
  };
}

function defaultSessionStorage() {
  return typeof sessionStorage !== 'undefined'
    ? sessionStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}

function lesePinState(storage = defaultSessionStorage()) {
  try {
    return JSON.parse(storage.getItem(MEMBER_PIN_STATE_KEY) || 'null') || {
      failedAttempts: 0,
      blockedUntil: 0,
    };
  } catch {
    return { failedAttempts: 0, blockedUntil: 0 };
  }
}

function schreibePinState(state, storage = defaultSessionStorage()) {
  storage.setItem(MEMBER_PIN_STATE_KEY, JSON.stringify(state));
}

export function leseMitgliedsPinCooldown(storage = defaultSessionStorage(), now = Date.now()) {
  const state = lesePinState(storage);
  const blockedUntil = Number(state.blockedUntil || 0);
  const failedAttempts = Number.isInteger(state.failedAttempts) ? state.failedAttempts : 0;
  if (!blockedUntil || blockedUntil <= now) {
    if (blockedUntil && blockedUntil <= now) {
      storage.removeItem(MEMBER_PIN_STATE_KEY);
    }
    return { blocked: false, remainingMs: 0, failedAttempts };
  }
  return {
    blocked: true,
    remainingMs: blockedUntil - now,
    failedAttempts: failedAttempts || MEMBER_PIN_MAX_FAILED,
  };
}

export function merkeFehlversuchMitgliedsPin(storage = defaultSessionStorage(), now = Date.now()) {
  const current = lesePinState(storage);
  const failedAttempts = Math.max(0, Number(current.failedAttempts || 0)) + 1;
  const next = {
    failedAttempts,
    blockedUntil: failedAttempts >= MEMBER_PIN_MAX_FAILED ? now + MEMBER_PIN_COOLDOWN_MS : 0,
  };
  schreibePinState(next, storage);
  return leseMitgliedsPinCooldown(storage, now);
}

export function resetMitgliedsPinCooldown(storage = defaultSessionStorage()) {
  storage.removeItem(MEMBER_PIN_STATE_KEY);
}

function formatCooldown(remainingMs) {
  const minuten = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Zu viele Fehlversuche. Bitte in ${minuten} Minute${minuten === 1 ? '' : 'n'} erneut versuchen.`;
}

export async function authentifiziereMitglied({ client, pin, storage, sessionStore = defaultSessionStorage(), now = Date.now() }) {
  const eingabe = String(pin || '').trim();
  if (!eingabe) {
    return { ok: false, error: 'PIN fehlt.' };
  }

  const cooldown = leseMitgliedsPinCooldown(sessionStore, now);
  if (cooldown.blocked) {
    return {
      ok: false,
      cooldown: true,
      remainingMs: cooldown.remainingMs,
      error: formatCooldown(cooldown.remainingMs),
    };
  }

  const geladen = await ladeAktiveStempeluhrBenutzer(client);
  if (!geladen.ok) return geladen;

  const matches = [];
  for (const user of geladen.users) {
    if (await verifyClockPin(eingabe, user)) {
      matches.push(user);
    }
  }

  if (!matches.length) {
    merkeFehlversuchMitgliedsPin(sessionStore, now);
    return { ok: false, error: 'PIN ist ungültig oder kein aktives Mitglied.' };
  }
  if (matches.length > 1) {
    return { ok: false, error: 'PIN ist nicht eindeutig. Bitte Verwaltung informieren.' };
  }

  const user = matches[0];
  if (user.mustChangePIN) {
    resetMitgliedsPinCooldown(sessionStore);
    return {
      ok: false,
      mustChangePIN: true,
      error: 'Diese PIN muss zuerst in der Stempeluhr geändert werden.',
      user,
    };
  }

  resetMitgliedsPinCooldown(sessionStore);

  const zugriff = await ladeZugriff(client, storage);
  const sperre = zugriff.ok
    ? findeMitgliedsSperre(zugriff.data, user.id)
    : { blocked: false, globalBlocked: false, memberBlocked: false, reason: '', globalReason: '', memberReason: '' };

  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      rolle: 'user',
      authType: 'stempeluhr',
      mitgliedId: user.id,
    },
    lock: sperre,
  };
}
