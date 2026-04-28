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

function istNichtNegativeGanzeZahl(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
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

  const retoureMenge = p.retoureMenge ?? 0;
  if (!istNichtNegativeGanzeZahl(retoureMenge)) {
    return err('retoureMenge muss eine nicht-negative ganze Zahl sein');
  }

  const ogBestandMenge = p.ogBestandMenge ?? 0;
  if (!istNichtNegativeGanzeZahl(ogBestandMenge)) {
    return err('ogBestandMenge (Lagerbestand) muss eine nicht-negative ganze Zahl sein');
  }

  const zuweisungen = Array.isArray(p.zuweisung) ? p.zuweisung : [];
  let zugewiesenGesamt = 0;
  for (const z of zuweisungen) {
    if (!z || typeof z !== 'object') return err('zuweisung muss ein Objekt sein');
    if (leer(z.mitgliedId)) return err('zuweisung.mitgliedId darf nicht leer sein');
    if (!istNichtNegativeGanzeZahl(z.menge)) {
      return err('zuweisung.menge muss eine nicht-negative ganze Zahl sein');
    }
    zugewiesenGesamt += z.menge;
  }

  if (zugewiesenGesamt + retoureMenge + ogBestandMenge > p.menge) {
    return err('zuweisung + retoure + Lagerbestand darf menge nicht überschreiten');
  }

  return OK;
}

function validatePaketKomponenten(komponenten) {
  if (!Array.isArray(komponenten)) return err('paketKomponenten muss ein Array sein');
  for (let i = 0; i < komponenten.length; i++) {
    const k = komponenten[i];
    if (!k || typeof k !== 'object') return err(`paketKomponenten[${i}] muss ein Objekt sein`);
    if (!k.label || !String(k.label).trim())
      return err(`paketKomponenten[${i}]: label darf nicht leer sein`);
    if (!Number.isInteger(k.menge) || k.menge < 1)
      return err(`paketKomponenten[${i}]: menge muss eine positive ganze Zahl sein`);
    if (!Array.isArray(k.optionen) || k.optionen.length === 0)
      return err(`paketKomponenten[${i}]: optionen muss ein nicht-leeres Array sein`);
    for (let j = 0; j < k.optionen.length; j++) {
      const o = k.optionen[j];
      if (!o || !String(o.artikelNr || '').trim())
        return err(`paketKomponenten[${i}].optionen[${j}]: artikelNr darf nicht leer sein`);
    }
  }
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
  if (a.istPaket) {
    const kv = validatePaketKomponenten(a.paketKomponenten ?? []);
    if (!kv.ok) return kv;
  }
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
