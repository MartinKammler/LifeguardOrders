import { validateArtikel } from './validation.js';

function uuid() {
  return crypto.randomUUID();
}

export function artikelKey(a) {
  return `${String(a?.artikelNr || '').trim()}|${String(a?.variante || '').trim().toUpperCase()}`;
}

export function artikelLabel(a) {
  return a.variante ? `${a.artikelNr} ${a.variante}` : a.artikelNr;
}

export function artikelIstIdentisch(a, b) {
  return (
    String(a?.artikelNr || '').trim() === String(b?.artikelNr || '').trim() &&
    String(a?.variante || '').trim().toUpperCase() === String(b?.variante || '').trim().toUpperCase() &&
    String(a?.name || '').trim() === String(b?.name || '').trim() &&
    Number(a?.einzelpreis || 0) === Number(b?.einzelpreis || 0) &&
    Number(a?.bvFoerderung || 0) === Number(b?.bvFoerderung || 0) &&
    Number(a?.lvFoerderung || 0) === Number(b?.lvFoerderung || 0) &&
    Number(a?.ogFoerderung || 0) === Number(b?.ogFoerderung || 0) &&
    !!a?.ogUebernimmtRest === !!b?.ogUebernimmtRest
  );
}

export function fuegeArtikelHinzu(katalog, neueArtikel) {
  const result = [...katalog];
  const hinzugefuegt = [];
  const aktualisiert = [];
  const duplikate = [];
  const ungueltig = [];
  for (const a of neueArtikel) {
    const validierung = validateArtikel(a);
    if (!validierung.ok) {
      ungueltig.push({ artikel: a, fehler: validierung.fehler });
      continue;
    }

    const key = artikelKey(a);
    const matchIndizes = result
      .map((eintrag, index) => artikelKey(eintrag) === key ? index : -1)
      .filter(index => index >= 0);

    if (!matchIndizes.length) {
      const mitId = { ...a, id: uuid(), variante: String(a.variante || '').trim().toUpperCase() };
      result.push(mitId);
      hinzugefuegt.push(artikelLabel(mitId));
      continue;
    }

    const vorhandene = matchIndizes.map(index => result[index]);
    const alleIdentisch = vorhandene.every(eintrag => artikelIstIdentisch(eintrag, a));
    if (alleIdentisch) {
      duplikate.push(artikelLabel(a));
    } else {
      const erstePosition = matchIndizes[0];
      const ersatz = {
        ...a,
        id: vorhandene[0]?.id || uuid(),
        variante: String(a.variante || '').trim().toUpperCase(),
      };
      const ohneTreffer = result.filter((_, index) => !matchIndizes.includes(index));
      const einfuegePosition = erstePosition - matchIndizes.filter(i => i < erstePosition).length;
      ohneTreffer.splice(einfuegePosition, 0, ersatz);
      result.length = 0;
      result.push(...ohneTreffer);
      aktualisiert.push(artikelLabel(ersatz));
    }
  }
  return { katalog: result, hinzugefuegt, aktualisiert, duplikate, ungueltig };
}

export function loescheArtikel(katalog, id) {
  return katalog.filter(a => a.id !== id);
}

export function aktualisiereArtikel(katalog, geaendert) {
  return katalog.map(a => a.id === geaendert.id ? { ...a, ...geaendert } : a);
}
