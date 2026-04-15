/**
 * abgleich.js — Sprint 03
 * Abgleich von Bestellwünschen gegen tatsächlich gelieferte Rechnungspositionen.
 */

/**
 * Vergleicht aggregierte Wünsche mit Rechnungspositionen.
 *
 * Match-Schlüssel: artikelNr + '\x00' + variante
 *
 * Ergebnis-Typen:
 *   - gematch    : exakter Match (Mengen gleich)
 *   - abweichung : { typ: 'menge',          erwartet, geliefert, wunsch, position }
 *   - abweichung : { typ: 'nicht_geliefert', erwartet, wunsch }
 *   - abweichung : { typ: 'nicht_bestellt',  geliefert, position }
 *   - og_kosten  : Versand / Eilauftrag (typ = 'og-kosten')
 *
 * @param {Array<{artikelNr: string, variante: string, name: string, menge: number}>} wuensche
 *   Aggregierte Wünsche (z. B. Ausgabe von aggregiereWuensche()).
 * @param {Array<{artikelNr: string, variante: string, name: string, menge: number, typ?: string}>} positionen
 *   Geparste Rechnungspositionen. Positionen mit typ === 'og-kosten' werden separat gesammelt.
 * @returns {{
 *   gematch:     Array<{wunsch: object, position: object}>,
 *   abweichungen: Array<object>,
 *   og_kosten:   Array<object>
 * }}
 */
export function gleiche_ab(wuensche, positionen) {
  const gematch     = [];
  const abweichungen = [];
  const og_kosten   = [];

  // OG-Kosten herausfiltern
  const artikelPositionen = positionen.filter(p => {
    if (p.typ === 'og-kosten') {
      og_kosten.push(p);
      return false;
    }
    return true;
  });

  // Wünsche als Map für O(1)-Lookup
  const wunschMap = new Map();
  for (const w of wuensche) {
    const key = `${w.artikelNr}\x00${w.variante}`;
    wunschMap.set(key, w);
  }

  // Positionen als Map für O(1)-Lookup
  const posMap = new Map();
  for (const p of artikelPositionen) {
    const key = `${p.artikelNr}\x00${p.variante}`;
    posMap.set(key, p);
  }

  // Wünsche durchgehen
  for (const w of wuensche) {
    const key = `${w.artikelNr}\x00${w.variante}`;
    const p   = posMap.get(key);

    if (!p) {
      abweichungen.push({ typ: 'nicht_geliefert', erwartet: w.menge, wunsch: w });
    } else if (p.menge === w.menge) {
      gematch.push({ wunsch: w, position: p });
    } else {
      abweichungen.push({ typ: 'menge', erwartet: w.menge, geliefert: p.menge, wunsch: w, position: p });
    }
  }

  // Positionen ohne Wunsch
  for (const p of artikelPositionen) {
    const key = `${p.artikelNr}\x00${p.variante}`;
    if (!wunschMap.has(key)) {
      abweichungen.push({ typ: 'nicht_bestellt', geliefert: p.menge, position: p });
    }
  }

  return { gematch, abweichungen, og_kosten };
}