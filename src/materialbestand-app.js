import { downloadAlsJson } from './defaults.js';
import { html, raw, setHTML } from './dom.js';
import { druckePDF } from './pdf.js';
import { auditAktion } from './audit.js';
import { EXTERN_ID, OG_ID } from './konstanten.js';
import { getSession } from './session.js';
import { canRead, darfAktion } from './authz.js';
import { confirmDialog, renderSyncBanner, toast } from './ui-feedback.js';
import { createClientFromLocalNc, ladeRemoteEinstellungen } from './app-context.js';
import {
  bucheMaterialBewegung,
  normalisiereMaterialEintrag,
  sortiereMaterialbestand,
  validateMaterialEintrag,
  zusammenfassungMaterialbestand,
} from './materialbestand.js';
import {
  normalisiereMaterialanfrage,
  sortiereMaterialanfragen,
  validateMaterialanfrage,
} from './materialanfragen.js';
import { erstelleLagerverkauf, findeArtikelFuerBestand } from './materialverkauf.js';
import {
  getScopeSyncStatus,
  getSyncState,
  hydrateJsonFromSync,
  persistJsonWithSync,
  syncHinweisText,
} from './sync.js';

const STORAGE_KEY_E = 'lo_einstellungen';
const STORAGE_KEY_M = 'lo_materialbestand';
const STORAGE_KEY_B = 'lo_bestellungen';
const STORAGE_KEY_A = 'lo_artikel';
const STORAGE_KEY_R = 'lo_materialanfragen';
const NC_PFAD_M = '/LifeguardOrders/materialbestand.json';
const NC_PFAD_B = '/LifeguardOrders/bestellungen.json';
const NC_PFAD_A = '/LifeguardOrders/artikel.json';
const NC_PFAD_R = '/LifeguardOrders/materialanfragen.json';
const SYNC_SCOPE_M = 'materialbestand';
const SYNC_SCOPE_B = 'bestellungen';
const SYNC_SCOPE_A = 'artikel';
const SYNC_SCOPE_R = 'materialanfragen';

let materialbestand = [];
let bestellungen = [];
let artikelListe = [];
let materialanfragen = [];
let einstellungen = null;
let mitglieder = [];
let client = null;
const offeneHistorien = new Set();
let _artikelBasenCache = null;

function darfMaterialbestandSchreiben() {
  return darfAktion('materialbestand-schreiben', getSession());
}

function darfLagerverkaufFinalisieren() {
  return darfAktion('lagerverkauf-finalisieren', getSession());
}

function darfLageranfrageFreigeben() {
  return darfAktion('lageranfrage-freigeben', getSession());
}

