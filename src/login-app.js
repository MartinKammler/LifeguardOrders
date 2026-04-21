import {
  authentifiziereBenutzer,
  createNcClient,
  initialisiereErstenBenutzer,
  leseNcKonfiguration,
  speichereNcKonfiguration,
} from './auth.js';
import { setHTML, raw } from './dom.js';
import { ladeAktiveStempeluhrBenutzer, authentifiziereMitglied } from './stempeluhr-auth.js';
import { getNextPath, SESSION_KEY_NC_PASS, setFunctionSession, setMemberSession } from './session.js';

let aktiveAnsicht = 'member';
let actingPersons = [];

function setStatus(targetId, text, art = 'info') {
  setBadge(document.getElementById(targetId), text, art);
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

function createClientOrStatus(targetId = 'login-status') {
  const nc = readNc();
  const client = createNcClient(nc);
  if (!client) {
    setStatus(targetId, 'Nextcloud-Zugangsdaten sind unvollständig.', 'error');
    return { nc, client: null };
  }
  return { nc, client };
}

function showBootstrap(open) {
  document.getElementById('bootstrap-card').style.display = open ? 'block' : 'none';
}

function setMode(mode) {
  aktiveAnsicht = mode === 'function' ? 'function' : 'member';
  document.getElementById('member-card').style.display = aktiveAnsicht === 'member' ? 'block' : 'none';
  document.getElementById('function-card').style.display = aktiveAnsicht === 'function' ? 'block' : 'none';

  const memberBtn = document.getElementById('btn-member-mode');
  const functionBtn = document.getElementById('btn-function-mode');
  memberBtn.className = aktiveAnsicht === 'member' ? 'btn btn-primary' : 'btn btn-ghost';
  functionBtn.className = aktiveAnsicht === 'function' ? 'btn btn-primary' : 'btn btn-ghost';
}

function persistMemberLoginSuccess(nc, user, lock) {
  sessionStorage.setItem(SESSION_KEY_NC_PASS, nc.pass);
  speichereNcKonfiguration(nc);
  setMemberSession(user, { lock });
  window.location.replace('mitglied.html');
}

function persistFunctionLoginSuccess(nc, user, actingPerson) {
  sessionStorage.setItem(SESSION_KEY_NC_PASS, nc.pass);
  speichereNcKonfiguration(nc);
  setFunctionSession(user, actingPerson);
  window.location.replace(getNextPath('index.html'));
}

function renderActingPersons(list) {
  const select = document.getElementById('acting-person');
  if (!select) return;
  const vorher = select.value;
  setHTML(select, raw('<option value="">– bitte wählen –</option>'));
  for (const person of list) {
    const option = document.createElement('option');
    option.value = person.id;
    option.textContent = person.name;
    select.appendChild(option);
  }
  if (vorher && list.some(person => person.id === vorher)) {
    select.value = vorher;
  }
}

async function ladeHandelndePersonen(client = null) {
  if (!client) {
    actingPersons = [];
    renderActingPersons([]);
    return { ok: false, error: 'Ohne Nextcloud-Verbindung kann keine handelnde Person geladen werden.' };
  }

  const remote = await ladeAktiveStempeluhrBenutzer(client);
  if (!remote.ok) {
    actingPersons = [];
    renderActingPersons([]);
    return remote;
  }

  actingPersons = remote.users
    .map(user => ({ id: user.id, name: user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  renderActingPersons(actingPersons);
  return { ok: true, source: 'remote', personen: actingPersons };
}

async function testeNextcloud() {
  const { nc, client } = createClientOrStatus('nc-status');
  if (!client) return;

  setStatus('nc-status', 'Teste Nextcloud-Verbindung…', 'info');
  const result = await client.testConnection();
  if (!result.ok) {
    setStatus('nc-status', result.error || 'Nextcloud-Verbindung fehlgeschlagen.', 'error');
    return;
  }

  speichereNcKonfiguration(nc);
  setStatus('nc-status', '✓ Nextcloud-Verbindung erfolgreich getestet.', 'ok');
  if (aktiveAnsicht === 'function') {
    const acting = await ladeHandelndePersonen(client);
    if (!acting.ok) {
      setStatus('login-status', acting.error || 'Mitgliederliste für handelnde Person konnte nicht geladen werden.', 'warn');
    }
  }
}

async function memberLogin() {
  const { nc, client } = createClientOrStatus('member-status');
  if (!client) return;

  setStatus('member-status', 'Prüfe Mitgliedslogin…', 'info');
  const result = await authentifiziereMitglied({
    client,
    pin: document.getElementById('member-pin').value,
  });

  if (!result.ok) {
    if (result.mustChangePIN) {
      setStatus('member-status', 'PIN muss zuerst in der Stempeluhr geändert werden.', 'warn');
    } else {
      setStatus('member-status', result.error || 'Mitgliedslogin fehlgeschlagen.', 'error');
    }
    return;
  }

  persistMemberLoginSuccess(nc, result.user, result.lock);
}

function leseHandelndePerson() {
  const actingPersonId = document.getElementById('acting-person').value;
  return actingPersons.find(person => person.id === actingPersonId) || null;
}

async function functionLogin() {
  const { nc, client } = createClientOrStatus('login-status');
  if (!client) return;

  if (!actingPersons.length) {
    const loaded = await ladeHandelndePersonen(client);
    if (!loaded.ok) {
      setStatus('login-status', loaded.error || 'Mitgliederliste konnte nicht geladen werden.', 'error');
      return;
    }
  }

  const actingPerson = leseHandelndePerson();
  if (!actingPerson) {
    setStatus('login-status', 'Bitte eine handelnde Person aus der Mitgliederliste auswählen.', 'error');
    return;
  }

  setStatus('login-status', 'Prüfe Funktionslogin…', 'info');
  const result = await authentifiziereBenutzer({
    client,
    login: document.getElementById('app-login').value,
    password: document.getElementById('app-pass').value,
  });

  if (!result.ok) {
    if (result.bootstrapRequired) {
      showBootstrap(true);
      setStatus('login-status', 'Noch keine Funktionskonten vorhanden. Bitte ersten Admin anlegen.', 'warn');
    } else {
      setStatus('login-status', result.error || 'Anmeldung fehlgeschlagen.', 'error');
    }
    return;
  }

  persistFunctionLoginSuccess(nc, result.user, actingPerson);
}

async function bootstrap() {
  const { client } = createClientOrStatus('login-status');
  if (!client) return;

  if (!actingPersons.length) {
    const loaded = await ladeHandelndePersonen(client);
    if (!loaded.ok) {
      setStatus('login-status', loaded.error || 'Mitgliederliste konnte nicht geladen werden.', 'error');
      return;
    }
  }

  const actingPerson = leseHandelndePerson();
  if (!actingPerson) {
    setStatus('login-status', 'Bitte zuerst eine handelnde Person aus der Mitgliederliste auswählen.', 'error');
    return;
  }

  const loginId = document.getElementById('bootstrap-login').value;
  const name = document.getElementById('bootstrap-name').value;
  const pass1 = document.getElementById('bootstrap-pass').value;
  const pass2 = document.getElementById('bootstrap-pass-repeat').value;
  if (pass1 !== pass2) {
    setStatus('login-status', 'Die beiden App-Passwörter stimmen nicht überein.', 'error');
    return;
  }

  setStatus('login-status', 'Lege ersten Admin an…', 'info');
  const result = await initialisiereErstenBenutzer({
    client,
    login: loginId,
    name,
    password: pass1,
  });
  if (!result.ok) {
    setStatus('login-status', result.error || 'Erster Admin konnte nicht angelegt werden.', 'error');
    return;
  }

  persistFunctionLoginSuccess(readNc(), result.user, actingPerson);
}

function prefill() {
  const nc = leseNcKonfiguration();
  document.getElementById('nc-url').value = nc.url;
  document.getElementById('nc-user').value = nc.user;
  renderActingPersons([]);
  actingPersons = [];
}

document.getElementById('btn-member-mode').addEventListener('click', () => setMode('member'));
document.getElementById('btn-function-mode').addEventListener('click', async () => {
  setMode('function');
  const nc = readNc();
  const client = createNcClient(nc);
  await ladeHandelndePersonen(client);
});
document.getElementById('btn-member-login').addEventListener('click', memberLogin);
document.getElementById('btn-login').addEventListener('click', functionLogin);
document.getElementById('btn-test-nc').addEventListener('click', testeNextcloud);
document.getElementById('btn-bootstrap').addEventListener('click', bootstrap);

prefill();
setMode('member');
