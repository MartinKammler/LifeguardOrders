/**
 * artikel-app.js
 * Logik für artikel.html — Artikelkatalog verwalten und importieren.
 */

import { parseBestellung }                     from './parser.js';
import { downloadAlsJson } from './defaults.js';
import { html, raw, setHTML }                  from './dom.js';
import { getSession }                          from './session.js';
import { darfAktion }                          from './authz.js';
import { confirmDialog, renderSyncBanner, toast } from './ui-feedback.js';
import { createClientFromLocalNc }             from './app-context.js';
import { validateArtikel }                     from './validation.js';
import {
  fuegeArtikelHinzu,
  loescheArtikel,
  aktualisiereArtikel,
} from './artikel-katalog.js';
import {
  getScopeSyncStatus,
  getSyncState,
  hydrateJsonFromSync,
  persistJsonWithSync,
  syncHinweisText,
} from './sync.js';

const STORAGE_KEY_A  = 'lo_artikel';
const NC_PFAD_A      = '/LifeguardOrders/artikel.json';
const SYNC_SCOPE_A   = 'artikel';

/* ── Zustand ────────────────────────────────────────────────── */
let artikel    = [];   // aktueller Katalog
let importiert = [];   // geparste Artikel aus Import-Vorschau
let client     = null;

function darfArtikelSchreiben() {
  return darfAktion('artikel-schreiben', getSession());
}

/* ── Hilfsfunktionen ────────────────────────────────────────── */

function eur(wert) {
  return wert.toFixed(2).replace('.', ',') + ' €';
}

function uuid() {
  return crypto.randomUUID();
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

let komponenten = [];   // Arbeits-Array für den Modal-Komponenten-Editor

function renderKomponenten() {
  const liste = document.getElementById('m-komponenten-liste');
  if (!liste) return;
  if (!komponenten.length) {
    setHTML(liste, '<p class="text-sm" style="color:var(--text-2);margin:0">Noch keine Komponenten angelegt.</p>');
    return;
  }
  setHTML(liste, html`${komponenten.map((k, i) => html`
    <div style="display:grid;grid-template-columns:1fr 60px 110px auto;gap:6px;margin-bottom:6px;align-items:end">
      <div>
        <label style="font-size:.75rem;color:var(--text-2)">Bezeichnung</label>
        <input type="text" class="k-label" data-idx="${i}" value="${k.label}" placeholder="z.B. T-Shirt JAKO Rot">
      </div>
      <div>
        <label style="font-size:.75rem;color:var(--text-2)">Menge</label>
        <input type="number" class="k-menge" data-idx="${i}" value="${k.menge}" min="1">
      </div>
      <div>
        <label style="font-size:.75rem;color:var(--text-2)">Artikel-Nr.</label>
        <input type="text" class="k-artikelnr" data-idx="${i}" value="${k.optionen[0]?.artikelNr || ''}" placeholder="18507110">
      </div>
      <div style="padding-top:18px">
        <button type="button" class="btn btn-danger btn-sm" data-action="k-loeschen" data-idx="${i}">×</button>
      </div>
    </div>`)}
  `);

  liste.querySelectorAll('[data-action="k-loeschen"]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      komponenten.splice(idx, 1);
      renderKomponenten();
    });
  });
}

function liesKomponentenAusDOM() {
  const labels     = [...document.querySelectorAll('#m-komponenten-liste .k-label')];
  const mengen     = [...document.querySelectorAll('#m-komponenten-liste .k-menge')];
  const artikelNrs = [...document.querySelectorAll('#m-komponenten-liste .k-artikelnr')];
  komponenten = labels.map((el, i) => {
    const artikelNr = artikelNrs[i]?.value.trim() || '';
    const label     = el.value.trim();
    const menge     = parseInt(mengen[i]?.value, 10) || 1;
    return {
      label,
      menge,
      optionen: [{ artikelNr, name: label }],
    };
  });
}

function zeigeStatus(elId, text, art = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  const klassen = { ok: 'badge badge-green', error: 'badge badge-red',
                    info: 'badge badge-blue', warn: 'badge badge-amber' };
  el.className = klassen[art] || klassen.info;
  el.textContent = text;
}

function updateSyncBanner() {
  renderSyncBanner({
    target: document.getElementById('sync-status-banner'),
    status: getScopeSyncStatus(getSyncState(), SYNC_SCOPE_A),
    label: 'Artikelkatalog',
    onReload: () => window.location.reload(),
    exportData: () => artikel,
    exportFilename: 'artikel-konfliktkopie.json',
  });
}

