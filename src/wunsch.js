/**
 * wunsch.js
 * Wunschqueue – Datenmodell, Validierung und Statusmaschine.
 *
 * Öffentliche API:
 *   erstelleWunsch(felder)              → Wunsch-Objekt
 *   validateWunschEintrag(w)            → { ok, fehler? }
 *   istTerminal(status)                 → boolean
 *   kannMutieren(wunsch, session)       → boolean
 *   kannStornieren(wunsch, session)     → boolean
 *   setzeStatus(wunsch, neuerStatus, opts?) → Wunsch-Objekt (immutable)
 *   erlaubteUebergaenge(status)         → string[]
 *   filterFuerMitglied(wuensche, mitgliedId) → Wunsch[]
 *   filterAdminQueue(wuensche)          → Wunsch[]
 *   normalizeWunsch(w)                  → Wunsch-Objekt
 *   isValidWuenscheListe(data)          → boolean
 */

import { leseKostenmodus } from './kostenmodus.js';

// ── Konstanten ──────────────────────────────────────────────────────

const GUELTIGE_STATI = [
  'offen',
  'abgelehnt',
  'storniert',
  'uebernommen',
  'teilweise_uebernommen',
];

const TERMINALE_STATI = new Set(['uebernommen', 'storniert']);

/**
 * Erlaubte Statusübergänge (von → [nach, ...]).
 */
const UEBERGAENGE = {
  offen:                 ['abgelehnt', 'storniert', 'uebernommen', 'teilweise_uebernommen'],
  teilweise_uebernommen: ['uebernommen', 'storniert', 'abgelehnt'],
  abgelehnt:             ['offen'],
  uebernommen:           [],
  storniert:             [],
};

// ── Hilfsfunktionen ─────────────────────────────────────────────────

