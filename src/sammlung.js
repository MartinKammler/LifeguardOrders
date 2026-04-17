/**
 * sammlung.js — Sprint 02
 * Aggregation, CSV-Export und Validierung von Bestellwünschen.
 */

import { berechneFoerderung } from './berechnung.js';
import { validateWunsch } from './validation.js';

/**
 * Summiert Mengen je artikelNr+variante und sortiert das Ergebnis.
 *
 * @param {Array<{artikelNr: string, variante: string, name: string, menge: number}>} wuensche
 * @returns {Array<{artikelNr: string, variante: string, name: string, menge: number}>}
 */
export function aggregiereWuensche(wuensche) {
  const map = new Map();

  for (const w of wuensche) {
    const key = `${w.artikelNr}\x00${w.variante}`;
    if (map.has(key)) {
      map.get(key).menge += w.menge;
    } else {
      map.set(key, {
        artikelNr: w.artikelNr,
        variante:  w.variante,
        name:      w.name,
        menge:     w.menge,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.artikelNr < b.artikelNr) return -1;
    if (a.artikelNr > b.artikelNr) return  1;
    if (a.variante  < b.variante)  return -1;
    if (a.variante  > b.variante)  return  1;
    return 0;
  });
}

/**
 * Serialisiert aggregierte Wünsche als CSV-String.
 * Format je Zeile: artikelNr,variante,menge
 * Keine abschließende Newline. Leeres Array → leerer String.
 *
 * @param {Array<{artikelNr: string, variante: string, menge: number}>} aggregiert
 * @returns {string}
 */
export function exportiereCSV(aggregiert) {
  if (aggregiert.length === 0) return '';
  return aggregiert
    .map(r => `${r.artikelNr},${r.variante},${r.menge}`)
    .join('\n');
}

/**
 * Ermittelt Gesamtstückzahl und Preissummen einer Sammelbestellung.
 *
 * Die Summe ignoriert bewusst das Wunsch-Flag ogKostenlos, damit sie die
 * Bestellung fachlich immer nach Katalogpreis und regulärer Förderung zeigt.
 *
 * @param {Array<{artikelNr: string, variante: string, menge: number, ogKostenlos?: boolean}>} wuensche
 * @param {Array<{artikelNr: string, variante: string, einzelpreis: number, bvFoerderung?: number, lvFoerderung?: number, ogFoerderung?: number, ogUebernimmtRest?: boolean}>} artikelListe
 * @returns {{ gegenstaende: number, normalpreis: number, bv: number, lv: number, og: number, preisNachFoerderung: number }}
 */
export function berechneBestellsummen(wuensche, artikelListe) {
  const summen = {
    gegenstaende: 0,
    normalpreis: 0,
    bv: 0,
    lv: 0,
    og: 0,
    preisNachFoerderung: 0,
  };

  for (const wunsch of wuensche) {
    const menge = Number(wunsch.menge) || 0;
    summen.gegenstaende += menge;

    const artikel = artikelListe.find(a =>
      a.artikelNr === wunsch.artikelNr &&
      (a.variante || '') === (wunsch.variante || '')
    );
    if (!artikel) continue;

    const foerderung = berechneFoerderung(artikel, menge, { ogKostenlos: false });
    summen.normalpreis += foerderung.gesamt;
    summen.bv += foerderung.bv;
    summen.lv += foerderung.lv;
    summen.og += foerderung.og;
    summen.preisNachFoerderung += foerderung.mitglied;
  }

  return summen;
}

/**
 * Prüft einen einzelnen Wunsch auf Vollständigkeit und Plausibilität.
 *
 * @param {{ mitgliedId?: string, artikelNr?: string, menge?: number }} wunsch
 * @returns {{ ok: true } | { ok: false, fehler: string }}
 */
export function validiereWunsch(wunsch) {
  return validateWunsch(wunsch);
}

/**
 * Fasst Wünsche mit gleicher mitgliedId + artikelNr + variante zusammen.
 * Die Menge wird summiert. Id, name, ogKostenlos und alle anderen Felder
 * vom ersten Eintrag behalten.
 *
 * Im Gegensatz zu aggregiereWuensche bleibt mitgliedId erhalten und
 * die Reihenfolge des ersten Auftritts jedes Schlüssels wird beibehalten
 * (Map-Insertion-Order). Kein Sortieren — die Nutzer-Eingabereihenfolge
 * soll im UI sichtbar bleiben.
 *
 * @param {Array<{id: string, mitgliedId: string, artikelNr: string, variante: string, name: string, menge: number, ogKostenlos?: boolean}>} wuensche
 * @returns {Array}
 */
export function mergeWuensche(wuensche) {
  const map = new Map();

  for (const w of wuensche) {
    const key = `${w.mitgliedId}\x00${w.artikelNr}\x00${w.variante}`;
    if (map.has(key)) {
      map.get(key).menge += w.menge;
    } else {
      map.set(key, { ...w });
    }
  }

  return [...map.values()];
}