function darfRechnungenSehen() {
  return canRead('rechnungen', getSession());
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function aktiveRolle() {
  return String(getSession()?.rolle || '').trim();
}

function aktivePersonName() {
  const session = getSession();
  return session?.actingPersonName || session?.name || '';
}

async function schreibeAuditWarnung({ action, scope = 'materialbestand', entityId, summary, changes }) {
  const audit = await auditAktion({
    client,
    user: getSession(),
    action,
    scope,
    entityId,
    summary,
    changes,
  });
  if (!audit.ok) {
    toast(`Änderung gespeichert, aber Audit-Log konnte nicht geschrieben werden.\n${audit.remote?.error || 'Unbekannter Fehler.'}`, 'warn', 7000);
  }
  return audit;
}

function updateSyncBanner() {
  const state = getSyncState();
  const materialStatus = getScopeSyncStatus(state, SYNC_SCOPE_M);
  const bestellStatus = getScopeSyncStatus(state, SYNC_SCOPE_B);
  const anfrageStatus = getScopeSyncStatus(state, SYNC_SCOPE_R);
  const status = [materialStatus, bestellStatus, anfrageStatus].find(item => item && item.mode !== 'synced') || null;
  const label = status === bestellStatus
    ? 'Bestellungen'
    : status === anfrageStatus
      ? 'Lagerfreigaben'
      : 'Materialbestand';
  renderSyncBanner({
    target: document.getElementById('sync-status-banner'),
    status,
    label,
    onReload: () => window.location.reload(),
    exportData: () => ({ materialbestand, bestellungen, materialanfragen }),
    exportFilename: 'materialbestand-konfliktkopie.json',
  });
}

function eur(v) {
  return Number(v || 0).toFixed(2).replace('.', ',') + ' €';
}

const LEERE_VARIANTE = '__OHNE_VARIANTE__';

function materialKey(eintrag) {
  return `${eintrag.nummer}\x00${eintrag.variante || ''}\x00${eintrag.bezeichnung || ''}`;
}

function artikelBasisKey(artikel) {
  return `${String(artikel?.artikelNr || '').trim()}|||${String(artikel?.name || '').trim()}`;
}

function artikelBasisLabel(artikel) {
  return `${artikel?.name || ''} · ${artikel?.artikelNr || ''}`;
}

function gruppiereArtikelBasen() {
  if (_artikelBasenCache) return _artikelBasenCache;
  const map = new Map();
  for (const artikel of artikelListe) {
    const key = artikelBasisKey(artikel);
    const variante = String(artikel?.variante || '').trim().toUpperCase();
    if (!map.has(key)) {
      map.set(key, {
        key,
        artikelNr: String(artikel?.artikelNr || '').trim(),
        name: String(artikel?.name || '').trim(),
        varianten: new Set(),
      });
    }
    map.get(key).varianten.add(variante);
  }
  _artikelBasenCache = [...map.values()].sort((a, b) =>
    `${a.artikelNr}|||${a.name}`.localeCompare(`${b.artikelNr}|||${b.name}`, 'de')
  );
  return _artikelBasenCache;
}

function findePassendenArtikelZumFormular() {
  return artikelListe.find(artikel =>
    String(artikel.artikelNr || '').trim() === document.getElementById('m-nummer').value.trim() &&
    String(artikel.variante || '').trim().toUpperCase() === document.getElementById('m-variante').value.trim().toUpperCase() &&
    String(artikel.name || '').trim() === document.getElementById('m-bezeichnung').value.trim()
  ) || null;
}

function findePassendeArtikelbasisZumFormular() {
  return gruppiereArtikelBasen().find(artikel =>
    artikel.artikelNr === document.getElementById('m-nummer').value.trim() &&
    artikel.name === document.getElementById('m-bezeichnung').value.trim()
  ) || null;
}

function schliesseArtikelDropdown() {
  document.getElementById('m-artikel-dropdown').classList.remove('open');
}

function renderVarianteAuswahl(basisKey = '') {
  const select = document.getElementById('m-variante-auswahl');
  const wrap = document.getElementById('m-variante-auswahl-wrap');
  const basis = gruppiereArtikelBasen().find(artikel => artikel.key === basisKey);
  const optionen = basis
    ? [...basis.varianten].sort((a, b) => a.localeCompare(b, 'de'))
    : [];
  setHTML(select, html`
    <option value="">Katalog-Variante wählen …</option>
    ${optionen.map(variante => html`<option value="${variante || LEERE_VARIANTE}">${variante || 'Ohne Variante'}</option>`)}
  `);

  const aktuelleVariante = document.getElementById('m-variante').value.trim().toUpperCase();
  select.value = optionen.includes(aktuelleVariante)
    ? (aktuelleVariante || LEERE_VARIANTE)
    : '';
  select.disabled = optionen.length === 0;
  wrap.style.display = optionen.length ? '' : 'none';
}

function synchronisiereArtikelFeldAusFormular() {
  const basis = findePassendeArtikelbasisZumFormular();
  document.getElementById('m-artikel-basis-key').value = basis?.key || '';
  document.getElementById('m-artikel-suche').value = basis ? artikelBasisLabel(basis) : '';
  renderVarianteAuswahl(basis?.key || '');
}

function waehleArtikelFuerMaterialbestand(basisKey) {
  const basis = gruppiereArtikelBasen().find(item => item.key === basisKey);
  if (!basis) return;
  document.getElementById('m-artikel-basis-key').value = basis.key;
  document.getElementById('m-artikel-suche').value = artikelBasisLabel(basis);
  document.getElementById('m-nummer').value = basis.artikelNr || '';
  document.getElementById('m-bezeichnung').value = basis.name || '';
  renderVarianteAuswahl(basis.key);
  const optionen = [...basis.varianten];
  const aktuelleVariante = document.getElementById('m-variante').value.trim().toUpperCase();
  if (optionen.length === 1) {
    document.getElementById('m-variante').value = optionen[0];
    document.getElementById('m-variante-auswahl').value = optionen[0] || LEERE_VARIANTE;
  } else if (!optionen.includes(aktuelleVariante)) {
    document.getElementById('m-variante').value = '';
    document.getElementById('m-variante-auswahl').value = '';
  }
  schliesseArtikelDropdown();
}

function aktualisiereArtikelDropdown(suche) {
  const dropdown = document.getElementById('m-artikel-dropdown');
  const suchLower = suche.toLowerCase().trim();
  const gefiltert = suchLower
    ? gruppiereArtikelBasen()
        .filter(a => (
          `${a.artikelNr || ''} ${(a.name || '')}`
        ).toLowerCase().includes(suchLower))
        .sort((a, b) => {
          const aText = `${a.artikelNr || ''} ${(a.name || '')}`.toLowerCase();
          const bText = `${b.artikelNr || ''} ${(b.name || '')}`.toLowerCase();
          const aStarts = aText.startsWith(suchLower) ? 0 : 1;
          const bStarts = bText.startsWith(suchLower) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return `${a.artikelNr || ''}|||${a.name || ''}`.localeCompare(`${b.artikelNr || ''}|||${b.name || ''}`, 'de');
        })
    : [];

  if (!gefiltert.length) {
    setHTML(dropdown, '');
    dropdown.classList.remove('open');
    return;
  }

  setHTML(dropdown, html`${gefiltert.map(a => {
    const variantenAnzahl = a.varianten.size;
    return html`<div class="artikel-option" data-key="${a.key}">
      <div class="ao-name">${a.name}</div>
      <div class="ao-meta">${a.artikelNr}${variantenAnzahl ? ` · ${variantenAnzahl} Variante${variantenAnzahl === 1 ? '' : 'n'}` : ''}</div>
    </div>`;
  })}`);

  dropdown.querySelectorAll('.artikel-option').forEach(el => {
    el.addEventListener('mousedown', event => {
      event.preventDefault();
      waehleArtikelFuerMaterialbestand(el.dataset.key);
    });
  });

  dropdown.classList.add('open');
}

function mitgliedName(id) {
  if (id === OG_ID) return 'Ortsgruppe';
  if (id === EXTERN_ID) return 'Extern';
  const mitglied = mitglieder.find(item => item.id === id);
  return mitglied ? mitglied.name : id;
}

function anfrageStatusBadge(anfrage) {
  switch (anfrage.status) {
    case 'abgerechnet':
      return raw('<span class="badge badge-green">Abgerechnet</span>');
    case 'abgelehnt':
      return raw('<span class="badge badge-red">Abgelehnt</span>');
    default:
      return raw('<span class="badge badge-amber">Freigabe offen</span>');
  }
}

function anfrageEntscheidLabel(anfrage) {
  if (anfrage.status === 'abgelehnt') return 'Abgelehnt';
  if (anfrage.ogKostenlos) return 'OG übernimmt';
  if (anfrage.status === 'abgerechnet') return 'Normal abgerechnet';
  return anfrage.foerderwunsch ? 'Förderentscheidung angefragt' : 'Normale Abrechnung vorgesehen';
}

function alleRechnungen() {
  return bestellungen.flatMap(bestellung => bestellung.rechnungen || []);
}

function statusBadge(status) {
  switch (status) {
    case 'aktiv':
      return raw('<span class="badge badge-green">Aktiv</span>');
    case 'aufgebraucht':
      return raw('<span class="badge badge-amber">Aufgebraucht</span>');
    case 'ausgesondert':
      return raw('<span class="badge badge-red">Ausgesondert</span>');
    default:
      return raw('<span class="badge badge-blue">Unbekannt</span>');
  }
}

function bewegungLabel(typ) {
  switch (typ) {
    case 'zugang': return 'Zugang';
    case 'abgang': return 'Abgang';
    case 'storno': return 'Storno';
    default: return typ || 'Unbekannt';
  }
}

function gefilterterBestand() {
  const suche = document.getElementById('filter-suche').value.trim().toLowerCase();
  const status = document.getElementById('filter-status').value;

  return sortiereMaterialbestand(materialbestand).filter(eintrag => {
    if (status && eintrag.status !== status) return false;
    if (!suche) return true;

    const suchtext = [
      eintrag.nummer,
      eintrag.bezeichnung,
      eintrag.variante,
      eintrag.lagerort,
      eintrag.herkunftBestellungId,
      eintrag.notiz,
    ].join(' ').toLowerCase();
    return suchtext.includes(suche);
  });
}

function aktualisiereStatistik() {
  const summe = zusammenfassungMaterialbestand(materialbestand);
  document.getElementById('stat-posten').textContent = String(summe.postenAktiv);
  document.getElementById('stat-menge').textContent = String(summe.mengeAktiv);
  document.getElementById('stat-aufgebraucht').textContent = String(summe.postenAufgebraucht);
  document.getElementById('stat-ausgesondert').textContent = String(summe.postenAusgesondert);
}

function renderAnfragen() {
  const ziel = document.getElementById('anfragen-inhalt');
  const liste = sortiereMaterialanfragen(materialanfragen.map(normalisiereMaterialanfrage));
  const kannFreigeben = darfLageranfrageFreigeben();

  if (!liste.length) {
    setHTML(ziel, '<div class="text-sm" style="color:var(--text-2)">Noch keine Lagerfreigaben erfasst.</div>');
    return;
  }

  setHTML(ziel, html`
    <table>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Mitglied</th>
          <th>Artikel</th>
          <th style="text-align:right">Menge</th>
          <th>Entscheidung</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${liste.map(anfrage => html`
          <tr>
            <td class="text-sm">${new Date(anfrage.angelegtAm).toLocaleDateString('de-DE')}</td>
            <td>
              <strong>${anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId)}</strong>
              <div class="text-sm" style="margin-top:4px;color:var(--text-2)">${anfrage.angelegtVonRolle || '–'} · ${anfrage.angelegtVonName || '–'}</div>
            </td>
            <td>
              <strong>${anfrage.bezeichnung}</strong>
              <div class="text-sm" style="margin-top:4px;color:var(--text-2)">
                ${anfrage.nummer}${anfrage.variante ? ` · ${anfrage.variante}` : ''}${anfrage.hinweis ? ` · ${anfrage.hinweis}` : ''}
              </div>
            </td>
            <td class="menge">${anfrage.menge}</td>
            <td>
              ${anfrageEntscheidLabel(anfrage)}
              ${anfrage.rechnungsnummer ? html`<div class="text-sm" style="margin-top:4px;color:var(--text-2)">${anfrage.rechnungsnummer}</div>` : ''}
            </td>
            <td>${anfrageStatusBadge(anfrage)}</td>
            <td class="text-right" style="white-space:nowrap">
              ${anfrage.status === 'offen' && kannFreigeben
                ? html`
                    <button class="btn btn-primary btn-sm" data-anfrage-action="freigabe-normal" data-id="${anfrage.id}">Normal</button>
                    <button class="btn btn-ghost btn-sm" data-anfrage-action="freigabe-og" data-id="${anfrage.id}">OG übernimmt</button>
                    <button class="btn btn-danger btn-sm" data-anfrage-action="freigabe-ablehnen" data-id="${anfrage.id}">Ablehnen</button>
                  `
                : ''}
              ${anfrage.status === 'abgerechnet' && anfrage.rechnungId && darfRechnungenSehen()
                ? html`<button class="btn btn-ghost btn-sm" data-anfrage-action="pdf" data-id="${anfrage.id}">PDF</button>`
                : ''}
            </td>
          </tr>
        `)}
      </tbody>
    </table>
  `);
}

