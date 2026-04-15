/**
 * berechnung.js
 * Förderberechnung und Rechnungsnummerierung.
 *
 * Öffentliche API:
 *   berechneFoerderung(artikel, menge) → { bv, lv, og, mitglied, gesamt }
 *   naechsteRechnungsnummer(rechnungen, datum) → "R_YYYY_MM_NNN"
 */

/** Rundet auf 2 Dezimalstellen (kaufmännisch). */
function runde(wert) {
  return Math.round(wert * 100) / 100;
}

/**
 * Berechnet alle Förderanteile für eine zugewiesene Position.
 *
 * @param {object} artikel        Artikel-Objekt aus artikel.json
 * @param {number} menge          Zugewiesene Menge (für dieses Mitglied)
 * @returns {{ bv, lv, og, mitglied, gesamt }}  Alle Beträge in €
 */
export function berechneFoerderung(artikel, menge) {
  const gesamt = runde(artikel.einzelpreis * menge);
  const bv     = runde(artikel.bvFoerderung * menge);
  const lv     = runde(artikel.lvFoerderung * menge);

  let og;
  if (artikel.ogUebernimmtRest) {
    og = runde(artikel.einzelpreis * menge - bv - lv);
  } else {
    og = runde((artikel.ogFoerderung || 0) * menge);
  }

  const mitglied = Math.max(0, runde(gesamt - bv - lv - og));

  return { bv, lv, og, mitglied, gesamt };
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
  const jahr   = datum.getFullYear();
  const monat  = String(datum.getMonth() + 1).padStart(2, '0');
  const prefix = `R_${jahr}_${monat}_`;

  const maxNr = rechnungen
    .map(r => r.nummer)
    .filter(n => n && n.startsWith(prefix))
    .map(n => parseInt(n.slice(prefix.length), 10))
    .reduce((max, n) => (n > max ? n : max), 0);

  return prefix + String(maxNr + 1).padStart(3, '0');
}
