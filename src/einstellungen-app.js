/**
 * einstellungen-app.js
 * Logik für einstellungen.html
 */

import { createWebDavClient }                        from './webdav.js';
import { parseMitglieder }                           from './mitglieder.js';
import { ladeDefaultEinstellungen, downloadAlsJson } from './defaults.js';
import { load, save }                                from './storage.js';
import {
  hydrateJsonFromSync,
  persistJsonWithSync,
  syncHinweisText,
} from './sync.js';

const STORAGE_KEY = 'lo_einstellungen';
const NC_PFAD     = '/LifeguardOrders/einstellungen.json';
const SYNC_SCOPE_E = 'einstellungen';

const DEFAULTS = {
  nc: {
    url:  '',
    user: '',
    pass: '',
  },
  og: {
    name:        'OG Beispielstadt e.V.',
    lv:          'Landesverband Beispiel',
    bezirk:      'Bezirk Muster',
    strasse:     'Musterstr. 1',
    plz:         '12345',
    ort:         'Beispielstadt',
    email:       'kasse@example.org',
    web:         'www.example.org',
    iban:        'DE00 0000 0000 0000 0000 00',
    bic:         'GENODE00XXX',
    bank:        'Beispielbank',
    amtsgericht: 'Musterstadt VR 12345',
    steuernr:    '00/000/00000',
    vorstand1:   'Max Beispiel',
    vorstand2:   'Erika Beispiel',
    finanzen:    'Pat Beispiel',
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

  const ncPass = pass || sessionStorage.getItem('lo_nc_pass') || '';
  const client = daten.nc?.url && daten.nc?.user && ncPass
    ? createWebDavClient({ ...daten.nc, pass: ncPass })
    : null;
  zeigeStatus('speichern-status', 'Speichern…', 'info');
  const gespeichert = await persistJsonWithSync({
    scope: SYNC_SCOPE_E,
    storageKey: STORAGE_KEY,
    data: gesamtOhnePass,
    client,
    remotePath: NC_PFAD,
  });
  if (gespeichert.sync?.pending) {
    zeigeStatus('speichern-status', syncHinweisText(gespeichert.sync, 'Einstellungen'), 'warn');
  } else if (gespeichert.remote?.skipped) {
    zeigeStatus('speichern-status', '✓ Lokal gespeichert', 'ok');
  } else {
    zeigeStatus('speichern-status', '✓ Gespeichert', 'ok');
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
      const geladen = await hydrateJsonFromSync({
        scope: SYNC_SCOPE_E,
        storageKey: STORAGE_KEY,
        client,
        remotePath: NC_PFAD,
        isValidRemote: data => !!data && typeof data === 'object' && !Array.isArray(data),
      });
      if (geladen.data) {
        formularFuellen(geladen.data);
        // Passwort aus sessionStorage nach NC-Sync erneut eintragen (ncDaten hat kein pass)
        if (sessionPass) {
          const passField = document.getElementById('nc-pass');
          if (passField) passField.value = sessionPass;
        }
        const ncDatenOhnePass = { ...geladen.data, nc: { ...geladen.data.nc, pass: '' } };
        schreibeLokal(ncDatenOhnePass);
      }
    }
  } else {
    // Keine Daten nirgends — Defaults aus Code laden
    formularFuellen(DEFAULTS);
  }
}

init();