function render() {
  const kannSchreiben = darfMaterialbestandSchreiben();
  aktualisiereStatistik();
  renderAnfragen();

  const liste = gefilterterBestand();
  const leerHinweis = document.getElementById('leer-hinweis');
  const tabelle = document.getElementById('bestand-tabelle');
  const tbody = document.getElementById('bestand-tbody');

  if (!materialbestand.length) {
    leerHinweis.style.display = '';
    tabelle.style.display = 'none';
    return;
  }

  leerHinweis.style.display = 'none';
  tabelle.style.display = '';

  setHTML(tbody, html`${liste.map(eintrag => {
    const istOffen = offeneHistorien.has(eintrag.id);
    const bewegungen = (eintrag.bewegungen || []).slice(0, 8);
    return html`
      <tr>
        <td class="material-nummer">${eintrag.nummer}</td>
        <td>${eintrag.variante || '–'}</td>
        <td>
          <strong>${eintrag.bezeichnung}</strong>
          ${eintrag.notiz ? html`<div class="text-sm" style="margin-top:4px">${eintrag.notiz}</div>` : ''}
        </td>
        <td class="menge">${eintrag.menge}</td>
        <td>${statusBadge(eintrag.status)}</td>
        <td>${eintrag.lagerort || '–'}</td>
        <td class="text-sm">${eintrag.herkunftBestellungId || '–'}</td>
        <td class="text-right" style="white-space:nowrap">
          ${kannSchreiben
            ? html`<button class="btn btn-primary btn-sm" data-action="verkauf" data-id="${eintrag.id}">Ausgabe</button>`
            : ''}
          ${kannSchreiben
            ? html`<button class="btn btn-ghost btn-sm" data-action="zugang" data-id="${eintrag.id}">Zugang</button>
                <button class="btn btn-ghost btn-sm" data-action="abgang" data-id="${eintrag.id}">Abgang</button>`
            : ''}
          <button class="btn btn-ghost btn-sm" data-action="historie" data-id="${eintrag.id}">${istOffen ? 'Historie ausblenden' : 'Historie'}</button>
          ${kannSchreiben
            ? html`<button class="btn btn-ghost btn-sm" data-action="bearbeiten" data-id="${eintrag.id}">Bearbeiten</button>
                <button class="btn btn-danger btn-sm" data-action="loeschen" data-id="${eintrag.id}">Löschen</button>`
            : ''}
        </td>
      </tr>
      ${istOffen ? html`
        <tr class="bewegung-row">
          <td colspan="8">
            <div class="bewegung-log">
              <div class="text-sm">Letzte Bewegungen</div>
              ${(bewegungen.length
                ? html`<table class="bewegung-list">
                    <thead>
                      <tr>
                        <th>Zeitpunkt</th>
                        <th>Typ</th>
                        <th style="text-align:right">Menge</th>
                        <th>Quelle</th>
                        <th>Referenz</th>
                        <th>Notiz</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${bewegungen.map(bewegung => html`
                        <tr>
                          <td>${new Date(bewegung.timestamp).toLocaleString('de-DE')}</td>
                          <td class="bewegung-typ">${bewegungLabel(bewegung.typ)}</td>
                          <td style="text-align:right">${bewegung.menge}</td>
                          <td>${bewegung.quelle || '–'}</td>
                          <td>${bewegung.referenz || '–'}</td>
                          <td>${bewegung.notiz || '–'}</td>
                        </tr>`)}
                    </tbody>
                  </table>`
                : html`<div class="text-sm">Noch keine Bewegungen protokolliert.</div>`)}
            </div>
          </td>
        </tr>` : ''}`;
  })}
  ${!liste.length ? html`
    <tr>
      <td colspan="8" class="text-sm" style="text-align:center;color:var(--text-2);padding:24px 12px">
        Kein Eintrag entspricht dem aktuellen Filter.
      </td>
    </tr>` : ''}`);
}

