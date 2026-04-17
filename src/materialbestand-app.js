import { createWebDavClient } from './webdav.js';
import { downloadAlsJson } from './defaults.js';
import { load } from './storage.js';
import { html, raw, setHTML } from './dom.js';
import { druckePDF } from './pdf.js';
import {
  bucheMaterialBewegung,
  normalisiereMaterialEintrag,
  sortiereMaterialbestand,
  validateMaterialEintrag,
  zusammenfassungMaterialbestand,
} from './materialbestand.js';
import { erstelleLagerverkauf, findeArtikelFuerBestand } from './materialverkauf.js';
import {
  hydrateJsonFromSync,
  persistJsonWithSync,
  syncHinweisText,
} from './sync.js';

const STORAGE_KEY_E = 'lo_einstellungen';
const STORAGE_KEY_M = 'lo_materialbestand';
const STORAGE_KEY_B = 'lo_bestellungen';
const STORAGE_KEY_A = 'lo_artikel';
const NC_PFAD_M = '/LifeguardOrders/materialbestand.json';
const NC_PFAD_B = '/LifeguardOrders/bestellungen.json';
const NC_PFAD_A = '/LifeguardOrders/artikel.json';
const SYNC_SCOPE_M = 'materialbestand';
const SYNC_SCOPE_B = 'bestellungen';
const SYNC_SCOPE_A = 'artikel';

let materialbestand = [];
let bestellungen = [];
let artikelListe = [];
let einstellungen = null;
let mitglieder = [];
let client = null;
const offeneHistorien = new Set();
let _artikelBasenCache = null;

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
  const mitglied = mitglieder.find(item => item.id === id);
  return mitglied ? mitglied.name : id;
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

function render() {
  aktualisiereStatistik();

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
          <button class="btn btn-primary btn-sm" data-action="verkauf" data-id="${eintrag.id}">Verkaufen</button>
          <button class="btn btn-ghost btn-sm" data-action="zugang" data-id="${eintrag.id}">Zugang</button>
          <button class="btn btn-ghost btn-sm" data-action="abgang" data-id="${eintrag.id}">Abgang</button>
          <button class="btn btn-ghost btn-sm" data-action="historie" data-id="${eintrag.id}">${istOffen ? 'Historie ausblenden' : 'Historie'}</button>
          <button class="btn btn-ghost btn-sm" data-action="bearbeiten" data-id="${eintrag.id}">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" data-action="loeschen" data-id="${eintrag.id}">Löschen</button>
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
  const eintrag = materialbestand.find(item => item.id === id);
  if (!eintrag) return;
  const artikel = findeArtikelFuerBestand(artikelListe, eintrag);
  if (!artikel) {
    alert('Für diesen Bestandsposten gibt es keinen passenden Artikel im aktuellen Katalog. Bitte importiere oder aktualisiere den Artikel zuerst.');
    return;
  }
  if (!mitglieder.length) {
    alert('Es sind keine Mitglieder in den Einstellungen hinterlegt.');
    return;
  }
  if ((eintrag.menge || 0) <= 0) {
    alert('Dieser Bestandsposten hat keinen verfügbaren Bestand mehr.');
    return;
  }

  document.getElementById('verkauf-id').value = id;
  document.getElementById('verkauf-menge').value = '1';
  document.getElementById('verkauf-hinweis').value = '';
  document.getElementById('verkauf-og-kostenlos').checked = false;
  document.getElementById('verkauf-kontext').textContent =
    `${eintrag.nummer} · ${eintrag.bezeichnung}${eintrag.variante ? ` · ${eintrag.variante}` : ''} · verfügbar ${eintrag.menge} · Materialstelle ${Number(artikel.einzelpreis || 0).toFixed(2).replace('.', ',')} €`;

  const select = document.getElementById('verkauf-mitglied');
  setHTML(select, html`${[...mitglieder]
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map(mitglied => html`<option value="${mitglied.id}">${mitglied.name}</option>`)}`);
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

async function speichereMaterialbestandUndBestellungen(statusText = '') {
  const [materialResult, bestellResult] = await Promise.all([
    persistJsonWithSync({
      scope: SYNC_SCOPE_M,
      storageKey: STORAGE_KEY_M,
      data: materialbestand,
      client,
      remotePath: NC_PFAD_M,
    }),
    persistJsonWithSync({
      scope: SYNC_SCOPE_B,
      storageKey: STORAGE_KEY_B,
      data: bestellungen,
      client,
      remotePath: NC_PFAD_B,
    }),
  ]);

  const meldungen = [];
  if (materialResult.sync?.pending) meldungen.push(syncHinweisText(materialResult.sync, 'Materialbestand'));
  if (bestellResult.sync?.pending) meldungen.push(syncHinweisText(bestellResult.sync, 'Bestellungen'));
  if (!meldungen.length && statusText) meldungen.push(statusText);
  if (meldungen.length) {
    alert(meldungen.join('\n\n'));
  }
  return { materialResult, bestellResult };
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
  if (!confirm('Bestandsposten wirklich löschen?')) return;
  materialbestand = materialbestand.filter(eintrag => eintrag.id !== id);
  const gespeichert = await speichereMaterialbestand();
  render();
  if (gespeichert.sync?.pending) {
    alert(syncHinweisText(gespeichert.sync, 'Materialbestand'));
  }
}

async function speichereBewegung() {
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
    alert(buchung.fehler);
    return;
  }

  materialbestand[index] = buchung.eintrag;
  const gespeichert = await speichereMaterialbestand();
  render();
  schliesseBewegungModal();
  if (gespeichert.sync?.pending) {
    alert(syncHinweisText(gespeichert.sync, 'Materialbestand'));
  }
}

