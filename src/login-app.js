import {
  authentifiziereBenutzer,
  createNcClient,
  initialisiereErstenBenutzer,
  leseNcKonfiguration,
  speichereNcKonfiguration,
} from './auth.js';
import { getNextPath, SESSION_KEY_NC_PASS, setSession } from './session.js';

function setStatus(text, art = 'info') {
  const el = document.getElementById('login-status');
  setBadge(el, text, art);
}

function setNcStatus(text, art = 'info') {
  const el = document.getElementById('nc-status');
  setBadge(el, text, art);
}

function setBadge(el, text, art = 'info') {
  if (!el) return;
  const klassen = {
    info: 'badge badge-blue',
    ok: 'badge badge-green',
    warn: 'badge badge-amber',
    error: 'badge badge-red',
  };
  el.className = klassen[art] || klassen.info;
  el.textContent = text;
}

function readNc() {
  return {
    url: document.getElementById('nc-url').value.trim(),
    user: document.getElementById('nc-user').value.trim(),
    pass: document.getElementById('nc-pass').value,
  };
}

function showBootstrap(open) {
  document.getElementById('bootstrap-card').style.display = open ? 'block' : 'none';
}

function persistLoginSuccess(nc, user) {
  sessionStorage.setItem(SESSION_KEY_NC_PASS, nc.pass);
  speichereNcKonfiguration(nc);
  setSession(user);
  window.location.replace(getNextPath('index.html'));
}

async function testeNextcloud() {
  const nc = readNc();
  const client = createNcClient(nc);
  if (!client) {
    setNcStatus('Nextcloud-Zugangsdaten sind unvollständig.', 'error');
    return;
  }

  setNcStatus('Teste Nextcloud-Verbindung…', 'info');
  const result = await client.testConnection();
  if (!result.ok) {
    setNcStatus(result.error || 'Nextcloud-Verbindung fehlgeschlagen.', 'error');
    return;
  }

  speichereNcKonfiguration(nc);
  setNcStatus('✓ Nextcloud-Verbindung erfolgreich getestet.', 'ok');
}

async function login() {
  const nc = readNc();
  const client = createNcClient(nc);
  if (!client) {
    setStatus('Nextcloud-Zugangsdaten sind unvollständig.', 'error');
    return;
  }

  setStatus('Prüfe App-Login…', 'info');
  const result = await authentifiziereBenutzer({
    client,
    login: document.getElementById('app-login').value,
    password: document.getElementById('app-pass').value,
  });

  if (!result.ok) {
    if (result.bootstrapRequired) {
      showBootstrap(true);
      setStatus('Noch keine App-Benutzer vorhanden. Bitte ersten Admin anlegen.', 'warn');
    } else {
      setStatus(result.error || 'Anmeldung fehlgeschlagen.', 'error');
    }
    return;
  }

  persistLoginSuccess(nc, result.user);
}

async function bootstrap() {
  const nc = readNc();
  const client = createNcClient(nc);
  if (!client) {
    setStatus('Nextcloud-Zugangsdaten sind unvollständig.', 'error');
    return;
  }

  const loginId = document.getElementById('bootstrap-login').value;
  const name = document.getElementById('bootstrap-name').value;
  const pass1 = document.getElementById('bootstrap-pass').value;
  const pass2 = document.getElementById('bootstrap-pass-repeat').value;
  if (pass1 !== pass2) {
    setStatus('Die beiden App-Passwörter stimmen nicht überein.', 'error');
    return;
  }

  setStatus('Lege ersten Admin an…', 'info');
  const result = await initialisiereErstenBenutzer({
    client,
    login: loginId,
    name,
    password: pass1,
  });
  if (!result.ok) {
    setStatus(result.error || 'Erster Admin konnte nicht angelegt werden.', 'error');
    return;
  }

  persistLoginSuccess(nc, result.user);
}

function prefill() {
  const nc = leseNcKonfiguration();
  document.getElementById('nc-url').value = nc.url;
  document.getElementById('nc-user').value = nc.user;
}

document.getElementById('btn-login').addEventListener('click', login);
document.getElementById('btn-test-nc').addEventListener('click', testeNextcloud);
document.getElementById('btn-bootstrap').addEventListener('click', bootstrap);
prefill();
