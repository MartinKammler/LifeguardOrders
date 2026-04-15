/**
 * artikel-app.js
 * Logik für artikel.html — Artikelkatalog verwalten und importieren.
 */

import { createWebDavClient }                   from './webdav.js';
import { parseBestellung }                     from './parser.js';
import { ladeDefaultArtikel, downloadAlsJson } from './defaults.js';
import { load, save }                          from './storage.js';

const STORAGE_KEY_E  = 'lo_einstellungen';
const STORAGE_KEY_A  = 'lo_artikel';
const NC_PFAD_E      = '/LifeguardOrders/einstellungen.json';
const NC_PFAD_A      = '/LifeguardOrders/artikel.json';

/* ── Zustand ────────────────────────────────────────────────── */
let artikel    = [];   // aktueller Katalog
let importiert = [];   // geparste Artikel aus Import-Vorschau
let client     = null;

/* ── Hilfsfunktionen ────────────────────────────────────────── */

function eur(wert) {
  return wert.toFixed(2).replace('.', ',') + ' €';
}

function uuid() {
  return crypto.randomUUID();
}

function leseEinstellungen() { return load(STORAGE_KEY_E); }

function zeigeStatus(elId, text, art = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  const klassen = { ok: 'badge badge-green', error: 'badge badge-red',
                    info: 'badge badge-blue', warn: 'badge badge-amber' };
  el.className = klassen[art] || klassen.info;
  el.textContent = text;
}

/* ── Artikel-Logik (rein, ohne DOM) ────────────────────────── */

function artikelKey(a) { return a.artikelNr + '|' + (a.variante ?? a.name); }

export function fuegeArtikelHinzu(katalog, neueArtikel) {
  const vorhanden   = new Set(katalog.map(artikelKey));
  const hinzugefuegt = [];
  const duplikate    = [];
  for (const a of neueArtikel) {
    if (vorhanden.has(artikelKey(a))) {
      duplikate.push(a.artikelNr);
    } else {
      const mitId = { ...a, id: uuid() };
      hinzugefuegt.push(mitId);
      vorhanden.add(artikelKey(a));
    }
  }
  return { katalog: [...katalog, ...hinzugefuegt], duplikate };
}

export function loescheArtikel(katalog, id) {
  return katalog.filter(a => a.id !== id);
}

export function aktualisiereArtikel(katalog, geaendert) {
  return katalog.map(a => a.id === geaendert.id ? { ...a, ...geaendert } : a);
}

/* ── Persistenz ─────────────────────────────────────────────── */

async function ladeArtikel() {
  artikel = load(STORAGE_KEY_A) || [];

  // Kein localStorage → data/artikel.json als Fallback
  if (!artikel.length) {
    const defaults = await ladeDefaultArtikel();
    if (defaults.length) {
      artikel = defaults;
      save(STORAGE_KEY_A, artikel);
    }
  }

  if (client) {
    const r = await client.readJson(NC_PFAD_A);
    if (r.ok && Array.isArray(r.data) && r.data.length) {
      artikel = r.data;
      save(STORAGE_KEY_A, artikel);
    }
  }
  renderKatalog();
}

async function speichereArtikel() {
  save(STORAGE_KEY_A, artikel);
  if (client) {
    await client.writeJson(NC_PFAD_A, artikel);
  }
}

/* ── Render ─────────────────────────────────────────────────── */