/* ── Persistenz ─────────────────────────────────────────────── */

async function ladeArtikel() {
  artikel = [];

  if (client) {
    const geladen = await hydrateJsonFromSync({
      scope: SYNC_SCOPE_A,
      client,
      remotePath: NC_PFAD_A,
      isValidRemote: data => Array.isArray(data),
      defaultData: [],
    });
    if (Array.isArray(geladen.data)) {
      artikel = geladen.data;
    }
  }
  updateSyncBanner();
  renderKatalog();
}

async function speichereArtikel() {
  return persistJsonWithSync({
    scope: SYNC_SCOPE_A,
    data: artikel,
    client,
    remotePath: NC_PFAD_A,
  });
}

/* ── Render ─────────────────────────────────────────────────── */

function renderKatalog() {
  const el = document.getElementById('katalog-inhalt');
  if (!artikel.length) {
    setHTML(el, `
      <div class="leer-hinweis">
        <p>Noch keine Artikel im Katalog.</p>
        <p class="text-sm">Importiere Artikel aus einer Auftragsbestätigung oder lege sie manuell an.</p>
        <button class="btn btn-ghost" onclick="document.getElementById('btn-import-toggle').click()">
          Aus Materialstelle importieren
        </button>
      </div>`);
    return;
  }

  setHTML(el, html`
    <table>
      <thead>
        <tr>
          <th>Artikel-Nr.</th>
          <th>Größe</th>
          <th>Bezeichnung</th>
          <th class="preis">Einzelpreis</th>
          <th class="preis">BV</th>
          <th class="preis">LV</th>
          <th class="preis">OG</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${artikel.map(a => html`
          <tr>
            <td class="artikel-nr">${a.artikelNr}</td>
            <td class="artikel-nr">${a.variante || '–'}</td>
            <td>${a.name}${raw(a.istPaket ? ' <span class="badge badge-blue" style="font-size:.72rem;vertical-align:middle">Paket</span>' : '')}</td>
            <td class="preis">${eur(a.einzelpreis)}</td>
            <td class="foerder">${a.bvFoerderung ? eur(a.bvFoerderung) : '–'}</td>
            <td class="foerder">${a.lvFoerderung ? eur(a.lvFoerderung) : '–'}</td>
            <td class="foerder">
              ${a.ogUebernimmtRest
                ? raw('<span class="og-chip">übernimmt Rest</span>')
                : a.ogFoerderung ? eur(a.ogFoerderung) : '–'}
            </td>
            <td class="text-right" style="white-space:nowrap">
              <button class="btn btn-ghost btn-sm" data-action="bearbeiten" data-id="${a.id}">Bearbeiten</button>
              <button class="btn btn-danger btn-sm" data-action="loeschen" data-id="${a.id}">Löschen</button>
            </td>
          </tr>`)}
      </tbody>
    </table>`);
}

function renderImportVorschau(geparst) {
  const el = document.getElementById('import-vorschau');
  if (!geparst.artikel.length && !geparst.ogKosten.length) {
    setHTML(el, '<p class="text-sm" style="margin-top:10px;color:var(--red)">Keine Artikel erkannt.</p>');
    return;
  }

  const ogZeilen = geparst.ogKosten.length
    ? raw(html`<p class="text-sm" style="margin-top:8px;color:var(--text-2)">
        OG-Kosten (nicht importiert): ${geparst.ogKosten.map(k => k.name).join(', ')}
       </p>`)
    : raw('');

  setHTML(el, html`
    <table style="margin-top:12px">
      <thead>
        <tr>
          <th>Artikel-Nr.</th>
          <th>Größe</th>
          <th>Bezeichnung</th>
          <th class="preis">Einzelpreis</th>
          <th class="preis">BV</th>
          <th class="preis">LV</th>
          <th>Menge</th>
        </tr>
      </thead>
      <tbody>
        ${geparst.artikel.map(a => html`
          <tr>
            <td class="artikel-nr">${a.artikelNr}</td>
            <td class="artikel-nr">${a.variante || '–'}</td>
            <td>${a.name}${raw(a.istPaket ? ' <span class="badge badge-blue" style="font-size:.72rem;vertical-align:middle">Paket</span>' : '')}</td>
            <td class="preis">${eur(a.einzelpreis)}</td>
            <td class="foerder">${a.bvFoerderung ? eur(a.bvFoerderung) : '–'}</td>
            <td class="foerder">${a.lvFoerderung ? eur(a.lvFoerderung) : '–'}</td>
            <td>${a.menge}</td>
          </tr>`)}
      </tbody>
    </table>
    ${ogZeilen}
    ${geparst.fehler.length
      ? raw(html`<p class="text-sm" style="margin-top:8px;color:var(--amber)">${geparst.fehler.length} Zeile(n) nicht erkannt.</p>`)
      : raw('')}`);
}

