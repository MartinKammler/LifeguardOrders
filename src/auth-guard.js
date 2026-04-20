import { load } from './storage.js';
import { STORAGE_KEY_E } from './auth.js';
import { clearSession, getSession, hasNcPasswort, redirectToLogin } from './session.js';

function navSessionUI(nav, session) {
  if (!nav || !session) return;
  if (nav.querySelector('.nav-auth')) return;

  const spacer = document.createElement('div');
  spacer.className = 'nav-spacer';

  const wrap = document.createElement('div');
  wrap.className = 'nav-auth';

  const badge = document.createElement('span');
  badge.className = 'badge badge-blue';
  badge.textContent = `${session.name} · ${session.rolle}`;

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

if (!session || !hasNcPasswort() || !einstellungen?.nc?.url || !einstellungen?.nc?.user) {
  clearSession();
  redirectToLogin();
} else {
  navSessionUI(document.querySelector('nav'), session);
}
