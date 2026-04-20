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
  const gematch      = [];
  const abweichungen = [];
  const og_kosten    = [];

  // OG-Kosten herausfiltern
  const artikelPositionen = positionen.filter(p => {
    if (p.typ === 'og-kosten') { og_kosten.push(p); return false; }
    return true;
  });

  const posMap = new Map();
  for (const p of artikelPositionen) posMap.set(`${p.artikelNr}\x00${p.variante}`, p);

  const gematchteWKeys = new Set();
  const gematchtePoKeys = new Set();

  function verarbeiteMatch(w, p) {
    gematchteWKeys.add(`${w.artikelNr}\x00${w.variante}`);
    gematchtePoKeys.add(`${p.artikelNr}\x00${p.variante}`);
    if (p.menge === w.menge) {
      gematch.push({ wunsch: w, position: p });
    } else {
      abweichungen.push({ typ: 'menge', erwartet: w.menge, geliefert: p.menge, wunsch: w, position: p });
    }
  }

  // ── Pass 1: exakter Match (artikelNr + variante) ──────────────
  for (const w of wuensche) {
    const p = posMap.get(`${w.artikelNr}\x00${w.variante}`);
    if (p) verarbeiteMatch(w, p);
  }

  // ── Pass 2: Fallback-Match nur nach artikelNr ─────────────────
  // Wird angewendet wenn beide Seiten nach dem exakten Pass dieselbe
  // Anzahl ungematchter Einträge für eine artikelNr haben (1:1 eindeutig).
  // Deckt z. B. Varianten-Encoding-Unterschiede zwischen Bestellsystem
  // und Rechnung ab (»Sailor« 21CM vs. SAILOR - 21 cm).
  const offeneWuensche = wuensche.filter(w => !gematchteWKeys.has(`${w.artikelNr}\x00${w.variante}`));
  const offenePos      = artikelPositionen.filter(p => !gematchtePoKeys.has(`${p.artikelNr}\x00${p.variante}`));

  const offeneWByNr = new Map();
  for (const w of offeneWuensche) {
    if (!offeneWByNr.has(w.artikelNr)) offeneWByNr.set(w.artikelNr, []);
    offeneWByNr.get(w.artikelNr).push(w);
  }
  const offenePByNr = new Map();
  for (const p of offenePos) {
    if (!offenePByNr.has(p.artikelNr)) offenePByNr.set(p.artikelNr, []);
    offenePByNr.get(p.artikelNr).push(p);
  }

  const fuzzyWKeys = new Set();
  const fuzzyPKeys = new Set();

  for (const [artNr, ws] of offeneWByNr) {
    const ps = offenePByNr.get(artNr);
    if (!ps || ws.length !== ps.length) continue;
    // Sortiert nach Variante für deterministisches Pairing
    ws.sort((a, b) => (a.variante || '').localeCompare(b.variante || '', 'de'));
    ps.sort((a, b) => (a.variante || '').localeCompare(b.variante || '', 'de'));
    for (let i = 0; i < ws.length; i++) {
      fuzzyWKeys.add(`${ws[i].artikelNr}\x00${ws[i].variante}`);
      fuzzyPKeys.add(`${ps[i].artikelNr}\x00${ps[i].variante}`);
      verarbeiteMatch(ws[i], ps[i]);
    }
  }

  // ── Übrige: nicht_geliefert / nicht_bestellt ──────────────────
  for (const w of offeneWuensche) {
    if (!fuzzyWKeys.has(`${w.artikelNr}\x00${w.variante}`)) {
      abweichungen.push({ typ: 'nicht_geliefert', erwartet: w.menge, wunsch: w });
    }
  }
  for (const p of offenePos) {
    if (!fuzzyPKeys.has(`${p.artikelNr}\x00${p.variante}`)) {
      abweichungen.push({ typ: 'nicht_bestellt', geliefert: p.menge, position: p });
    }
  }

  return { gematch, abweichungen, og_kosten };
}

export function abweichKey(abweichung) {
  const basis = abweichung?.wunsch || abweichung?.position || {};
  return `${basis.artikelNr || ''}\x00${basis.variante || ''}`;
}

export function summeZuweisung(position) {
  return (position?.zuweisung || []).reduce((summe, eintrag) => {
    const menge = Number.isInteger(eintrag?.menge) ? eintrag.menge : 0;
    return summe + Math.max(0, menge);
  }, 0);
}

export function offeneMenge(position) {
  const menge = Number.isInteger(position?.menge) ? position.menge : 0;
  const retoureMenge = Number.isInteger(position?.retoureMenge) ? position.retoureMenge : 0;
  const ogBestandMenge = Number.isInteger(position?.ogBestandMenge) ? position.ogBestandMenge : 0;
  return menge - summeZuweisung(position) - retoureMenge - ogBestandMenge;
}