/* ── Modal ──────────────────────────────────────────────────── */

window.oeffneModal = function(id) {
  const a = id ? artikel.find(x => x.id === id) : null;
  document.getElementById('modal-titel').textContent = a ? 'Artikel bearbeiten' : 'Artikel anlegen';
  document.getElementById('modal-id').value        = a?.id        ?? '';
  document.getElementById('m-artikelnr').value     = a?.artikelNr ?? '';
  document.getElementById('m-variante').value      = a?.variante  ?? '';
  document.getElementById('m-name').value          = a?.name      ?? '';
  document.getElementById('m-einzelpreis').value   = a?.einzelpreis   ?? '';
  document.getElementById('m-bv').value            = a?.bvFoerderung  ?? 0;
  document.getElementById('m-lv').value            = a?.lvFoerderung  ?? 0;
  document.getElementById('m-og').value            = a?.ogFoerderung  ?? 0;
  document.getElementById('m-og-rest').checked     = a?.ogUebernimmtRest ?? false;
  const istPaket = a?.istPaket ?? false;
  document.getElementById('m-ist-paket').checked = istPaket;
  komponenten = a?.paketKomponenten ? JSON.parse(JSON.stringify(a.paketKomponenten)) : [];
  document.getElementById('m-paket-bereich').style.display = istPaket ? '' : 'none';
  renderKomponenten();
  document.getElementById('modal-backdrop').classList.add('open');
};

window.loescheArtikelUI = async function(id) {
  if (!darfArtikelSchreiben()) {
    toast('Du darfst den Artikelkatalog nicht bearbeiten.', 'error');
    return;
  }
  const bestaetigt = await confirmDialog({
    title: 'Artikel löschen?',
    body: 'Der Artikel wird aus dem Katalog entfernt.',
    confirmText: 'Löschen',
    confirmTone: 'danger',
  });
  if (!bestaetigt) return;
  const vorher = cloneData(artikel);
  artikel = loescheArtikel(artikel, id);
  const gespeichert = await speichereArtikel();
  if (!gespeichert.ok) {
    artikel = vorher;
    updateSyncBanner();
    toast(syncHinweisText(gespeichert.sync, 'Artikelkatalog'), 'error', 7000);
    return;
  }
  updateSyncBanner();
  renderKatalog();
  toast('Artikel gelöscht.', 'success');
};

document.getElementById('modal-abbrechen').addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.remove('open');
});

document.getElementById('m-ist-paket').addEventListener('change', e => {
  document.getElementById('m-paket-bereich').style.display = e.target.checked ? '' : 'none';
});

document.getElementById('btn-komponente-hinzufuegen').addEventListener('click', () => {
  liesKomponentenAusDOM();
  komponenten.push({ label: '', menge: 1, optionen: [{ artikelNr: '', name: '' }] });
  renderKomponenten();
  setTimeout(() => {
    const inputs = document.querySelectorAll('#m-komponenten-liste .k-label');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
});

document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget)
    document.getElementById('modal-backdrop').classList.remove('open');
});

document.getElementById('modal-speichern').addEventListener('click', async () => {
  if (!darfArtikelSchreiben()) {
    toast('Du darfst den Artikelkatalog nicht bearbeiten.', 'error');
    return;
  }
  const id = document.getElementById('modal-id').value;
  liesKomponentenAusDOM();
  const istPaket = document.getElementById('m-ist-paket').checked;
  const geaendert = {
    id:              id || uuid(),
    artikelNr:       document.getElementById('m-artikelnr').value.trim(),
    variante:        document.getElementById('m-variante').value.trim().toUpperCase(),
    name:            document.getElementById('m-name').value.trim(),
    einzelpreis:     parseFloat(document.getElementById('m-einzelpreis').value) || 0,
    bvFoerderung:    parseFloat(document.getElementById('m-bv').value) || 0,
    lvFoerderung:    parseFloat(document.getElementById('m-lv').value) || 0,
    ogFoerderung:    parseFloat(document.getElementById('m-og').value) || 0,
    ogUebernimmtRest: document.getElementById('m-og-rest').checked,
    istPaket,
    paketKomponenten: istPaket ? [...komponenten] : [],
  };

  const validierung = validateArtikel(geaendert);
  if (!validierung.ok) {
    toast(validierung.fehler, 'error');
    return;
  }

  const vorher = cloneData(artikel);
  artikel = id
    ? aktualisiereArtikel(artikel, geaendert)
    : [...artikel, geaendert];

  const gespeichert = await speichereArtikel();
  if (!gespeichert.ok) {
    artikel = vorher;
    updateSyncBanner();
    toast(syncHinweisText(gespeichert.sync, 'Artikelkatalog'), 'error', 7000);
    return;
  }
  updateSyncBanner();
  renderKatalog();
  document.getElementById('modal-backdrop').classList.remove('open');
  toast(id ? 'Artikel aktualisiert.' : 'Artikel angelegt.', 'success');
});