function oeffneModal(id = '') {
  if (!darfMaterialbestandSchreiben()) {
    toast('Du darfst den Materialbestand nicht bearbeiten.', 'error');
    return;
  }
  const eintrag = id ? materialbestand.find(item => item.id === id) : null;
  document.getElementById('modal-titel').textContent = eintrag ? 'Bestandsposten bearbeiten' : 'Bestandsposten anlegen';
  document.getElementById('modal-id').value = eintrag?.id || '';
  document.getElementById('m-artikel-basis-key').value = '';
  document.getElementById('m-artikel-suche').value = '';
  document.getElementById('m-nummer').value = eintrag?.nummer || '';
  document.getElementById('m-variante').value = eintrag?.variante || '';
  document.getElementById('m-bezeichnung').value = eintrag?.bezeichnung || '';
  document.getElementById('m-menge').value = String(eintrag?.menge ?? 0);
  document.getElementById('m-status').value = eintrag?.status || 'aktiv';
  document.getElementById('m-lagerort').value = eintrag?.lagerort || '';
  document.getElementById('m-herkunft').value = eintrag?.herkunftBestellungId || '';
  document.getElementById('m-notiz').value = eintrag?.notiz || '';
  synchronisiereArtikelFeldAusFormular();
  document.getElementById('modal-backdrop').classList.add('open');
}

function schliesseModal() {
  schliesseArtikelDropdown();
  document.getElementById('modal-backdrop').classList.remove('open');
}

function oeffneBewegungModal(id, typ) {
  if (!darfMaterialbestandSchreiben()) {
    toast('Du darfst keine Bestandsbewegungen buchen.', 'error');
    return;
  }
  const eintrag = materialbestand.find(item => item.id === id);
  if (!eintrag) return;
  document.getElementById('bewegung-titel').textContent = typ === 'zugang' ? 'Zugang buchen' : 'Abgang buchen';
  document.getElementById('bewegung-id').value = id;
  document.getElementById('bewegung-typ').value = typ;
  document.getElementById('bewegung-menge').value = '1';
  document.getElementById('bewegung-notiz').value = '';
  document.getElementById('bewegung-kontext').textContent =
    `${eintrag.nummer} · ${eintrag.bezeichnung}${eintrag.variante ? ` · ${eintrag.variante}` : ''} · aktueller Bestand ${eintrag.menge}`;
  document.getElementById('bewegung-backdrop').classList.add('open');
}

function schliesseBewegungModal() {
  document.getElementById('bewegung-backdrop').classList.remove('open');
}

function oeffneVerkaufModal(id) {
  if (!darfMaterialbestandSchreiben()) {
    toast('Du darfst keine Lagerausgabe erfassen.', 'error', 7000);
    return;
  }
  const eintrag = materialbestand.find(item => item.id === id);
  if (!eintrag) return;
  const artikel = findeArtikelFuerBestand(artikelListe, eintrag);
  if (!artikel) {
    toast('Für diesen Bestandsposten gibt es keinen passenden Artikel im aktuellen Katalog. Bitte importiere oder aktualisiere den Artikel zuerst.', 'error', 7000);
    return;
  }
  if ((eintrag.menge || 0) <= 0) {
    toast('Dieser Bestandsposten hat keinen verfügbaren Bestand mehr.', 'warn');
    return;
  }

  document.getElementById('verkauf-id').value = id;
  document.getElementById('verkauf-menge').value = '1';
  document.getElementById('verkauf-hinweis').value = '';
  document.getElementById('verkauf-og-kostenlos').checked = false;
  document.getElementById('verkauf-kontext').textContent =
    `${eintrag.nummer} · ${eintrag.bezeichnung}${eintrag.variante ? ` · ${eintrag.variante}` : ''} · verfügbar ${eintrag.menge} · Materialstelle ${Number(artikel.einzelpreis || 0).toFixed(2).replace('.', ',')} €`;

  const select = document.getElementById('verkauf-mitglied');
  setHTML(select, html`
    <option value="${EXTERN_ID}">Extern</option>
    ${[...mitglieder]
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map(mitglied => html`<option value="${mitglied.id}">${mitglied.name}</option>`)}
  `);
  document.getElementById('verkauf-backdrop').classList.add('open');
}

function schliesseVerkaufModal() {
  document.getElementById('verkauf-backdrop').classList.remove('open');
}

async function speichereMaterialbestand() {
  return persistJsonWithSync({
    scope: SYNC_SCOPE_M,
    storageKey: STORAGE_KEY_M,
    data: materialbestand,
    client,
    remotePath: NC_PFAD_M,
  });
}

async function speichereMaterialanfragen() {
  return persistJsonWithSync({
    scope: SYNC_SCOPE_R,
    storageKey: STORAGE_KEY_R,
    data: materialanfragen,
    client,
    remotePath: NC_PFAD_R,
  });
}

async function speichereMaterialbestandUndAnfragen(vorherMaterial, vorherAnfragen, statusText = '') {
  const materialResult = await persistJsonWithSync({
    scope: SYNC_SCOPE_M,
    storageKey: STORAGE_KEY_M,
    data: materialbestand,
    client,
    remotePath: NC_PFAD_M,
  });
  if (!materialResult.ok) {
    return { ok: false, materialResult, anfrageResult: null, rollback: null };
  }

  const anfrageResult = await persistJsonWithSync({
    scope: SYNC_SCOPE_R,
    storageKey: STORAGE_KEY_R,
    data: materialanfragen,
    client,
    remotePath: NC_PFAD_R,
  });
  if (anfrageResult.ok) {
    if (statusText) toast(statusText, 'success');
    updateSyncBanner();
    return { ok: true, materialResult, anfrageResult, rollback: null };
  }

  materialbestand = cloneData(vorherMaterial);
  materialanfragen = cloneData(vorherAnfragen);
  const rollback = await persistJsonWithSync({
    scope: SYNC_SCOPE_M,
    storageKey: STORAGE_KEY_M,
    data: vorherMaterial,
    client,
    remotePath: NC_PFAD_M,
  });
  return { ok: false, materialResult, anfrageResult, rollback };
}