export function normalisierePosition(position) {
  const basis = {
    ...position,
    retoureMenge: Number.isInteger(position?.retoureMenge) ? Math.max(0, position.retoureMenge) : 0,
    ogBestandMenge: Number.isInteger(position?.ogBestandMenge) ? Math.max(0, position.ogBestandMenge) : 0,
  };

  const map = new Map();
  for (const eintrag of (position?.zuweisung || [])) {
    if (!eintrag?.mitgliedId) continue;
    const menge = Number.isInteger(eintrag.menge) ? Math.max(0, eintrag.menge) : 0;
    const key = `${eintrag.mitgliedId}\x00${eintrag.ogKostenlos ? '1' : '0'}`;
    if (!map.has(key)) {
      map.set(key, {
        mitgliedId: eintrag.mitgliedId,
        menge,
        ogAnteil: eintrag.ogAnteil || 0,
        ogKostenlos: !!eintrag.ogKostenlos,
      });
      continue;
    }

    const vorhanden = map.get(key);
    vorhanden.menge += menge;
    vorhanden.ogAnteil = (vorhanden.ogAnteil || 0) + (eintrag.ogAnteil || 0);
  }

  return {
    ...basis,
    zuweisung: [...map.values()],
  };
}

export function verteileGelieferteMenge(wuensche, artikelNr, variante, geliefertMenge) {
  const relevanteWuensche = (wuensche || []).filter(
    w => w.artikelNr === artikelNr && (w.variante || '') === (variante || '')
  );
  if (!relevanteWuensche.length) return [];

  const gesamtGewuenscht = relevanteWuensche.reduce((summe, w) => summe + w.menge, 0);
  if (gesamtGewuenscht === 0) {
    return relevanteWuensche.map(w => ({
      mitgliedId: w.mitgliedId,
      wunschMenge: 0,
      zugeteiltMenge: 0,
      ogKostenlos: !!w.ogKostenlos,
    }));
  }

  const verteilung = relevanteWuensche.map(w => ({
    mitgliedId: w.mitgliedId,
    wunschMenge: w.menge,
    zugeteiltMenge: Math.floor(geliefertMenge * w.menge / gesamtGewuenscht),
    ogKostenlos: !!w.ogKostenlos,
  }));

  const bereitsZugewiesen = verteilung.reduce((summe, eintrag) => summe + eintrag.zugeteiltMenge, 0);
  const rest = geliefertMenge - bereitsZugewiesen;
  if (rest > 0) {
    const maxIndex = verteilung.reduce(
      (best, aktuell, index) => aktuell.wunschMenge > verteilung[best].wunschMenge ? index : best,
      0
    );
    verteilung[maxIndex].zugeteiltMenge += rest;
  }

  return verteilung;
}

export function bauePositionenAusAbgleich(abgleichResult, wuensche, artikelListe, aufloesungen = new Map()) {
  const positionen = [];
  const { gematch = [], abweichungen = [], og_kosten = [] } = abgleichResult || {};

  for (const match of gematch) {
    positionen.push(baueArtikelPosition(match.position, wuensche, artikelListe));
  }

  for (const abweichung of abweichungen) {
    if (abweichung.typ !== 'menge') continue;
    if (aufloesungen.get(abweichKey(abweichung)) !== 'uebernehmen') continue;

    positionen.push(baueArtikelPosition(
      { ...abweichung.position, menge: abweichung.geliefert },
      wuensche,
      artikelListe
    ));
  }

  for (const kosten of og_kosten) {
    positionen.push({
      id: crypto.randomUUID(),
      artikelNr: kosten.artikelNr || '',
      variante: '',
      name: kosten.name,
      menge: kosten.menge,
      einzelpreis: kosten.einzelpreis || 0,
      bvFoerderung: 0,
      lvFoerderung: 0,
      ogFoerderung: 0,
      ogUebernimmtRest: false,
      foerderungGespeichert: true,
      typ: 'og-kosten',
      zuweisung: [],
    });
  }

  return positionen;
}

function baueArtikelPosition(position, wuensche, artikelListe) {
  const artikel = (artikelListe || []).find(
    a => a.artikelNr === position.artikelNr && (a.variante || '') === (position.variante || '')
  );
  const verteilung = verteileGelieferteMenge(
    wuensche,
    position.artikelNr,
    position.variante || '',
    position.menge
  );

  return {
    id: crypto.randomUUID(),
    artikelNr: position.artikelNr,
    variante: position.variante || '',
    name: position.name,
    menge: position.menge,
    einzelpreis: position.einzelpreis || 0,
    bvFoerderung: position.bvFoerderung || 0,
    lvFoerderung: position.lvFoerderung || 0,
    ogFoerderung: artikel?.ogFoerderung || 0,
    ogUebernimmtRest: !!artikel?.ogUebernimmtRest,
    foerderungGespeichert: !!artikel,
    typ: 'artikel',
    retoureMenge: 0,
    ogBestandMenge: 0,
    zuweisung: verteilung.map(eintrag => ({
      mitgliedId: eintrag.mitgliedId,
      menge: eintrag.zugeteiltMenge,
      ogAnteil: 0,
      ogKostenlos: eintrag.ogKostenlos,
    })),
  };
}
