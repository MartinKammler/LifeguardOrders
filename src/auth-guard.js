import { load } from './storage.js';
import { STORAGE_KEY_E } from './auth.js';
import {
  clearSession,
  getSession,
  hasNcPasswort,
  isFunctionSession,
  isMemberSession,
  isSessionExpired,
  redirectToLogin,
  touchSessionActivity,
} from './session.js';

const MEMBER_HOME = 'mitglied.html';

function currentPage() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

function redirectTo(path) {
  window.location.replace(path);
}

function navSessionUI(nav, session) {
  if (!nav || !session) return;
  if (nav.querySelector('.nav-auth')) return;

  const spacer = document.createElement('div');
  spacer.className = 'nav-spacer';

  const wrap = document.createElement('div');
  wrap.className = 'nav-auth';

  const badge = document.createElement('span');
  badge.className = 'badge badge-blue';
  if (isFunctionSession(session)) {
    const person = session.actingPersonName ? ` · ${session.actingPersonName}` : '';
    badge.textContent = `${session.name}${person}`;
  } else {
    badge.textContent = `${session.name} · Mitglied`;
  }

  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'btn btn-ghost btn-sm nav-logout';
  logout.textContent = 'Logout';
  logout.addEventListener('click', () => {
    clearSession();
    redirectToLogin();
  });

  wrap.appendChild(badge);
  wrap.appendChild(logout);
  nav.appendChild(spacer);
  nav.appendChild(wrap);
}

const session = getSession();
const einstellungen = load(STORAGE_KEY_E);
const page = currentPage();

if (!session || !hasNcPasswort() || !einstellungen?.nc?.url || !einstellungen?.nc?.user || isSessionExpired(session)) {
  clearSession();
  redirectToLogin();
} else {
  if (isMemberSession(session) && page !== MEMBER_HOME) {
    redirectTo(MEMBER_HOME);
  } else if (isFunctionSession(session) && page === MEMBER_HOME) {
    redirectTo('index.html');
  } else if (isFunctionSession(session)) {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    for (const eventName of events) {
      window.addEventListener(eventName, () => touchSessionActivity(), { passive: true });
    }
  }
  navSessionUI(document.querySelector('nav'), session);
}