/* ── Import ─────────────────────────────────────────────────── */

document.getElementById('btn-import-toggle').addEventListener('click', () => {
  const el = document.getElementById('import-bereich');
  el.classList.toggle('open');
});

document.getElementById('btn-parsen').addEventListener('click', () => {
  const text = document.getElementById('import-text').value;
  if (!text.trim()) {
    zeigeStatus('import-status', 'Kein Text eingegeben', 'warn');
    return;
  }
  const geparst = parseBestellung(text);
  const ungueltig = geparst.artikel.filter(a => !validateArtikel(a).ok);
  importiert = geparst.artikel.filter(a => validateArtikel(a).ok);

  if (!importiert.length) {
    zeigeStatus('import-status', 'Keine Artikel erkannt', 'error');
    document.getElementById('btn-uebernehmen').style.display = 'none';
    setHTML(document.getElementById('import-vorschau'), '');
    return;
  }

  renderImportVorschau(geparst);
  document.getElementById('btn-uebernehmen').style.display = 'inline-flex';
  zeigeStatus(
    'import-status',
    `${importiert.length} Artikel erkannt${ungueltig.length ? `, ${ungueltig.length} ungültig verworfen` : ''}`,
    ungueltig.length ? 'warn' : 'ok'
  );
});

document.getElementById('btn-uebernehmen').addEventListener('click', async () => {
  if (!darfArtikelSchreiben()) {
    toast('Du darfst den Artikelkatalog nicht bearbeiten.', 'error');
    return;
  }
  const { katalog: neu, hinzugefuegt, aktualisiert, duplikate, ungueltig } = fuegeArtikelHinzu(artikel, importiert);
  const vorher = cloneData(artikel);
  artikel = neu;
  const gespeichert = await speichereArtikel();
  if (!gespeichert.ok) {
    artikel = vorher;
    updateSyncBanner();
    toast(syncHinweisText(gespeichert.sync, 'Artikelkatalog'), 'error', 7000);
    return;
  }
  updateSyncBanner();
  renderKatalog();

  document.getElementById('import-bereich').classList.remove('open');
  document.getElementById('import-text').value = '';
  setHTML(document.getElementById('import-vorschau'), '');
  document.getElementById('btn-uebernehmen').style.display = 'none';

  const meldungen = [];
  if (hinzugefuegt.length) {
    meldungen.push(`${hinzugefuegt.length} Artikel neu hinzugefügt.`);
  }
  if (aktualisiert.length) {
    meldungen.push(`${aktualisiert.length} vorhandene Artikel mit neuem Preis/Förderung überschrieben:\n${aktualisiert.join(', ')}`);
  }
  if (duplikate.length) {
    meldungen.push(`${duplikate.length} identische Artikel übersprungen:\n${duplikate.join(', ')}`);
  }
  if (ungueltig.length) {
    meldungen.push(`${ungueltig.length} ungültige Artikel verworfen.`);
  }
  if (meldungen.length) toast(meldungen.join('\n'), 'info', 9000);
});

document.getElementById('btn-neu').addEventListener('click', () => {
  if (!darfArtikelSchreiben()) {
    toast('Du darfst den Artikelkatalog nicht bearbeiten.', 'error');
    return;
  }
  oeffneModal(null);
});

/* ── Init ───────────────────────────────────────────────────── */

document.getElementById('btn-download-artikel')?.addEventListener('click', () => {
  if (!artikel.length) { toast('Kein Katalog zum Exportieren.', 'warn'); return; }
  downloadAlsJson(artikel, 'artikel.json');
});

async function init() {
  client = createClientFromLocalNc();
  await ladeArtikel();

  // Delegierter Event-Listener auf der Katalog-Tabelle (einmalig registriert)
  const tabelleEl = document.getElementById('katalog-inhalt');
  tabelleEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'bearbeiten') oeffneModal(id);
    if (btn.dataset.action === 'loeschen')   loescheArtikelUI(id);
  });
}

init();