async function speichereBestellungenUndAnfragen(vorherBestellungen, vorherAnfragen, statusText = '') {
  const bestellResult = await persistJsonWithSync({
    scope: SYNC_SCOPE_B,
    storageKey: STORAGE_KEY_B,
    data: bestellungen,
    client,
    remotePath: NC_PFAD_B,
  });
  if (!bestellResult.ok) {
    return { ok: false, bestellResult, anfrageResult: null, rollback: null };
  }

  const anfrageResult = await persistJsonWithSync({
    scope: SYNC_SCOPE_R,
    storageKey: STORAGE_KEY_R,
    data: materialanfragen,
    client,
    remotePath: NC_PFAD_R,
  });
  if (anfrageResult.ok) {
    if (statusText) toast(statusText, 'success');
    updateSyncBanner();
    return { ok: true, bestellResult, anfrageResult, rollback: null };
  }

  bestellungen = cloneData(vorherBestellungen);
  materialanfragen = cloneData(vorherAnfragen);
  const rollback = await persistJsonWithSync({
    scope: SYNC_SCOPE_B,
    storageKey: STORAGE_KEY_B,
    data: vorherBestellungen,
    client,
    remotePath: NC_PFAD_B,
  });
  return { ok: false, bestellResult, anfrageResult, rollback };
}

async function speichereMaterialbestandUndBestellungen(vorherMaterial, vorherBestellungen, statusText = '') {
  const materialResult = await persistJsonWithSync({
    scope: SYNC_SCOPE_M,
    storageKey: STORAGE_KEY_M,
    data: materialbestand,
    client,
    remotePath: NC_PFAD_M,
  });
  if (!materialResult.ok) {
    return { ok: false, materialResult, bestellResult: null, rollback: null };
  }

  const bestellResult = await persistJsonWithSync({
    scope: SYNC_SCOPE_B,
    storageKey: STORAGE_KEY_B,
    data: bestellungen,
    client,
    remotePath: NC_PFAD_B,
  });
  if (bestellResult.ok) {
    if (statusText) toast(statusText, 'success');
    updateSyncBanner();
    return { ok: true, materialResult, bestellResult, rollback: null };
  }

  materialbestand = cloneData(vorherMaterial);
  bestellungen = cloneData(vorherBestellungen);
  const rollback = await persistJsonWithSync({
    scope: SYNC_SCOPE_M,
    storageKey: STORAGE_KEY_M,
    data: vorherMaterial,
    client,
    remotePath: NC_PFAD_M,
  });

  return { ok: false, materialResult, bestellResult, rollback };
}

function leseFormular() {
  return normalisiereMaterialEintrag({
    id: document.getElementById('modal-id').value.trim(),
    nummer: document.getElementById('m-nummer').value,
    variante: document.getElementById('m-variante').value,
    bezeichnung: document.getElementById('m-bezeichnung').value,
    menge: parseInt(document.getElementById('m-menge').value, 10),
    status: document.getElementById('m-status').value,
    lagerort: document.getElementById('m-lagerort').value,
    herkunftBestellungId: document.getElementById('m-herkunft').value,
    notiz: document.getElementById('m-notiz').value,
  });
}

async function loescheEintrag(id) {
  if (!darfMaterialbestandSchreiben()) {
    toast('Du darfst den Materialbestand nicht bearbeiten.', 'error');
    return;
  }
  const bestaetigt = await confirmDialog({
    title: 'Bestandsposten löschen?',
    body: 'Der Bestandsposten wird dauerhaft aus dem Materialbestand entfernt.',
    confirmText: 'Löschen',
    confirmTone: 'danger',
  });
  if (!bestaetigt) return;
  const geloescht = materialbestand.find(eintrag => eintrag.id === id);
  if (!geloescht) return;
  const vorher = cloneData(materialbestand);
  materialbestand = materialbestand.filter(eintrag => eintrag.id !== id);
  const gespeichert = await speichereMaterialbestand();
  if (!gespeichert.ok) {
    materialbestand = vorher;
    updateSyncBanner();
    toast(syncHinweisText(gespeichert.sync, 'Materialbestand'), 'error', 7000);
    return;
  }
  updateSyncBanner();
  render();
  await schreibeAuditWarnung({
    action: 'MATERIAL_BESTAND_GELOESCHT',
    entityId: geloescht.id,
    summary: `${geloescht.bezeichnung} wurde aus dem Materialbestand gelöscht`,
    changes: {
      id: geloescht.id,
      nummer: geloescht.nummer,
      bezeichnung: geloescht.bezeichnung,
      variante: geloescht.variante || '',
      menge: geloescht.menge || 0,
      status: geloescht.status || '',
    },
  });
}

async function speichereBewegung() {
  if (!darfMaterialbestandSchreiben()) {
    toast('Du darfst keine Bestandsbewegungen buchen.', 'error');
    return;
  }
  const id = document.getElementById('bewegung-id').value;
  const typ = document.getElementById('bewegung-typ').value;
  const menge = parseInt(document.getElementById('bewegung-menge').value, 10);
  const notiz = document.getElementById('bewegung-notiz').value.trim();

  const index = materialbestand.findIndex(item => item.id === id);
  if (index < 0) return;

  const buchung = bucheMaterialBewegung(materialbestand[index], {
    typ,
    menge,
    notiz,
    quelle: 'manuell',
  });
  if (!buchung.ok) {
    toast(buchung.fehler, 'error');
    return;
  }

  const vorher = cloneData(materialbestand);
  materialbestand[index] = buchung.eintrag;
  const gespeichert = await speichereMaterialbestand();
  if (!gespeichert.ok) {
    materialbestand = vorher;
    updateSyncBanner();
    toast(syncHinweisText(gespeichert.sync, 'Materialbestand'), 'error', 7000);
    return;
  }
  updateSyncBanner();
  render();
  schliesseBewegungModal();
  await schreibeAuditWarnung({
    action: 'MATERIAL_BEWEGUNG_GEBUCHT',
    entityId: buchung.eintrag.id,
    summary: `${bewegungLabel(typ)} für ${buchung.eintrag.bezeichnung} gespeichert`,
    changes: {
      id: buchung.eintrag.id,
      nummer: buchung.eintrag.nummer,
      bezeichnung: buchung.eintrag.bezeichnung,
      variante: buchung.eintrag.variante || '',
      typ,
      menge,
      bestandNeu: buchung.eintrag.menge,
      notiz,
    },
  });
}

