export const SESSION_KEY_AUTH = 'lo_auth_session';
export const SESSION_KEY_NC_PASS = 'lo_nc_pass';

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

export function setSession(user) {
  const session = {
    id: user.id,
    name: user.name,
    rolle: user.rolle,
    loginAt: new Date().toISOString(),
  };
  sessionStorage.setItem(SESSION_KEY_AUTH, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY_AUTH);
  sessionStorage.removeItem(SESSION_KEY_NC_PASS);
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