function renderKatalog() {
  const el = document.getElementById('katalog-inhalt');
  if (!artikel.length) {
    el.innerHTML = `
      <div class="leer-hinweis">
        <p>Noch keine Artikel im Katalog.</p>
        <p class="text-sm">Importiere Artikel aus einer Auftragsbestätigung oder lege sie manuell an.</p>
        <button class="btn btn-ghost" onclick="document.getElementById('btn-import-toggle').click()">
          Aus Materialstelle importieren
        </button>
      </div>`;
    return;
  }

  el.innerHTML = `
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
        ${artikel.map(a => `
          <tr>
            <td class="artikel-nr">${a.artikelNr}</td>
            <td class="artikel-nr">${a.variante || '–'}</td>
            <td>${a.name}</td>
            <td class="preis">${eur(a.einzelpreis)}</td>
            <td class="foerder">${a.bvFoerderung ? eur(a.bvFoerderung) : '–'}</td>
            <td class="foerder">${a.lvFoerderung ? eur(a.lvFoerderung) : '–'}</td>
            <td class="foerder">
              ${a.ogUebernimmtRest
                ? '<span class="og-chip">übernimmt Rest</span>'
                : a.ogFoerderung ? eur(a.ogFoerderung) : '–'}
            </td>
            <td class="text-right" style="white-space:nowrap">
              <button class="btn btn-ghost btn-sm" onclick="oeffneModal('${a.id}')">Bearbeiten</button>
              <button class="btn btn-danger btn-sm" onclick="loescheArtikelUI('${a.id}')">Löschen</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderImportVorschau(geparst) {
  const el = document.getElementById('import-vorschau');
  if (!geparst.artikel.length && !geparst.ogKosten.length) {
    el.innerHTML = '<p class="text-sm" style="margin-top:10px;color:var(--red)">Keine Artikel erkannt.</p>';
    return;
  }

  const ogZeilen = geparst.ogKosten.length
    ? `<p class="text-sm" style="margin-top:8px;color:var(--text-2)">
        OG-Kosten (nicht importiert): ${geparst.ogKosten.map(k => k.name).join(', ')}
       </p>` : '';

  el.innerHTML = `
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
        ${geparst.artikel.map((a, i) => `
          <tr>
            <td class="artikel-nr">${a.artikelNr}</td>
            <td class="artikel-nr">${a.variante || '–'}</td>
            <td>${a.name}</td>
            <td class="preis">${eur(a.einzelpreis)}</td>
            <td class="foerder">${a.bvFoerderung ? eur(a.bvFoerderung) : '–'}</td>
            <td class="foerder">${a.lvFoerderung ? eur(a.lvFoerderung) : '–'}</td>
            <td>${a.menge}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    ${ogZeilen}
    ${geparst.fehler.length ? `<p class="text-sm" style="margin-top:8px;color:var(--amber)">${geparst.fehler.length} Zeile(n) nicht erkannt.</p>` : ''}`;
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
  document.getElementById('modal-backdrop').classList.add('open');
};

window.loescheArtikelUI = async function(id) {
  if (!confirm('Artikel wirklich löschen?')) return;
  artikel = loescheArtikel(artikel, id);
  await speichereArtikel();
  renderKatalog();
};

document.getElementById('modal-abbrechen').addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.remove('open');
});

document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget)
    document.getElementById('modal-backdrop').classList.remove('open');
});

document.getElementById('modal-speichern').addEventListener('click', async () => {
  const id = document.getElementById('modal-id').value;
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
  };

  if (!geaendert.artikelNr || !geaendert.name) {
    alert('Bitte Artikel-Nr. und Bezeichnung ausfüllen.');
    return;
  }

  artikel = id
    ? aktualisiereArtikel(artikel, geaendert)
    : [...artikel, geaendert];

  await speichereArtikel();
  renderKatalog();
  document.getElementById('modal-backdrop').classList.remove('open');
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
  importiert = geparst.artikel;

  if (!importiert.length) {
    zeigeStatus('import-status', 'Keine Artikel erkannt', 'error');
    document.getElementById('btn-uebernehmen').style.display = 'none';
    document.getElementById('import-vorschau').innerHTML = '';
    return;
  }

  renderImportVorschau(geparst);
  document.getElementById('btn-uebernehmen').style.display = 'inline-flex';
  zeigeStatus('import-status', `${importiert.length} Artikel erkannt`, 'ok');
});

document.getElementById('btn-uebernehmen').addEventListener('click', async () => {
  const { katalog: neu, duplikate } = fuegeArtikelHinzu(artikel, importiert);
  artikel = neu;
  await speichereArtikel();
  renderKatalog();

  document.getElementById('import-bereich').classList.remove('open');
  document.getElementById('import-text').value = '';
  document.getElementById('import-vorschau').innerHTML = '';
  document.getElementById('btn-uebernehmen').style.display = 'none';

  if (duplikate.length) {
    alert(`${duplikate.length} Artikel-Nr. bereits vorhanden und übersprungen:\n${duplikate.join(', ')}`);
  }
});

document.getElementById('btn-neu').addEventListener('click', () => oeffneModal(null));

/* ── Init ───────────────────────────────────────────────────── */

document.getElementById('btn-download-artikel')?.addEventListener('click', () => {
  if (!artikel.length) { alert('Kein Katalog zum Exportieren.'); return; }
  downloadAlsJson(artikel, 'artikel.json');
});

async function init() {
  const e = leseEinstellungen();
  const ncPass = e?.nc?.pass || sessionStorage.getItem('lo_nc_pass') || '';
  if (e?.nc?.url && e?.nc?.user && ncPass) {
    client = createWebDavClient({ ...e.nc, pass: ncPass });
  }
  await ladeArtikel();
}

init();
