/**
 * einstellungen-app.js
 * Logik für einstellungen.html
 */

import { createWebDavClient }                        from './webdav.js';
import { parseMitglieder }                           from './mitglieder.js';
import { ladeDefaultEinstellungen, downloadAlsJson } from './defaults.js';
import { load, save }                                from './storage.js';
import { esc }                                       from './dom.js';

const STORAGE_KEY = 'lo_einstellungen';
const NC_PFAD     = '/LifeguardOrders/einstellungen.json';

const DEFAULTS = {
  nc: {
    url:  'https://cloud.goddyhome.de',
    user: 'martin',
    pass: '',
  },
  og: {
    name:        'OG-Schellbronn e.V.',
    lv:          'Landesverband Baden',
    bezirk:      'Bezirk Enz',
    strasse:     'Nagoldstr. 47',
    plz:         '75242',
    ort:         'Neuhausen',
    email:       'kasse@schellbronn.dlrg.de',
    web:         'www.schellbronn.dlrg.de',
    iban:        'DE57 6619 0000 0033 5861 08',
    bic:         'GENODE61KA1',
    bank:        'Volksbank pur eG',
    amtsgericht: 'Mannheim 501097',
    steuernr:    '41435/55802',
    vorstand1:   'Martin Kammler',
    vorstand2:   'Yannick Rehberg',
    finanzen:    'Dorit Storzum',
  },
  stundenRate: { stunden: 3, euro: 10 },
  einsatztypen: ['wachdienst', 'sanitaetsdienst', 'helfer', 'verwaltung'],
  mitglieder: [],
};

/* ── Hilfsfunktionen ────────────────────────────────────────── */

function zeigeStatus(elId, text, art = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  const klassen = {
    ok:    'badge badge-green',
    error: 'badge badge-red',
    info:  'badge badge-blue',
    warn:  'badge badge-amber',
  };
  el.className = klassen[art] || klassen.info;
  el.textContent = text;
}

function ladeClient(einstellungen) {
  return createWebDavClient(einstellungen.nc || {});
}

/* ── Einstellungen lesen / schreiben ────────────────────────── */

function leseLokal()      { return load(STORAGE_KEY); }
function schreibeLokal(d) { save(STORAGE_KEY, d); }

async function leseVonNc(client) {
  const r = await client.readJson(NC_PFAD);
  return r.ok ? r.data : null;
}

async function schreibeAufNc(client, daten) {
  return client.writeJson(NC_PFAD, daten);
}

/* ── DOM ↔ Daten ────────────────────────────────────────────── */

function formularFuellen(e) {
  const nc  = e.nc  || {};
  const og  = e.og  || {};
  const sr  = e.stundenRate || {};

  document.getElementById('nc-url').value  = nc.url  || '';
  document.getElementById('nc-user').value = nc.user || '';
  document.getElementById('nc-pass').value = nc.pass || '';

  document.getElementById('og-name').value        = og.name        || '';
  document.getElementById('og-lv').value          = og.lv          || '';
  document.getElementById('og-bv-name').value     = og.bezirk      || '';
  document.getElementById('og-strasse').value     = og.strasse      || '';
  document.getElementById('og-plz').value         = og.plz         || '';
  document.getElementById('og-ort').value         = og.ort         || '';
  document.getElementById('og-email').value       = og.email       || '';
  document.getElementById('og-web').value         = og.web         || '';
  document.getElementById('og-iban').value        = og.iban        || '';
  document.getElementById('og-bic').value         = og.bic         || '';
  document.getElementById('og-bank').value        = og.bank        || '';
  document.getElementById('og-amtsgericht').value = og.amtsgericht || '';
  document.getElementById('og-steuernr').value    = og.steuernr    || '';
  document.getElementById('og-vorstand1').value   = og.vorstand1   || '';
  document.getElementById('og-vorstand2').value   = og.vorstand2   || '';
  document.getElementById('og-finanzen').value    = og.finanzen    || '';

  document.getElementById('stunden-rate-h').value   = sr.stunden ?? 3;
  document.getElementById('stunden-rate-eur').value = sr.euro    ?? 10;

  document.getElementById('einsatztypen').value =
    (e.einsatztypen || DEFAULTS.einsatztypen).join(', ');

  if (e.mitglieder?.length) zeigeNcMitglieder(e.mitglieder);
}

function formularLesen() {
  return {
    nc: {
      url:  document.getElementById('nc-url').value.trim(),
      user: document.getElementById('nc-user').value.trim(),
      pass: document.getElementById('nc-pass').value,
    },
    og: {
      name:        document.getElementById('og-name').value.trim(),
      lv:          document.getElementById('og-lv').value.trim(),
      bezirk:      document.getElementById('og-bv-name').value.trim(),
      strasse:     document.getElementById('og-strasse').value.trim(),
      plz:         document.getElementById('og-plz').value.trim(),
      ort:         document.getElementById('og-ort').value.trim(),
      email:       document.getElementById('og-email').value.trim(),
      web:         document.getElementById('og-web').value.trim(),
      iban:        document.getElementById('og-iban').value.trim(),
      bic:         document.getElementById('og-bic').value.trim(),
      bank:        document.getElementById('og-bank').value.trim(),
      amtsgericht: document.getElementById('og-amtsgericht').value.trim(),
      steuernr:    document.getElementById('og-steuernr').value.trim(),
      vorstand1:   document.getElementById('og-vorstand1').value.trim(),
      vorstand2:   document.getElementById('og-vorstand2').value.trim(),
      finanzen:    document.getElementById('og-finanzen').value.trim(),
    },
    stundenRate: {
      stunden: parseInt(document.getElementById('stunden-rate-h').value, 10)   || 3,
      euro:    parseInt(document.getElementById('stunden-rate-eur').value, 10) || 10,
    },
    einsatztypen: document.getElementById('einsatztypen').value
      .split(',').map(s => s.trim()).filter(Boolean),
  };
}

