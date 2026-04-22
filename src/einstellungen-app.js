/**
 * einstellungen-app.js
 * Logik für einstellungen.html
 */

import { createWebDavClient }                        from './webdav.js';
import { parseMitglieder }                           from './mitglieder.js';
import { downloadAlsJson } from './defaults.js';
import { confirmDialog, renderSyncBanner, toast }    from './ui-feedback.js';
import { leseNcKonfiguration, speichereNcKonfiguration } from './auth.js';
import {
  getScopeSyncStatus,
  getSyncState,
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

let importierteMitglieder = null;

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
  const nc = einstellungen.nc || {};
  if (!nc.url || !nc.user) return null;
  return createWebDavClient(nc);
}

function updateSyncBanner(exportData = null) {
  renderSyncBanner({
    target: document.getElementById('sync-status-banner'),
    status: getScopeSyncStatus(getSyncState(), SYNC_SCOPE_E),
    label: 'Einstellungen',
    onReload: () => window.location.reload(),
    exportData,
    exportFilename: 'einstellungen-konfliktkopie.json',
  });
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

  importierteMitglieder = e.mitglieder || [];
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
    toast('Nextcloud-Verbindung erfolgreich getestet.', 'success');
  } else {
    zeigeStatus('verbindung-status', '✗ ' + r.error, 'error');
    toast(`Nextcloud-Verbindung fehlgeschlagen: ${r.error}`, 'error', 7000);
  }
});

document.getElementById('btn-mitglieder-import').addEventListener('click', () => {
  const text = document.getElementById('mitglieder-input').value;
  if (!text.trim()) {
    zeigeStatus('mitglieder-status', 'Kein Text eingegeben', 'warn');
    toast('Kein Mitglieder-Text eingegeben.', 'warn');
    return;
  }
  const { mitglieder, fehler } = parseMitglieder(text);
  if (!mitglieder.length) {
    zeigeStatus('mitglieder-status', 'Keine Mitglieder erkannt', 'error');
    toast('Keine Mitglieder erkannt.', 'error');
    return;
  }

  importierteMitglieder = mitglieder;

  zeigeNcMitglieder(mitglieder);
  zeigeStatus('mitglieder-status',
    `✓ ${mitglieder.length} Mitglieder übernommen${fehler.length ? ` (${fehler.length} Zeilen ignoriert)` : ''} – bitte noch speichern`,
    fehler.length ? 'warn' : 'ok');
  toast(
    `${mitglieder.length} Mitglieder übernommen${fehler.length ? `, ${fehler.length} Zeilen ignoriert` : ''}.`,
    fehler.length ? 'warn' : 'success',
    5000
  );
});

document.getElementById('btn-speichern').addEventListener('click', async () => {
  const daten  = formularLesen();
  const gesamt = { ...daten, mitglieder: importierteMitglieder || [] };

  // Passwort nicht persistent speichern
  const pass = gesamt.nc?.pass || '';
  if (pass) sessionStorage.setItem('lo_nc_pass', pass);
  speichereNcKonfiguration(gesamt.nc);
  const gesamtOhnePass = { ...gesamt, nc: { ...gesamt.nc, pass: '' } };

  const ncPass = pass || sessionStorage.getItem('lo_nc_pass') || '';
  const client = daten.nc?.url && daten.nc?.user && ncPass
    ? createWebDavClient({ ...daten.nc, pass: ncPass })
    : null;
  zeigeStatus('speichern-status', 'Speichern…', 'info');

  while (true) {
    const gespeichert = await persistJsonWithSync({
      scope: SYNC_SCOPE_E,
      storageKey: STORAGE_KEY,
      data: gesamtOhnePass,
      client,
      remotePath: NC_PFAD,
    });
    if (gespeichert.ok) {
      zeigeStatus('speichern-status', '✓ Gespeichert', 'ok');
      updateSyncBanner();
      toast('Einstellungen gespeichert.', 'success');
      return;
    }

    const fehlertext = syncHinweisText(gespeichert.sync, 'Einstellungen');
    zeigeStatus('speichern-status', fehlertext, 'error');
    updateSyncBanner(() => gesamtOhnePass);

    const anzahlMitglieder = (gesamtOhnePass.mitglieder || []).length;
    const erneutVersuchen = await confirmDialog({
      title: 'Einstellungen konnten nicht gespeichert werden',
      body: `${fehlertext}\n\nDeine Eingaben (inkl. ${anzahlMitglieder} Mitglieder) sind nur im Arbeitsspeicher. Beim Neuladen gehen sie verloren.\n\n„Erneut versuchen" → Speichern wiederholen.\n„Als JSON sichern" → Download als Backup, anschließend manuell erneut einspielen.`,
      confirmText: 'Erneut versuchen',
      cancelText: 'Als JSON sichern',
      confirmTone: 'primary',
    });

    if (!erneutVersuchen) {
      downloadAlsJson(gesamtOhnePass, 'einstellungen-backup.json');
      toast('Backup als JSON heruntergeladen. Bitte nach Verbindungsaufbau erneut öffnen und speichern.', 'warn', 10000);
      return;
    }
    zeigeStatus('speichern-status', 'Speichern…', 'info');
  }
});

/* ── Download als data/einstellungen.json ───────────────────── */

document.getElementById('btn-download-einstellungen')?.addEventListener('click', () => {
  const daten = { ...formularLesen(), mitglieder: importierteMitglieder || [] };
  downloadAlsJson({ ...daten, nc: { ...daten.nc, pass: '' } }, 'einstellungen.json');
  toast('Einstellungen exportiert.', 'info');
});

/* ── Init ───────────────────────────────────────────────────── */

async function init() {
  const nc = leseNcKonfiguration();
  const sessionPass = sessionStorage.getItem('lo_nc_pass') || '';
  formularFuellen({ ...DEFAULTS, nc: { ...DEFAULTS.nc, ...nc, pass: '' } });
  const passField = document.getElementById('nc-pass');
  if (passField && sessionPass) {
    passField.value = sessionPass;
  }

  if (nc.url && nc.user && sessionPass) {
    const client = ladeClient({ nc: { ...nc, pass: sessionPass } });
    const geladen = await hydrateJsonFromSync({
      scope: SYNC_SCOPE_E,
      storageKey: STORAGE_KEY,
      client,
      remotePath: NC_PFAD,
      isValidRemote: data => !!data && typeof data === 'object' && !Array.isArray(data),
      defaultData: null,
    });
    if (geladen.data) {
      formularFuellen({
        ...geladen.data,
        nc: { ...(geladen.data.nc || {}), url: nc.url, user: nc.user, pass: '' },
      });
      if (passField) {
        passField.value = sessionPass;
      }
    } else if (geladen.source === 'remote-missing') {
      zeigeStatus('speichern-status', 'Noch keine Einstellungen auf Nextcloud gespeichert.', 'info');
    } else if (geladen.source !== 'remote') {
      zeigeStatus('speichern-status', syncHinweisText(geladen.sync, 'Einstellungen'), 'warn');
    }
  }
  updateSyncBanner();
}

init();
