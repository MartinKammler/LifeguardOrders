/**
 * berechnung.js
 * Förderberechnung und Rechnungsnummerierung.
 *
 * Öffentliche API:
 *   berechneFoerderung(artikel, menge) → { bv, lv, og, mitglied, gesamt }
 *   rechnungsnummerMitLaufnummer(datum, laufnummer) → "R_YYYY_MM_NNN"
 *   naechsteRechnungslaufnummer(rechnungen, datum, minLaufnummer?) → number
 *   naechsteRechnungsnummer(rechnungen, datum) → "R_YYYY_MM_NNN"
 */

/** Rundet auf 2 Dezimalstellen (kaufmännisch). */
function runde(wert) {
  return Math.round(wert * 100) / 100;
}

function rechnungsPrefix(datum) {
  const jahr = datum.getFullYear();
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  return `R_${jahr}_${monat}_`;
}

/**
 * Berechnet alle Förderanteile für eine zugewiesene Position.
 *
 * @param {object} artikel        Artikel-Objekt aus artikel.json
 * @param {number} menge          Zugewiesene Menge (für dieses Mitglied)
 * @param {{ ogKostenlos?: boolean }} [opts]
 * @returns {{ bv, lv, og, mitglied, gesamt }}  Alle Beträge in €
 */
export function berechneFoerderung(artikel, menge, opts = {}) {
  const gesamt = runde(artikel.einzelpreis * menge);
  const bv     = runde(artikel.bvFoerderung * menge);
  const lv     = runde(artikel.lvFoerderung * menge);

  if (opts.ogKostenlos) {
    const og = Math.max(0, runde(gesamt - bv - lv));
    return { bv, lv, og, mitglied: 0, gesamt };
  }

  let og;
  if (artikel.ogUebernimmtRest) {
    og = Math.max(0, runde(artikel.einzelpreis * menge - bv - lv));
  } else {
    og = runde((artikel.ogFoerderung || 0) * menge);
  }

  const mitglied = Math.max(0, runde(gesamt - bv - lv - og));

  return { bv, lv, og, mitglied, gesamt };
}

/**
 * Baut eine Rechnungsnummer aus Datum und laufender Nummer.
 *
 * @param {Date} datum
 * @param {number|string} laufnummer
 * @returns {string}
 */
export function rechnungsnummerMitLaufnummer(datum, laufnummer) {
  const lauf = parseInt(laufnummer, 10);
  if (!Number.isInteger(lauf) || lauf <= 0) {
    throw new Error('Laufnummer muss eine positive Ganzzahl sein.');
  }
  return rechnungsPrefix(datum) + String(lauf).padStart(3, '0');
}

/**
 * Ermittelt die nächste freie laufende Rechnungsnummer für den angegebenen Monat.
 *
 * @param {Array<{nummer: string}>} rechnungen
 * @param {Date} datum
 * @param {number} [minLaufnummer=1]
 * @returns {number}
 */
export function naechsteRechnungslaufnummer(rechnungen, datum, minLaufnummer = 1) {
  const prefix = rechnungsPrefix(datum);
  const start = Number.isInteger(minLaufnummer) && minLaufnummer > 0 ? minLaufnummer : 1;

  const maxNr = rechnungen
    .map(r => r.nummer)
    .filter(n => n && n.startsWith(prefix))
    .map(n => parseInt(n.slice(prefix.length), 10))
    .reduce((max, n) => (n > max ? n : max), 0);

  return Math.max(start, maxNr + 1);
}

/**
 * Ermittelt die nächste Rechnungsnummer für den angegebenen Monat.
 * Format: R_YYYY_MM_NNN (dreistellig, führende Nullen)
 *
 * @param {Array<{nummer: string}>} rechnungen  Alle bisher gespeicherten Rechnungen
 * @param {Date}                    datum        Datum der neuen Rechnung
 * @returns {string}
 */
export function naechsteRechnungsnummer(rechnungen, datum) {
  return rechnungsnummerMitLaufnummer(
    datum,
    naechsteRechnungslaufnummer(rechnungen, datum)
  );
}
