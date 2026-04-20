import { erstelleRechnungsDaten } from './pdf.js';

function heuteIso() {
  return new Date().toISOString().slice(0, 10);
}

export function findeArtikelFuerBestand(artikelListe, bestandseintrag) {
  return (artikelListe || []).find(artikel =>
    artikel.artikelNr === bestandseintrag.nummer &&
    (artikel.variante || '') === (bestandseintrag.variante || '')
  ) || null;
}

export function erstelleLagerverkauf(bestandseintrag, artikel, mitgliedId, mitgliedName, einstellungen, alleRechnungen, opts = {}) {
  const datum = heuteIso();
  const bezeichnung = [
    'Lagerverkauf',
    mitgliedName || mitgliedId,
    datum,
  ].join(' · ');

  const bestellung = {
    id: crypto.randomUUID(),
    datum,
    bezeichnung,
    status: opts.status || 'abgeschlossen',
    quelle: opts.quelle || 'lagerverkauf',
    referenzAnfrageId: opts.referenzAnfrageId || '',
    wuensche: [],
    positionen: [
      {
        id: crypto.randomUUID(),
        artikelNr: bestandseintrag.nummer,
        variante: bestandseintrag.variante || '',
        name: bestandseintrag.bezeichnung,
        menge: bestandseintrag.menge,
        einzelpreis: artikel.einzelpreis || 0,
        bvFoerderung: artikel.bvFoerderung || 0,
        lvFoerderung: artikel.lvFoerderung || 0,
        ogFoerderung: artikel.ogFoerderung || 0,
        ogUebernimmtRest: !!artikel.ogUebernimmtRest,
        foerderungGespeichert: true,
        typ: 'artikel',
        retoureMenge: 0,
        ogBestandMenge: 0,
        zuweisung: [
          { mitgliedId, menge: bestandseintrag.menge, ogKostenlos: !!opts.ogKostenlos },
        ],
      },
    ],
    rechnungen: [],
  };

  const rechnung = erstelleRechnungsDaten(bestellung, mitgliedId, einstellungen, [artikel], alleRechnungen);
  return {
    bestellung: {
      ...bestellung,
      rechnungen: rechnung ? [rechnung] : [],
    },
    rechnung,
  };
}
