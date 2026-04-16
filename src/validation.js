/**
 * validation.js
 * Zentrale Eingangsvalidierung für Domänenobjekte.
 *
 * Öffentliche API:
 *   validateWunsch(w)    → { ok, fehler? }
 *   validatePosition(p)  → { ok, fehler? }
 *   validateArtikel(a)   → { ok, fehler? }
 *   validateListe(xs, fn) → { ok, fehler?, index? }
 */

function err(fehler) { return { ok: false, fehler }; }
const OK = { ok: true };

function leer(value) {
  return value == null || !String(value).trim();
}

function istPositiveGanzeZahl(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function istNichtNegativeZahl(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function validateWunsch(w) {
  if (!w || typeof w !== 'object') return err('wunsch muss ein Objekt sein');
  if (leer(w.mitgliedId)) return err('mitgliedId darf nicht leer sein');
  if (leer(w.artikelNr))  return err('artikelNr darf nicht leer sein');
  if (!istPositiveGanzeZahl(w.menge))
    return err('menge muss eine positive ganze Zahl sein');
  return OK;
}

export function validatePosition(p) {
  if (!p || typeof p !== 'object') return err('position muss ein Objekt sein');
  if (leer(p.artikelNr)) return err('artikelNr darf nicht leer sein');
  if (!istPositiveGanzeZahl(p.menge))
    return err('menge muss eine positive ganze Zahl sein');
  if (!istNichtNegativeZahl(p.einzelpreis)) return err('einzelpreis darf nicht negativ sein');
  if (p.bvFoerderung != null && !istNichtNegativeZahl(p.bvFoerderung)) return err('bvFoerderung darf nicht negativ sein');
  if (p.lvFoerderung != null && !istNichtNegativeZahl(p.lvFoerderung)) return err('lvFoerderung darf nicht negativ sein');
  if (p.ogFoerderung != null && !istNichtNegativeZahl(p.ogFoerderung)) return err('ogFoerderung darf nicht negativ sein');
  return OK;
}

export function validateArtikel(a) {
  if (!a || typeof a !== 'object') return err('artikel muss ein Objekt sein');
  if (leer(a.artikelNr)) return err('artikelNr darf nicht leer sein');
  if (leer(a.name)) return err('name darf nicht leer sein');
  if (!istNichtNegativeZahl(a.einzelpreis)) return err('einzelpreis darf nicht negativ sein');
  if (a.bvFoerderung != null && !istNichtNegativeZahl(a.bvFoerderung)) return err('bvFoerderung darf nicht negativ sein');
  if (a.lvFoerderung != null && !istNichtNegativeZahl(a.lvFoerderung)) return err('lvFoerderung darf nicht negativ sein');
  if (a.ogFoerderung != null && !istNichtNegativeZahl(a.ogFoerderung)) return err('ogFoerderung darf nicht negativ sein');
  return OK;
}

export function validateListe(eintraege, validator) {
  const liste = Array.isArray(eintraege) ? eintraege : [];
  for (let i = 0; i < liste.length; i++) {
    const result = validator(liste[i]);
    if (!result.ok) {
      return { ok: false, fehler: result.fehler, index: i };
    }
  }
  return OK;
}