function randomId() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `wunsch_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isoNow() {
  return new Date().toISOString();
}

function istPositiveGanzeZahl(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1;
}

function istNichtNegativeGanzeZahl(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

// ── Öffentliche API ─────────────────────────────────────────────────

/**
 * Erstellt ein neues Wunsch-Objekt mit Status 'offen'.
 * Wirft keinen Fehler bei fehlenden Feldern.
 * @param {{ mitgliedId, artikelNr, variante?, name, menge }} felder
 * @returns {object}
 */
export function erstelleWunsch(felder = {}) {
  const jetzt = isoNow();
  return {
    id:               randomId(),
    mitgliedId:       felder.mitgliedId   ?? '',
    artikelNr:        felder.artikelNr    ?? '',
    variante:         felder.variante     ?? '',
    name:             felder.name         ?? '',
    menge:            felder.menge        ?? 0,
    kostenmodus:      leseKostenmodus(felder),
    status:           'offen',
    erstelltAm:       jetzt,
    geaendertAm:      jetzt,
    geaendertVon:     '',
    kommentar:        '',
    mengeUebernommen: 0,
    bestellungId:     '',
  };
}

/**
 * Validiert einen Wunsch-Eintrag.
 * @param {object} w
 * @returns {{ ok: boolean, fehler?: string }}
 */
export function validateWunschEintrag(w) {
  if (!w) return { ok: false, fehler: 'Kein Wunsch-Objekt übergeben.' };

  if (!w.mitgliedId || typeof w.mitgliedId !== 'string' || w.mitgliedId.trim() === '') {
    return { ok: false, fehler: 'mitgliedId darf nicht leer sein.' };
  }
  if (!w.artikelNr || typeof w.artikelNr !== 'string' || w.artikelNr.trim() === '') {
    return { ok: false, fehler: 'artikelNr darf nicht leer sein.' };
  }
  if (!w.name || typeof w.name !== 'string' || w.name.trim() === '') {
    return { ok: false, fehler: 'name darf nicht leer sein.' };
  }
  if (!istPositiveGanzeZahl(w.menge)) {
    return { ok: false, fehler: 'menge muss eine positive ganze Zahl (≥1) sein.' };
  }
  if (w.status !== undefined && !GUELTIGE_STATI.includes(w.status)) {
    return { ok: false, fehler: `Ungültiger Status: ${w.status}` };
  }
  if (w.mengeUebernommen !== undefined) {
    if (!istNichtNegativeGanzeZahl(w.mengeUebernommen)) {
      return { ok: false, fehler: 'mengeUebernommen muss eine nicht-negative ganze Zahl sein.' };
    }
    if (w.mengeUebernommen > w.menge) {
      return { ok: false, fehler: 'mengeUebernommen darf nicht größer als menge sein.' };
    }
  }

  return { ok: true };
}

/**
 * Prüft ob ein Status terminal ist (keine weiteren Übergänge möglich).
 * @param {string} status
 * @returns {boolean}
 */
export function istTerminal(status) {
  return TERMINALE_STATI.has(status);
}

/**
 * Gibt die erlaubten Ziel-Stati für einen gegebenen Status zurück.
 * @param {string} status
 * @returns {string[]}
 */
export function erlaubteUebergaenge(status) {
  return UEBERGAENGE[status] ?? [];
}

/**
 * Prüft ob die gegebene Session den Wunsch mutieren darf.
 * @param {object} wunsch
 * @param {object|null} session  { rolle, authType, id?, mitgliedId? }
 * @returns {boolean}
 */
export function kannMutieren(wunsch, session) {
  if (!session || typeof session !== 'object') return false;

  if (session.rolle === 'admin') {
    return (
      wunsch.status === 'offen' ||
      wunsch.status === 'abgelehnt' ||
      wunsch.status === 'teilweise_uebernommen'
    );
  }

  if (session.rolle === 'user' && session.authType === 'stempeluhr') {
    const eigenerId = session.mitgliedId || session.id;
    const istEigen = wunsch.mitgliedId === eigenerId;
    return istEigen && wunsch.status === 'offen';
  }

  return false;
}

/**
 * Prüft ob die gegebene Session den Wunsch stornieren darf.
 * @param {object} wunsch
 * @param {object|null} session
 * @returns {boolean}
 */
export function kannStornieren(wunsch, session) {
  if (!session || typeof session !== 'object') return false;

  if (session.rolle === 'admin') {
    return !istTerminal(wunsch.status);
  }

  if (session.rolle === 'user' && session.authType === 'stempeluhr') {
    const eigenerId = session.mitgliedId || session.id;
    const istEigen = wunsch.mitgliedId === eigenerId;
    return istEigen && wunsch.status === 'offen';
  }

  return false;
}

/**
 * Setzt den Status eines Wunschs und gibt ein neues Objekt zurück (immutable).
 * Wirft einen Error wenn der Übergang ungültig ist oder der Wunsch terminal ist.
 * @param {object} wunsch
 * @param {string} neuerStatus
 * @param {{ geaendertVon?, kommentar?, mengeUebernommen?, bestellungId? }} [opts]
 * @returns {object}
 */
export function setzeStatus(wunsch, neuerStatus, opts = {}) {
  if (istTerminal(wunsch.status)) {
    throw new Error(
      `Wunsch ist terminal (${wunsch.status}) und kann nicht mehr geändert werden.`
    );
  }

  const erlaubt = erlaubteUebergaenge(wunsch.status);
  if (!erlaubt.includes(neuerStatus)) {
    throw new Error(
      `Ungültiger Statusübergang: ${wunsch.status} → ${neuerStatus}`
    );
  }

  const aktualisiert = {
    ...wunsch,
    status:      neuerStatus,
    geaendertAm: isoNow(),
  };

  if (opts.geaendertVon !== undefined) aktualisiert.geaendertVon = opts.geaendertVon;
  if (opts.kommentar    !== undefined) aktualisiert.kommentar    = opts.kommentar;
  if (opts.bestellungId !== undefined) aktualisiert.bestellungId = opts.bestellungId;
  if (opts.mengeUebernommen !== undefined) aktualisiert.mengeUebernommen = opts.mengeUebernommen;

  return aktualisiert;
}

/**
 * Filtert Wünsche auf ein bestimmtes Mitglied, sortiert neueste zuerst.
 * @param {object[]} wuensche
 * @param {string} mitgliedId
 * @returns {object[]}
 */
export function filterFuerMitglied(wuensche, mitgliedId) {
  return wuensche
    .filter(w => w.mitgliedId === mitgliedId)
    .sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));
}

/**
 * Gibt die Admin-Queue zurück: nur offen + teilweise_uebernommen, älteste zuerst.
 * @param {object[]} wuensche
 * @returns {object[]}
 */
export function filterAdminQueue(wuensche) {
  return wuensche
    .filter(w => w.status === 'offen' || w.status === 'teilweise_uebernommen')
    .sort((a, b) => a.erstelltAm.localeCompare(b.erstelltAm));
}

/**
 * Normalisiert ein rohes JSON-Objekt zu einem vollständigen Wunsch-Objekt.
 * Setzt Defaults für fehlende Felder. Validiert nicht.
 * @param {object} w
 * @returns {object}
 */
export function normalizeWunsch(w = {}) {
  const jetzt = isoNow();
  return {
    id:               typeof w.id               === 'string' ? w.id               : randomId(),
    mitgliedId:       typeof w.mitgliedId       === 'string' ? w.mitgliedId       : '',
    artikelNr:        typeof w.artikelNr        === 'string' ? w.artikelNr        : '',
    variante:         typeof w.variante         === 'string' ? w.variante         : '',
    name:             typeof w.name             === 'string' ? w.name             : '',
    menge:            typeof w.menge            === 'number' ? w.menge            : 0,
    kostenmodus:      leseKostenmodus(w),
    status:           GUELTIGE_STATI.includes(w.status)      ? w.status           : 'offen',
    erstelltAm:       typeof w.erstelltAm       === 'string' ? w.erstelltAm       : jetzt,
    geaendertAm:      typeof w.geaendertAm      === 'string' ? w.geaendertAm      : jetzt,
    geaendertVon:     typeof w.geaendertVon     === 'string' ? w.geaendertVon     : '',
    kommentar:        typeof w.kommentar        === 'string' ? w.kommentar        : '',
    mengeUebernommen: typeof w.mengeUebernommen === 'number' ? w.mengeUebernommen : 0,
    bestellungId:     typeof w.bestellungId     === 'string' ? w.bestellungId     : '',
  };
}

/**
 * Prüft ob ein Wert eine gültige Wünsche-Liste ist.
 * @param {*} data
 * @returns {boolean}
 */
export function isValidWuenscheListe(data) {
  if (!Array.isArray(data)) return false;
  try {
    for (const item of data) {
      if (!item || typeof item !== 'object') return false;
      if (typeof item.id !== 'string' || typeof item.mitgliedId !== 'string') return false;
      normalizeWunsch(item);
    }
    return true;
  } catch {
    return false;
  }
}
