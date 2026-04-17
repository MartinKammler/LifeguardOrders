function err(fehler) { return { ok: false, fehler }; }
const OK = { ok: true };

export const MATERIAL_STATUS = ['aktiv', 'aufgebraucht', 'ausgesondert'];
export const MATERIAL_BEWEGUNG_TYPEN = ['zugang', 'abgang', 'storno'];

function leer(value) {
  return value == null || !String(value).trim();
}

function istNichtNegativeGanzeZahl(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function uuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `mat_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalisiereBewegung(bewegung) {
  return {
    id: bewegung?.id || uuid(),
    typ: MATERIAL_BEWEGUNG_TYPEN.includes(bewegung?.typ) ? bewegung.typ : 'zugang',
    menge: istNichtNegativeGanzeZahl(bewegung?.menge) ? bewegung.menge : 0,
    timestamp: String(bewegung?.timestamp || nowIso()),
    quelle: String(bewegung?.quelle || '').trim(),
    notiz: String(bewegung?.notiz || '').trim(),
    referenz: String(bewegung?.referenz || '').trim(),
  };
}

export function validateMaterialEintrag(eintrag) {
  if (!eintrag || typeof eintrag !== 'object') return err('materialeintrag muss ein Objekt sein');
  if (leer(eintrag.nummer)) return err('nummer darf nicht leer sein');
  if (leer(eintrag.bezeichnung)) return err('bezeichnung darf nicht leer sein');
  if (!istNichtNegativeGanzeZahl(eintrag.menge)) return err('menge muss eine nicht-negative ganze Zahl sein');
  if (eintrag.status != null && !MATERIAL_STATUS.includes(eintrag.status)) {
    return err('status ist ungültig');
  }
  return OK;
}

export function normalisiereMaterialEintrag(eintrag) {
  return {
    id: eintrag?.id || uuid(),
    nummer: String(eintrag?.nummer || '').trim(),
    bezeichnung: String(eintrag?.bezeichnung || '').trim(),
    variante: String(eintrag?.variante || '').trim().toUpperCase(),
    menge: istNichtNegativeGanzeZahl(eintrag?.menge) ? eintrag.menge : 0,
    status: MATERIAL_STATUS.includes(eintrag?.status) ? eintrag.status : 'aktiv',
    lagerort: String(eintrag?.lagerort || '').trim(),
    herkunftBestellungId: String(eintrag?.herkunftBestellungId || '').trim(),
    notiz: String(eintrag?.notiz || '').trim(),
    bewegungen: Array.isArray(eintrag?.bewegungen) ? eintrag.bewegungen.map(normalisiereBewegung) : [],
  };
}

export function sortiereMaterialbestand(eintraege) {
  return [...(eintraege || [])].sort((a, b) =>
    `${a.nummer}\x00${a.bezeichnung}\x00${a.variante}`.localeCompare(
      `${b.nummer}\x00${b.bezeichnung}\x00${b.variante}`,
      'de'
    )
  );
}

export function zusammenfassungMaterialbestand(eintraege) {
  const liste = eintraege || [];
  const aktiv = liste.filter(e => e.status === 'aktiv');
  return {
    postenAktiv: aktiv.length,
    mengeAktiv: aktiv.reduce((summe, eintrag) => summe + (eintrag.menge || 0), 0),
    postenAufgebraucht: liste.filter(e => e.status === 'aufgebraucht').length,
    postenAusgesondert: liste.filter(e => e.status === 'ausgesondert').length,
  };
}

export function bucheMaterialBewegung(eintrag, bewegungInput) {
  const material = normalisiereMaterialEintrag(eintrag);
  const bewegung = normalisiereBewegung(bewegungInput);

  if (!bewegung.menge || bewegung.menge <= 0) {
    return { ok: false, fehler: 'bewegung.menge muss eine positive ganze Zahl sein' };
  }

  let neueMenge = material.menge;
  if (bewegung.typ === 'zugang') {
    neueMenge += bewegung.menge;
  } else if (bewegung.typ === 'abgang' || bewegung.typ === 'storno') {
    if (bewegung.menge > material.menge) {
      return { ok: false, fehler: 'bewegung.menge darf den aktuellen Bestand nicht überschreiten' };
    }
    neueMenge -= bewegung.menge;
  } else {
    return { ok: false, fehler: 'bewegung.typ ist ungültig' };
  }

  return {
    ok: true,
    eintrag: {
      ...material,
      menge: neueMenge,
      status: neueMenge > 0 ? 'aktiv' : 'aufgebraucht',
      bewegungen: [bewegung, ...material.bewegungen],
    },
  };
}

export function materialbestandKey(eintrag) {
  const nummer = String(eintrag?.nummer ?? eintrag?.artikelNr ?? '').trim().toLowerCase();
  const variante = String(eintrag?.variante || '').trim().toUpperCase();
  const bezeichnung = String(eintrag?.bezeichnung ?? eintrag?.name ?? '').trim().toLowerCase();
  return `${nummer}\x00${variante}\x00${bezeichnung}`;
}

export function verbucheLagerbestandAusBestellung(materialbestand, bestellung) {
  const liste = (materialbestand || []).map(normalisiereMaterialEintrag);

  for (const position of (bestellung?.positionen || [])) {
    const menge = Number.isInteger(position?.ogBestandMenge) ? position.ogBestandMenge : 0;
    if (position?.typ !== 'artikel' || menge <= 0) continue;

    const basis = normalisiereMaterialEintrag({
      nummer: position.artikelNr,
      bezeichnung: position.name,
      variante: position.variante || '',
      menge,
      status: 'aktiv',
      herkunftBestellungId: bestellung?.id || '',
    });
    const key = materialbestandKey(basis);
    const vorhanden = liste.findIndex(eintrag => materialbestandKey(eintrag) === key);

    if (vorhanden >= 0) {
      const buchung = bucheMaterialBewegung(liste[vorhanden], {
        typ: 'zugang',
        menge,
        quelle: 'bestellung-abschluss',
        referenz: bestellung?.id || '',
        notiz: `Automatisch aus Bestellung ${bestellung?.bezeichnung || bestellung?.id || ''}`.trim(),
      });
      if (buchung.ok) {
        liste[vorhanden] = buchung.eintrag;
      }
    } else {
      const buchung = bucheMaterialBewegung({ ...basis, menge: 0, bewegungen: [] }, {
        typ: 'zugang',
        menge,
        quelle: 'bestellung-abschluss',
        referenz: bestellung?.id || '',
        notiz: `Automatisch aus Bestellung ${bestellung?.bezeichnung || bestellung?.id || ''}`.trim(),
      });
      if (buchung.ok) {
        liste.push(buchung.eintrag);
      }
    }
  }

  return sortiereMaterialbestand(liste);
}

export function storniereLagerbestandAusBestellung(materialbestand, bestellung) {
  const liste = (materialbestand || []).map(normalisiereMaterialEintrag);
  const warnungen = [];

  for (const position of (bestellung?.positionen || [])) {
    const menge = Number.isInteger(position?.ogBestandMenge) ? position.ogBestandMenge : 0;
    if (position?.typ !== 'artikel' || menge <= 0) continue;

    const key = materialbestandKey({
      nummer: position.artikelNr,
      bezeichnung: position.name,
      variante: position.variante || '',
    });
    const index = liste.findIndex(eintrag => materialbestandKey(eintrag) === key);

    if (index < 0) {
      warnungen.push(`${position.artikelNr} ${position.name}${position.variante ? ` ${position.variante}` : ''}`.trim());
      continue;
    }

    const vorhandeneMenge = liste[index].menge || 0;
    if (vorhandeneMenge < menge) {
      warnungen.push(`${position.artikelNr} ${position.name}${position.variante ? ` ${position.variante}` : ''}`.trim());
    }

    const buchung = bucheMaterialBewegung(liste[index], {
      typ: 'storno',
      menge: Math.min(menge, vorhandeneMenge),
      quelle: 'bestellung-wieder-geoeffnet',
      referenz: bestellung?.id || '',
      notiz: `Rückbuchung aus Bestellung ${bestellung?.bezeichnung || bestellung?.id || ''}`.trim(),
    });
    if (!buchung.ok) {
      warnungen.push(`${position.artikelNr} ${position.name}${position.variante ? ` ${position.variante}` : ''}`.trim());
      continue;
    }
    liste[index] = buchung.eintrag;
  }

  return {
    materialbestand: sortiereMaterialbestand(liste),
    warnungen,
  };
}