async function speichereVerkauf() {
  const id = document.getElementById('verkauf-id').value;
  const mitgliedId = document.getElementById('verkauf-mitglied').value;
  const menge = parseInt(document.getElementById('verkauf-menge').value, 10);
  const hinweis = document.getElementById('verkauf-hinweis').value.trim();
  const foerderwunsch = document.getElementById('verkauf-og-kostenlos').checked;

  const index = materialbestand.findIndex(item => item.id === id);
  if (index < 0) return;

  const eintrag = materialbestand[index];
  const artikel = findeArtikelFuerBestand(artikelListe, eintrag);
  if (!artikel) {
    toast('Der passende Artikel wurde im Katalog nicht gefunden.', 'error');
    return;
  }
  if (menge > eintrag.menge) {
    toast(`Nicht genug Bestand: verfügbar ${eintrag.menge}, angefragt ${menge}.`, 'error');
    return;
  }

  const memberName = mitgliedName(mitgliedId);
  const anfrage = normalisiereMaterialanfrage({
    materialId: eintrag.id,
    nummer: eintrag.nummer,
    bezeichnung: eintrag.bezeichnung,
    variante: eintrag.variante || '',
    menge,
    mitgliedId,
    mitgliedName: memberName,
    hinweis,
    foerderwunsch,
    angelegtVonRolle: aktiveRolle(),
    angelegtVonName: aktivePersonName(),
  });
  const validierung = validateMaterialanfrage(anfrage);
  if (!validierung.ok) {
    toast(validierung.fehler, 'error');
    return;
  }

  const bewegung = bucheMaterialBewegung(eintrag, {
    typ: 'abgang',
    menge,
    quelle: 'lageranfrage',
    referenz: anfrage.id,
    notiz: hinweis || `${foerderwunsch ? 'Förderentscheidung prüfen · ' : ''}Ausgabe an ${memberName}`,
  });
  if (!bewegung.ok) {
    toast(bewegung.fehler, 'error');
    return;
  }

  const vorherMaterial = cloneData(materialbestand);
  const vorherAnfragen = cloneData(materialanfragen);
  materialbestand[index] = bewegung.eintrag;
  materialanfragen = [anfrage, ...materialanfragen];
  const gespeichert = await speichereMaterialbestandUndAnfragen(
    vorherMaterial,
    vorherAnfragen,
    'Lagerausgabe erfasst und zur Freigabe vorgemerkt.'
  );
  if (!gespeichert.ok) {
    materialbestand = vorherMaterial;
    materialanfragen = vorherAnfragen;
    const meldungen = [];
    if (gespeichert.materialResult && !gespeichert.materialResult.ok) {
      meldungen.push(syncHinweisText(gespeichert.materialResult.sync, 'Materialbestand'));
    } else if (gespeichert.anfrageResult && !gespeichert.anfrageResult.ok) {
      meldungen.push(syncHinweisText(gespeichert.anfrageResult.sync, 'Lagerfreigaben'));
    }
    if (gespeichert.rollback && !gespeichert.rollback.ok) {
      meldungen.push('Rollback des Materialbestands ist fehlgeschlagen. Bitte Remote-Stand manuell prüfen.');
    }
    updateSyncBanner();
    toast(meldungen.filter(Boolean).join('\n'), 'error', 9000);
    render();
    return;
  }
  updateSyncBanner();
  render();
  schliesseVerkaufModal();
  await schreibeAuditWarnung({
    action: 'LAGERANFRAGE_ERFASST',
    scope: 'materialanfragen',
    entityId: anfrage.id,
    summary: `Lagerausgabe für ${memberName} wurde zur Freigabe erfasst`,
    changes: {
      anfrageId: anfrage.id,
      materialId: eintrag.id,
      nummer: eintrag.nummer,
      bezeichnung: eintrag.bezeichnung,
      variante: eintrag.variante || '',
      mitgliedId,
      mitgliedName: memberName,
      menge,
      foerderwunsch,
      hinweis,
      bestandNeu: materialbestand[index]?.menge ?? 0,
    },
  });
}

async function finalisiereLageranfrage(anfrageId, { ogKostenlos = false } = {}) {
  if (!darfLageranfrageFreigeben()) {
    toast('Du darfst Lagerfreigaben nicht abschließen.', 'error');
    return;
  }
  const index = materialanfragen.findIndex(item => item.id === anfrageId);
  if (index < 0) return;

  const anfrage = normalisiereMaterialanfrage(materialanfragen[index]);
  if (anfrage.status !== 'offen') {
    toast('Diese Lagerfreigabe ist bereits entschieden.', 'warn');
    return;
  }

  const artikel = findeArtikelFuerBestand(artikelListe, {
    nummer: anfrage.nummer,
    variante: anfrage.variante,
  });
  if (!artikel) {
    toast('Der passende Artikel wurde im Katalog nicht gefunden.', 'error');
    return;
  }

  const verkauf = erstelleLagerverkauf(
    { nummer: anfrage.nummer, bezeichnung: anfrage.bezeichnung, variante: anfrage.variante, menge: anfrage.menge },
    artikel,
    anfrage.mitgliedId,
    anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId),
    einstellungen,
    alleRechnungen(),
    {
      ogKostenlos,
      quelle: 'lagerfreigabe',
      referenzAnfrageId: anfrage.id,
    }
  );

  const vorherBestellungen = cloneData(bestellungen);
  const vorherAnfragen = cloneData(materialanfragen);
  bestellungen = [...bestellungen, verkauf.bestellung];
  materialanfragen[index] = normalisiereMaterialanfrage({
    ...anfrage,
    status: 'abgerechnet',
    entscheidung: ogKostenlos ? 'og' : 'normal',
    entschiedenAm: new Date().toISOString(),
    entschiedenVonRolle: aktiveRolle(),
    entschiedenVonName: aktivePersonName(),
    ogKostenlos,
    bestellungId: verkauf.bestellung.id,
    rechnungId: verkauf.rechnung?.id || '',
    rechnungsnummer: verkauf.rechnung?.nummer || '',
  });

  const gespeichert = await speichereBestellungenUndAnfragen(
    vorherBestellungen,
    vorherAnfragen,
    ogKostenlos
      ? 'Lagerfreigabe abgeschlossen und OG-Übernahme gesetzt.'
      : 'Lagerfreigabe abgeschlossen und Rechnung erzeugt.'
  );
  if (!gespeichert.ok) {
    bestellungen = vorherBestellungen;
    materialanfragen = vorherAnfragen;
    const meldungen = [];
    if (gespeichert.bestellResult && !gespeichert.bestellResult.ok) {
      meldungen.push(syncHinweisText(gespeichert.bestellResult.sync, 'Bestellungen'));
    } else if (gespeichert.anfrageResult && !gespeichert.anfrageResult.ok) {
      meldungen.push(syncHinweisText(gespeichert.anfrageResult.sync, 'Lagerfreigaben'));
    }
    if (gespeichert.rollback && !gespeichert.rollback.ok) {
      meldungen.push('Rollback der Bestellungen ist fehlgeschlagen. Bitte Remote-Stand manuell prüfen.');
    }
    updateSyncBanner();
    toast(meldungen.filter(Boolean).join('\n'), 'error', 9000);
    render();
    return;
  }

  render();
  await schreibeAuditWarnung({
    action: 'LAGERANFRAGE_FREIGEGEBEN',
    scope: 'materialanfragen',
    entityId: anfrage.id,
    summary: `Lagerfreigabe für ${anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId)} wurde ${ogKostenlos ? 'mit OG-Übernahme' : 'normal'} abgeschlossen`,
    changes: {
      anfrageId: anfrage.id,
      bestellungId: verkauf.bestellung.id,
      rechnungId: verkauf.rechnung?.id || '',
      rechnungsnummer: verkauf.rechnung?.nummer || '',
      ogKostenlos,
      menge: anfrage.menge,
      mitgliedId: anfrage.mitgliedId,
      mitgliedName: anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId),
    },
  });
  if (verkauf.rechnung) {
    await druckePDF(verkauf.rechnung, anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId), einstellungen);
  }
}

