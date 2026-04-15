/**
 * validation.js
 * Zentrale Eingangsvalidierung für Domänenobjekte.
 *
 * Öffentliche API:
 *   validateWunsch(w)    → { ok, fehler? }
 *   validatePosition(p)  → { ok, fehler? }
 *   validateArtikel(a)   → { ok, fehler? }
 */

function err(fehler) { return { ok: false, fehler }; }
const OK = { ok: true };

export function validateWunsch(w) {
  if (!w.mitgliedId || !String(w.mitgliedId).trim()) return err('mitgliedId darf nicht leer sein');
  if (!w.artikelNr  || !String(w.artikelNr).trim())  return err('artikelNr darf nicht leer sein');
  if (typeof w.menge !== 'number' || !Number.isInteger(w.menge) || w.menge <= 0)
    return err('menge muss eine positive ganze Zahl sein');
  return OK;
}

export function validatePosition(p) {
  if (!p.artikelNr || !String(p.artikelNr).trim()) return err('artikelNr darf nicht leer sein');
  if (typeof p.menge !== 'number' || !Number.isInteger(p.menge) || p.menge <= 0)
    return err('menge muss eine positive ganze Zahl sein');
  if (typeof p.einzelpreis !== 'number' || p.einzelpreis < 0) return err('einzelpreis darf nicht negativ sein');
  return OK;
}

export function validateArtikel(a) {
  if (!a.artikelNr  || !String(a.artikelNr).trim())  return err('artikelNr darf nicht leer sein');
  if (!a.name       || !String(a.name).trim())        return err('name darf nicht leer sein');
  if (typeof a.einzelpreis !== 'number' || a.einzelpreis < 0) return err('einzelpreis darf nicht negativ sein');
  return OK;
}