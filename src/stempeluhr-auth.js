import { findeMitgliedsSperre, ladeZugriff } from './zugriff.js';

export const NC_PFAD_LGC_USERS = '/LifeguardClock/lgc_users.json';

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

export async function authentifiziereMitglied({ client, pin, storage }) {
  const eingabe = String(pin || '').trim();
  if (!eingabe) {
    return { ok: false, error: 'PIN fehlt.' };
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
    return { ok: false, error: 'PIN ist ungültig oder kein aktives Mitglied.' };
  }
  if (matches.length > 1) {
    return { ok: false, error: 'PIN ist nicht eindeutig. Bitte Verwaltung informieren.' };
  }

  const user = matches[0];
  if (user.mustChangePIN) {
    return {
      ok: false,
      mustChangePIN: true,
      error: 'Diese PIN muss zuerst in der Stempeluhr geändert werden.',
      user,
    };
  }

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