async function lehneLageranfrageAb(anfrageId) {
  if (!darfLageranfrageFreigeben()) {
    toast('Du darfst Lagerfreigaben nicht ablehnen.', 'error');
    return;
  }
  const index = materialanfragen.findIndex(item => item.id === anfrageId);
  if (index < 0) return;
  const anfrage = normalisiereMaterialanfrage(materialanfragen[index]);
  if (anfrage.status !== 'offen') {
    toast('Diese Lagerfreigabe ist bereits entschieden.', 'warn');
    return;
  }

  const materialIndex = materialbestand.findIndex(item => item.id === anfrage.materialId);
  if (materialIndex < 0) {
    toast('Der zugehörige Bestandsposten wurde nicht gefunden.', 'error');
    return;
  }

  const bestaetigt = await confirmDialog({
    title: 'Lagerfreigabe ablehnen?',
    body: 'Die Menge wird wieder in den Lagerbestand zurückgebucht.',
    confirmText: 'Ablehnen',
    confirmTone: 'danger',
  });
  if (!bestaetigt) return;

  const rueckbuchung = bucheMaterialBewegung(materialbestand[materialIndex], {
    typ: 'zugang',
    menge: anfrage.menge,
    quelle: 'lagerfreigabe-abgelehnt',
    referenz: anfrage.id,
    notiz: `Rückbuchung aus abgelehnter Lagerfreigabe ${anfrage.id}`,
  });
  if (!rueckbuchung.ok) {
    toast(rueckbuchung.fehler, 'error');
    return;
  }

  const vorherMaterial = cloneData(materialbestand);
  const vorherAnfragen = cloneData(materialanfragen);
  materialbestand[materialIndex] = rueckbuchung.eintrag;
  materialanfragen[index] = normalisiereMaterialanfrage({
    ...anfrage,
    status: 'abgelehnt',
    entscheidung: 'abgelehnt',
    entschiedenAm: new Date().toISOString(),
    entschiedenVonRolle: aktiveRolle(),
    entschiedenVonName: aktivePersonName(),
  });

  const gespeichert = await speichereMaterialbestandUndAnfragen(
    vorherMaterial,
    vorherAnfragen,
    'Lagerfreigabe abgelehnt und Bestand zurückgebucht.'
  );
  if (!gespeichert.ok) {
    materialbestand = vorherMaterial;
    materialanfragen = vorherAnfragen;
    const meldungen = [];
    if (gespeichert.materialResult && !gespeichert.materialResult.ok) {
      meldungen.push(syncHinweisText(gespeichert.materialResult.sync, 'Materialbestand'));
    } else if (gespeichert.anfrageResult && !gespeichert.anfrageResult.ok) {
      meldungen.push(syncHinweisText(gespeichert.anfrageResult.sync, 'Lagerfreigaben'));
    }
    if (gespeichert.rollback && !gespeichert.rollback.ok) {
      meldungen.push('Rollback des Materialbestands ist fehlgeschlagen. Bitte Remote-Stand manuell prüfen.');
    }
    updateSyncBanner();
    toast(meldungen.filter(Boolean).join('\n'), 'error', 9000);
    render();
    return;
  }

  render();
  await schreibeAuditWarnung({
    action: 'LAGERANFRAGE_ABGELEHNT',
    scope: 'materialanfragen',
    entityId: anfrage.id,
    summary: `Lagerfreigabe für ${anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId)} wurde abgelehnt`,
    changes: {
      anfrageId: anfrage.id,
      materialId: anfrage.materialId,
      menge: anfrage.menge,
      mitgliedId: anfrage.mitgliedId,
      mitgliedName: anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId),
      bestandNeu: materialbestand[materialIndex]?.menge ?? 0,
    },
  });
}

