export const SESSION_KEY_AUTH = 'lo_auth_session';
export const SESSION_KEY_NC_PASS = 'lo_nc_pass';
export const SESSION_TIMEOUT_LOCAL_MS = 30 * 60 * 1000;
export const SESSION_TIMEOUT_MEMBER_MS = 12 * 60 * 60 * 1000;

const LOCAL_CACHE_KEYS = [
  'lo_benutzer',
  'lo_bestellungen',
  'lo_materialbestand',
  'lo_artikel',
  'lo_materialanfragen',
  'lo_wuensche',
  'lo_rechnungen',
  'lo_audit_log',
  'lo_zugriff',
];

/** Keys, die seit Sprint 12 nicht mehr lokal persistiert werden (Orphans aus älteren Versionen). */
export const ORPHAN_LOCAL_KEYS = [
  'lo_benutzer',
  'lo_bestellungen',
  'lo_materialbestand',
  'lo_artikel',
  'lo_materialanfragen',
  'lo_wuensche',
  'lo_rechnungen',
  'lo_zugriff',
];

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getSession() {
  return parseJson(sessionStorage.getItem(SESSION_KEY_AUTH));
}

function writeSession(session) {
  sessionStorage.setItem(SESSION_KEY_AUTH, JSON.stringify(session));
  return session;
}

export function setMemberSession(user, opts = {}) {
  const session = {
    id: user.id,
    name: user.name,
    rolle: 'user',
    authType: 'stempeluhr',
    mitgliedId: user.mitgliedId || user.id,
    lock: opts.lock || null,
    loginAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };
  return writeSession(session);
}

export function setFunctionSession(user, actingPerson) {
  const now = new Date().toISOString();
  const session = {
    id: user.id,
    name: user.name,
    rolle: user.rolle,
    authType: 'lokal',
    funktionId: user.id,
    actingPersonId: actingPerson?.id || '',
    actingPersonName: actingPerson?.name || '',
    loginAt: now,
    lastActivityAt: now,
  };
  return writeSession(session);
}

export function setSession(user, opts = {}) {
  if ((user?.authType || opts?.authType) === 'stempeluhr' || user?.rolle === 'user') {
    return setMemberSession(user, opts);
  }
  return setFunctionSession(user, opts.actingPerson);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY_AUTH);
  sessionStorage.removeItem(SESSION_KEY_NC_PASS);
  clearLocalAppCache();
}

export function isFunctionSession(session) {
  return session?.authType === 'lokal';
}

export function isMemberSession(session) {
  return session?.authType === 'stempeluhr';
}

export function isSessionExpired(session, now = Date.now()) {
  const timeout = isFunctionSession(session)
    ? SESSION_TIMEOUT_LOCAL_MS
    : isMemberSession(session)
      ? SESSION_TIMEOUT_MEMBER_MS
      : 0;
  if (!timeout) return false;
  const lastActivity = Date.parse(session?.lastActivityAt || session?.loginAt || '');
  if (!Number.isFinite(lastActivity)) return true;
  return (now - lastActivity) > timeout;
}

export function touchSessionActivity(now = new Date().toISOString()) {
  const session = getSession();
  if (!session || (!isFunctionSession(session) && !isMemberSession(session))) return session;
  const next = { ...session, lastActivityAt: now };
  return writeSession(next);
}

export function clearLocalAppCache() {
  try {
    for (const key of LOCAL_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
    const raw = localStorage.getItem('lo_einstellungen');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const nc = parsed?.nc && typeof parsed.nc === 'object'
      ? {
          url: String(parsed.nc.url || '').trim(),
          user: String(parsed.nc.user || '').trim(),
          pass: '',
        }
      : null;
    if (nc?.url || nc?.user) {
      localStorage.setItem('lo_einstellungen', JSON.stringify({ nc }));
    } else {
      localStorage.removeItem('lo_einstellungen');
    }
  } catch {
    // Logout darf nie an lokaler Bereinigung scheitern.
  }
}

export function getNextPath(defaultPath = 'index.html') {
  const url = new URL(window.location.href);
  const next = url.searchParams.get('next');
  if (!next) return defaultPath;
  // Nur einfache relative Pfade erlaubt – keine protocol-relative, absoluten oder externen URLs
  if (!/^[\w][\w./%-]*(?:\?[^#]*)?$/.test(next)) return defaultPath;
  if (next.startsWith('login.html')) return defaultPath;
  return next;
}

export function redirectToLogin(next = null) {
  const target = next || `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search || ''}`;
  window.location.replace(`login.html?next=${encodeURIComponent(target)}`);
}

export function hasNcPasswort() {
  return !!sessionStorage.getItem(SESSION_KEY_NC_PASS);
}