async function speichereVerkauf() {
  const id = document.getElementById('verkauf-id').value;
  const mitgliedId = document.getElementById('verkauf-mitglied').value;
  const menge = parseInt(document.getElementById('verkauf-menge').value, 10);
  const hinweis = document.getElementById('verkauf-hinweis').value.trim();
  const ogKostenlos = document.getElementById('verkauf-og-kostenlos').checked;

  const index = materialbestand.findIndex(item => item.id === id);
  if (index < 0) return;

  const eintrag = materialbestand[index];
  const artikel = findeArtikelFuerBestand(artikelListe, eintrag);
  if (!artikel) {
    alert('Der passende Artikel wurde im Katalog nicht gefunden.');
    return;
  }
  if (menge > eintrag.menge) {
    alert(`Nicht genug Bestand: verfügbar ${eintrag.menge}, angefragt ${menge}.`);
    return;
  }

  const memberName = mitgliedName(mitgliedId);
  const verkauf = erstelleLagerverkauf(
    { ...eintrag, menge },
    artikel,
    mitgliedId,
    memberName,
    einstellungen,
    alleRechnungen(),
    { ogKostenlos }
  );

  const bewegung = bucheMaterialBewegung(eintrag, {
    typ: 'abgang',
    menge,
    quelle: 'lagerverkauf',
    referenz: verkauf.bestellung.id,
    notiz: hinweis || `${ogKostenlos ? 'OG übernimmt · ' : ''}Verkauf an ${memberName}`,
  });
  if (!bewegung.ok) {
    alert(bewegung.fehler);
    return;
  }

  materialbestand[index] = bewegung.eintrag;
  bestellungen = [...bestellungen, verkauf.bestellung];
  await speichereMaterialbestandUndBestellungen('Lagerverkauf gespeichert und Rechnung erzeugt.');
  render();
  schliesseVerkaufModal();
  if (verkauf.rechnung) {
    druckePDF(verkauf.rechnung, memberName, einstellungen);
  }
}

async function init() {
  einstellungen = load(STORAGE_KEY_E);
  mitglieder = einstellungen?.mitglieder || [];
  const ncPass = einstellungen?.nc?.pass || sessionStorage.getItem('lo_nc_pass') || '';
  if (einstellungen?.nc?.url && einstellungen?.nc?.user && ncPass) {
    client = createWebDavClient({ ...einstellungen.nc, pass: ncPass });
  }

  materialbestand = load(STORAGE_KEY_M) || [];
  bestellungen = load(STORAGE_KEY_B) || [];
  artikelListe = load(STORAGE_KEY_A) || [];
  _artikelBasenCache = null;
  if (client) {
    const [materialLoaded, bestellungenLoaded, artikelLoaded] = await Promise.all([
      hydrateJsonFromSync({
        scope: SYNC_SCOPE_M,
        storageKey: STORAGE_KEY_M,
        client,
        remotePath: NC_PFAD_M,
        isValidRemote: data => Array.isArray(data),
      }),
      hydrateJsonFromSync({
        scope: SYNC_SCOPE_B,
        storageKey: STORAGE_KEY_B,
        client,
        remotePath: NC_PFAD_B,
        isValidRemote: data => Array.isArray(data),
      }),
      hydrateJsonFromSync({
        scope: SYNC_SCOPE_A,
        storageKey: STORAGE_KEY_A,
        client,
        remotePath: NC_PFAD_A,
        isValidRemote: data => Array.isArray(data),
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
  } else {
    materialbestand = materialbestand.map(normalisiereMaterialEintrag);
  }

  render();

  document.getElementById('btn-neu').addEventListener('click', () => oeffneModal());
  document.getElementById('btn-download-material')?.addEventListener('click', () => {
    if (!materialbestand.length) {
      alert('Kein Materialbestand zum Exportieren.');
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
    const eintrag = leseFormular();
    const validierung = validateMaterialEintrag(eintrag);
    if (!validierung.ok) {
      alert(validierung.fehler);
      return;
    }

    const duplicate = materialbestand.find(item =>
      item.id !== eintrag.id && materialKey(normalisiereMaterialEintrag(item)) === materialKey(eintrag)
    );
    if (duplicate) {
      alert('Nummer + Variante sind bereits im Materialbestand vorhanden.');
      return;
    }

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
    render();
    schliesseModal();
    if (gespeichert.sync?.pending) {
      alert(syncHinweisText(gespeichert.sync, 'Materialbestand'));
    }
  });
  document.getElementById('bewegung-speichern').addEventListener('click', speichereBewegung);
  document.getElementById('verkauf-speichern').addEventListener('click', speichereVerkauf);

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