async function init() {
  client = createClientFromLocalNc();
  const einstellungenResult = await ladeRemoteEinstellungen(client);
  einstellungen = einstellungenResult.data;
  mitglieder = einstellungen?.mitglieder || [];
  materialbestand = [];
  bestellungen = [];
  artikelListe = [];
  materialanfragen = [];
  _artikelBasenCache = null;
  const [materialLoaded, bestellungenLoaded, artikelLoaded, anfragenLoaded] = await Promise.all([
    hydrateJsonFromSync({
      scope: SYNC_SCOPE_M,
      storageKey: STORAGE_KEY_M,
      client,
      remotePath: NC_PFAD_M,
      isValidRemote: data => Array.isArray(data),
      defaultData: [],
    }),
    hydrateJsonFromSync({
      scope: SYNC_SCOPE_B,
      storageKey: STORAGE_KEY_B,
      client,
      remotePath: NC_PFAD_B,
      isValidRemote: data => Array.isArray(data),
      defaultData: [],
    }),
    hydrateJsonFromSync({
      scope: SYNC_SCOPE_A,
      storageKey: STORAGE_KEY_A,
      client,
      remotePath: NC_PFAD_A,
      isValidRemote: data => Array.isArray(data),
      defaultData: [],
    }),
    hydrateJsonFromSync({
      scope: SYNC_SCOPE_R,
      storageKey: STORAGE_KEY_R,
      client,
      remotePath: NC_PFAD_R,
      isValidRemote: data => Array.isArray(data),
      defaultData: [],
    }),
  ]);
  if (Array.isArray(materialLoaded.data)) {
    materialbestand = materialLoaded.data.map(normalisiereMaterialEintrag);
  }
  if (Array.isArray(bestellungenLoaded.data)) {
    bestellungen = bestellungenLoaded.data;
  }
  if (Array.isArray(artikelLoaded.data)) {
    artikelListe = artikelLoaded.data;
    _artikelBasenCache = null;
  }
  if (Array.isArray(anfragenLoaded.data)) {
    materialanfragen = anfragenLoaded.data.map(normalisiereMaterialanfrage);
  }

  render();
  updateSyncBanner();

  document.getElementById('btn-neu').addEventListener('click', () => oeffneModal());
  document.getElementById('btn-neu').disabled = !darfMaterialbestandSchreiben();
  document.getElementById('btn-neu-leer')?.toggleAttribute('disabled', !darfMaterialbestandSchreiben());
  document.getElementById('btn-download-material')?.addEventListener('click', () => {
    if (!materialbestand.length) {
      toast('Kein Materialbestand zum Exportieren.', 'warn');
      return;
    }
    downloadAlsJson(materialbestand, 'materialbestand.json');
  });

  document.getElementById('modal-abbrechen').addEventListener('click', schliesseModal);
  document.getElementById('modal-backdrop').addEventListener('click', event => {
    if (event.target === event.currentTarget) {
      schliesseModal();
    }
  });
  document.getElementById('m-artikel-suche').addEventListener('input', event => {
    document.getElementById('m-artikel-basis-key').value = '';
    aktualisiereArtikelDropdown(event.target.value);
  });
  document.getElementById('m-artikel-suche').addEventListener('focus', event => {
    if (event.target.value.trim()) {
      aktualisiereArtikelDropdown(event.target.value);
    }
  });
  ['m-nummer', 'm-bezeichnung'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      document.getElementById('m-artikel-basis-key').value = '';
    });
    document.getElementById(id).addEventListener('blur', synchronisiereArtikelFeldAusFormular);
  });
  document.getElementById('m-variante').addEventListener('input', () => {
    renderVarianteAuswahl(document.getElementById('m-artikel-basis-key').value);
  });
  document.getElementById('m-variante').addEventListener('blur', synchronisiereArtikelFeldAusFormular);
  document.getElementById('m-variante-auswahl').addEventListener('change', event => {
    document.getElementById('m-variante').value = event.target.value === LEERE_VARIANTE ? '' : event.target.value;
    synchronisiereArtikelFeldAusFormular();
  });
  document.getElementById('bewegung-abbrechen').addEventListener('click', schliesseBewegungModal);
  document.getElementById('bewegung-backdrop').addEventListener('click', event => {
    if (event.target === event.currentTarget) {
      schliesseBewegungModal();
    }
  });
  document.getElementById('verkauf-abbrechen').addEventListener('click', schliesseVerkaufModal);
  document.getElementById('verkauf-backdrop').addEventListener('click', event => {
    if (event.target === event.currentTarget) {
      schliesseVerkaufModal();
    }
  });

  document.getElementById('modal-speichern').addEventListener('click', async () => {
    if (!darfMaterialbestandSchreiben()) {
      toast('Du darfst den Materialbestand nicht bearbeiten.', 'error');
      return;
    }
    const eintrag = leseFormular();
    const validierung = validateMaterialEintrag(eintrag);
    if (!validierung.ok) {
      toast(validierung.fehler, 'error');
      return;
    }

    const duplicate = materialbestand.find(item =>
      item.id !== eintrag.id && materialKey(normalisiereMaterialEintrag(item)) === materialKey(eintrag)
    );
    if (duplicate) {
      toast('Nummer + Variante sind bereits im Materialbestand vorhanden.', 'error');
      return;
    }

    const vorher = cloneData(materialbestand);
    const index = materialbestand.findIndex(item => item.id === eintrag.id);
    if (index >= 0) {
      materialbestand[index] = {
        ...materialbestand[index],
        ...eintrag,
        bewegungen: materialbestand[index].bewegungen || [],
      };
    } else {
      materialbestand = [...materialbestand, eintrag];
    }

    const gespeichert = await speichereMaterialbestand();
    if (!gespeichert.ok) {
      materialbestand = vorher;
      updateSyncBanner();
      toast(syncHinweisText(gespeichert.sync, 'Materialbestand'), 'error', 7000);
      return;
    }
    updateSyncBanner();
    render();
    schliesseModal();
    await schreibeAuditWarnung({
      action: index >= 0 ? 'MATERIAL_BESTAND_AKTUALISIERT' : 'MATERIAL_BESTAND_ANGELEGT',
      entityId: eintrag.id,
      summary: `${eintrag.bezeichnung} wurde ${index >= 0 ? 'aktualisiert' : 'angelegt'}`,
      changes: {
        id: eintrag.id,
        nummer: eintrag.nummer,
        bezeichnung: eintrag.bezeichnung,
        variante: eintrag.variante || '',
        menge: eintrag.menge || 0,
        status: eintrag.status || '',
        lagerort: eintrag.lagerort || '',
        herkunftBestellungId: eintrag.herkunftBestellungId || '',
      },
    });
  });
  document.getElementById('bewegung-speichern').addEventListener('click', speichereBewegung);
  document.getElementById('verkauf-speichern').addEventListener('click', speichereVerkauf);
  document.getElementById('anfragen-inhalt').addEventListener('click', async event => {
    const button = event.target.closest('[data-anfrage-action]');
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.anfrageAction === 'freigabe-normal') {
      await finalisiereLageranfrage(id, { ogKostenlos: false });
    }
    if (button.dataset.anfrageAction === 'freigabe-og') {
      await finalisiereLageranfrage(id, { ogKostenlos: true });
    }
    if (button.dataset.anfrageAction === 'freigabe-ablehnen') {
      await lehneLageranfrageAb(id);
    }
    if (button.dataset.anfrageAction === 'pdf') {
      if (!darfRechnungenSehen()) {
        toast('Du darfst Rechnungs-PDFs nicht öffnen.', 'error');
        return;
      }
      const anfrage = materialanfragen.find(item => item.id === id);
      if (!anfrage?.rechnungId || !anfrage?.bestellungId) return;
      const bestellung = bestellungen.find(item => item.id === anfrage.bestellungId);
      const rechnung = (bestellung?.rechnungen || []).find(item => item.id === anfrage.rechnungId);
      if (rechnung) {
        await druckePDF(rechnung, anfrage.mitgliedName || mitgliedName(anfrage.mitgliedId), einstellungen);
      }
    }
  });

  document.getElementById('filter-suche').addEventListener('input', render);
  document.getElementById('filter-status').addEventListener('change', render);
  document.addEventListener('click', event => {
    if (!event.target.closest('.artikel-field-wrap')) {
      schliesseArtikelDropdown();
    }
  });

  document.getElementById('bestand-tbody').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === 'verkauf') {
      oeffneVerkaufModal(id);
    }
    if (button.dataset.action === 'zugang') {
      oeffneBewegungModal(id, 'zugang');
    }
    if (button.dataset.action === 'abgang') {
      oeffneBewegungModal(id, 'abgang');
    }
    if (button.dataset.action === 'historie') {
      if (offeneHistorien.has(id)) offeneHistorien.delete(id);
      else offeneHistorien.add(id);
      render();
    }
    if (button.dataset.action === 'bearbeiten') {
      oeffneModal(id);
    }
    if (button.dataset.action === 'loeschen') {
      loescheEintrag(id);
    }
  });
}

init();