/* ── Mitgliederliste ────────────────────────────────────────── */

export { parseMitglieder } from './mitglieder.js';

function zeigeNcMitglieder(mitglieder) {
  const el = document.getElementById('mitglieder-liste');
  if (!el || !mitglieder.length) return;
  el.innerHTML = '';

  const p = document.createElement('p');
  p.className = 'text-sm';
  p.style.marginBottom = '8px';
  p.textContent = `${mitglieder.length} Mitglieder geladen:`;
  el.appendChild(p);

  const flex = document.createElement('div');
  flex.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  for (const m of mitglieder) {
    const span = document.createElement('span');
    span.className = 'badge badge-blue';
    span.textContent = m.name;
    flex.appendChild(span);
  }
  el.appendChild(flex);
}

/* ── Event-Handler ──────────────────────────────────────────── */

document.getElementById('btn-test').addEventListener('click', async () => {
  const daten  = formularLesen();
  const client = createWebDavClient(daten.nc);
  zeigeStatus('verbindung-status', 'Teste…', 'info');
  const r = await client.testConnection();
  if (r.ok) {
    zeigeStatus('verbindung-status', '✓ Verbindung OK', 'ok');
  } else {
    zeigeStatus('verbindung-status', '✗ ' + r.error, 'error');
  }
});

document.getElementById('btn-mitglieder-import').addEventListener('click', () => {
  const text = document.getElementById('mitglieder-input').value;
  if (!text.trim()) {
    zeigeStatus('mitglieder-status', 'Kein Text eingegeben', 'warn');
    return;
  }
  const { mitglieder, fehler } = parseMitglieder(text);
  if (!mitglieder.length) {
    zeigeStatus('mitglieder-status', 'Keine Mitglieder erkannt', 'error');
    return;
  }

  // In aktuelle Einstellungen einmergen
  const lokal = leseLokal() || { ...DEFAULTS };
  lokal.mitglieder = mitglieder;
  schreibeLokal(lokal);

  zeigeNcMitglieder(mitglieder);
  zeigeStatus('mitglieder-status',
    `✓ ${mitglieder.length} importiert${fehler.length ? `, ${fehler.length} Zeilen ignoriert` : ''}`,
    fehler.length ? 'warn' : 'ok');
});

document.getElementById('btn-speichern').addEventListener('click', async () => {
  const daten  = formularLesen();
  const lokal  = leseLokal() || {};
  const gesamt = { ...lokal, ...daten, mitglieder: lokal.mitglieder || [] };

  // Passwort nicht persistent speichern
  const pass = gesamt.nc?.pass || '';
  if (pass) sessionStorage.setItem('lo_nc_pass', pass);
  const gesamtOhnePass = { ...gesamt, nc: { ...gesamt.nc, pass: '' } };
  schreibeLokal(gesamtOhnePass);

  const ncPass = pass || sessionStorage.getItem('lo_nc_pass') || '';
  const client = createWebDavClient({ ...daten.nc, pass: ncPass });
  zeigeStatus('speichern-status', 'Speichern…', 'info');
  const r = await schreibeAufNc(client, gesamtOhnePass);
  if (r.ok) {
    zeigeStatus('speichern-status', '✓ Gespeichert', 'ok');
  } else {
    zeigeStatus('speichern-status', '⚠ Lokal gespeichert, NC: ' + r.error, 'warn');
  }
});

/* ── Download als data/einstellungen.json ───────────────────── */

document.getElementById('btn-download-einstellungen')?.addEventListener('click', () => {
  const lokal = leseLokal();
  if (!lokal) { alert('Keine Einstellungen zum Exportieren.'); return; }
  downloadAlsJson(lokal, 'einstellungen.json');
});

/* ── Init ───────────────────────────────────────────────────── */

async function init() {
  // 1. Erst localStorage
  let lokal = leseLokal();

  // 2. Kein localStorage → data/einstellungen.json als Fallback
  if (!lokal) {
    lokal = await ladeDefaultEinstellungen();
    if (lokal) {
      schreibeLokal(lokal);
    }
  }

  if (lokal) {
    formularFuellen(lokal);
    // Passwort aus sessionStorage (wird nicht persistent gespeichert)
    const sessionPass = sessionStorage.getItem('lo_nc_pass');
    if (sessionPass) {
      const passField = document.getElementById('nc-pass');
      if (passField) passField.value = sessionPass;
    }
    // 3. NC-Sync falls Zugangsdaten vorhanden
    const ncPass = lokal.nc?.pass || sessionStorage.getItem('lo_nc_pass') || '';
    if (lokal.nc?.url && lokal.nc?.user && ncPass) {
      const client = ladeClient({ ...lokal, nc: { ...lokal.nc, pass: ncPass } });
      const ncDaten = await leseVonNc(client);
      if (ncDaten) {
        formularFuellen(ncDaten);
        // Passwort aus sessionStorage nach NC-Sync erneut eintragen (ncDaten hat kein pass)
        if (sessionPass) {
          const passField = document.getElementById('nc-pass');
          if (passField) passField.value = sessionPass;
        }
        const ncDatenOhnePass = { ...ncDaten, nc: { ...ncDaten.nc, pass: '' } };
        schreibeLokal(ncDatenOhnePass);
      }
    }
  } else {
    // Keine Daten nirgends — Defaults aus Code laden
    formularFuellen(DEFAULTS);
  }
}

init();
