import {
  berechneStunden,
  verechneSchuld,
  fristDerAeltestenOffenenSchuld,
} from '../src/stunden.js';
import { berechneKassenwartZeilen } from '../src/kassenwart.js';
import { bauePositionenAusAbgleich } from '../src/abgleich.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion fehlgeschlagen');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      (message || 'Assertion fehlgeschlagen') +
      ` — erwartet: ${JSON.stringify(expected)}, bekommen: ${JSON.stringify(actual)}`
    );
  }
}

test('berechneStunden ordnet LifeguardClock-Eintraege ueber nutzer-Name einem Mitglied zu', () => {
  const mitglieder = [
    { id: 'max', name: 'Max Muster' },
  ];
  const logEintraege = [
    { nutzer: 'Max Muster', typ: 'wachdienst', dauer_ms: 2 * 3_600_000 },
  ];

  const { stundenMap, unbekannt } = berechneStunden(logEintraege, ['wachdienst'], mitglieder);

  assertEqual(stundenMap.get('max'), 2, 'Stunden wurden nicht dem Mitglied zugeordnet');
  assertEqual(unbekannt.length, 0, 'Bekannter Name darf nicht als unbekannt markiert werden');
});

test('berechneStunden meldet unbekannte nutzer-Namen separat', () => {
  const mitglieder = [
    { id: 'max', name: 'Max Muster' },
  ];
  const logEintraege = [
    { nutzer: 'Erika Beispiel', typ: 'wachdienst', dauer_ms: 3_600_000 },
  ];

  const { stundenMap, unbekannt } = berechneStunden(logEintraege, ['wachdienst'], mitglieder);

  assertEqual(stundenMap.size, 0, 'Unbekannte Namen duerfen nicht verbucht werden');
  assert(unbekannt.includes('Erika Beispiel'), 'Unbekannter Name fehlt in unbekannt[]');
});

test('berechneStunden matched nutzer-Namen robust gegen Gross-/Kleinschreibung und Leerzeichen', () => {
  const mitglieder = [
    { id: 'max', name: 'Max Muster' },
  ];
  const logEintraege = [
    { nutzer: '  max muster  ', typ: 'wachdienst', dauer_ms: 3_600_000 },
  ];

  const { stundenMap } = berechneStunden(logEintraege, ['wachdienst'], mitglieder);

  assertEqual(stundenMap.get('max'), 1, 'Normalisierte Namen muessen gematcht werden');
});

test('fristDerAeltestenOffenenSchuld ignoriert bereits getilgte alte Schulden', () => {
  const bestellungen = [
    {
      datum: '2024-03-01',
      rechnungen: [
        { mitgliedId: 'max', nummer: 'R_2024_03_001', datum: '2024-03-10', erwartetEinsatzstunden: 3 },
      ],
    },
    {
      datum: '2025-05-01',
      rechnungen: [
        { mitgliedId: 'max', nummer: 'R_2025_05_001', datum: '2025-05-10', erwartetEinsatzstunden: 6 },
      ],
    },
  ];

  const { verrechnungen } = verechneSchuld('max', bestellungen, 4, { stundenRate: { stunden: 3, euro: 10 } });
  const frist = fristDerAeltestenOffenenSchuld(verrechnungen);

  assertEqual(frist?.getFullYear(), 2026, 'Frist muss von der noch offenen 2025er Schuld kommen');
  assertEqual(frist?.getMonth(), 11, 'Fristmonat muss Dezember sein');
  assertEqual(frist?.getDate(), 31, 'Fristtag muss 31 sein');
});

test('fristDerAeltestenOffenenSchuld gibt null ohne offene Schuld zurueck', () => {
  const frist = fristDerAeltestenOffenenSchuld([
    { offenStunden: 0, frist: new Date('2026-12-31') },
  ]);

  assertEqual(frist, null, 'Ohne offene Schuld darf keine Frist gesetzt werden');
});

test('berechneKassenwartZeilen beruecksichtigt ogKostenlos in der Mitgliederbelastung', () => {
  const bestellungen = [
    {
      id: 'b1',
      datum: '2026-04-01',
      bezeichnung: 'Fruehjahr',
      status: 'abgeschlossen',
      positionen: [
        {
          artikelNr: 'A1',
          variante: '',
          name: 'Jacke',
          einzelpreis: 20,
          bvFoerderung: 5,
          lvFoerderung: 3,
          ogFoerderung: 0,
          ogUebernimmtRest: false,
          zuweisung: [
            { mitgliedId: 'max', menge: 1, ogKostenlos: true },
          ],
        },
      ],
      rechnungen: [],
    },
  ];

  const zeilen = berechneKassenwartZeilen(bestellungen, [], [{ id: 'max', name: 'Max Muster' }]);

  assertEqual(zeilen.length, 1, 'Es muss genau eine Zeile entstehen');
  assertEqual(zeilen[0].anteil, 0, 'ogKostenlos darf keinen Mitgliederanteil ausweisen');
  assertEqual(zeilen[0].og, 12, 'Der Rest muss dem OG-Anteil zugeschlagen werden');
});

test('berechneKassenwartZeilen bevorzugt gespeicherte Positionsdaten vor aktuellem Katalog', () => {
  const bestellungen = [
    {
      id: 'b1',
      datum: '2026-04-01',
      bezeichnung: 'Fruehjahr',
      status: 'abgeschlossen',
      positionen: [
        {
          artikelNr: 'A1',
          variante: '',
          name: 'Jacke',
          einzelpreis: 50,
          bvFoerderung: 10,
          lvFoerderung: 5,
          ogFoerderung: 7,
          ogUebernimmtRest: false,
          zuweisung: [
            { mitgliedId: 'max', menge: 1, ogKostenlos: false },
          ],
        },
      ],
      rechnungen: [],
    },
  ];
  const artikelListe = [
    {
      artikelNr: 'A1',
      variante: '',
      einzelpreis: 50,
      bvFoerderung: 1,
      lvFoerderung: 1,
      ogFoerderung: 1,
      ogUebernimmtRest: false,
    },
  ];

  const zeilen = berechneKassenwartZeilen(bestellungen, artikelListe, [{ id: 'max', name: 'Max Muster' }]);

  assertEqual(zeilen[0].bv, 10, 'Historische BV-Foerderung muss aus der Position kommen');
  assertEqual(zeilen[0].lv, 5, 'Historische LV-Foerderung muss aus der Position kommen');
  assertEqual(zeilen[0].og, 7, 'Historische OG-Foerderung muss aus der Position kommen');
  assertEqual(zeilen[0].anteil, 28, 'Mitgliederanteil darf nicht vom aktuellen Katalog ueberschrieben werden');
});

test('bauePositionenAusAbgleich uebernimmt Mengenabweichungen nur bei Aktion uebernehmen', () => {
  const abgleichResult = {
    gematch: [],
    abweichungen: [
      {
        typ: 'menge',
        erwartet: 2,
        geliefert: 1,
        wunsch: { artikelNr: 'A1', variante: '', name: 'Jacke', menge: 2 },
        position: { artikelNr: 'A1', variante: '', name: 'Jacke', menge: 1, einzelpreis: 20, bvFoerderung: 5, lvFoerderung: 3 },
      },
    ],
    og_kosten: [],
  };
  const wuensche = [
    { mitgliedId: 'max', artikelNr: 'A1', variante: '', name: 'Jacke', menge: 2, ogKostenlos: false },
  ];

  const ignoriert = bauePositionenAusAbgleich(abgleichResult, wuensche, [], new Map([['A1\x00', 'ignorieren']]));
  const uebernommen = bauePositionenAusAbgleich(abgleichResult, wuensche, [], new Map([['A1\x00', 'uebernehmen']]));

  assertEqual(ignoriert.length, 0, 'Ignorierte Mengenabweichungen duerfen keine Position erzeugen');
  assertEqual(uebernommen.length, 1, 'Uebernommene Mengenabweichungen muessen eine Position erzeugen');
  assertEqual(uebernommen[0].menge, 1, 'Es muss die gelieferte Menge verbucht werden');
});

test('bauePositionenAusAbgleich speichert OG-Foerderdaten aus dem Katalog als Snapshot', () => {
  const abgleichResult = {
    gematch: [
      {
        wunsch: { artikelNr: 'A1', variante: 'M', name: 'Jacke', menge: 1 },
        position: { artikelNr: 'A1', variante: 'M', name: 'Jacke', menge: 1, einzelpreis: 50, bvFoerderung: 10, lvFoerderung: 5 },
      },
    ],
    abweichungen: [],
    og_kosten: [],
  };
  const artikelListe = [
    { artikelNr: 'A1', variante: 'M', ogFoerderung: 7, ogUebernimmtRest: false },
  ];
  const wuensche = [
    { mitgliedId: 'max', artikelNr: 'A1', variante: 'M', name: 'Jacke', menge: 1, ogKostenlos: false },
  ];

  const positionen = bauePositionenAusAbgleich(abgleichResult, wuensche, artikelListe, new Map());

  assertEqual(positionen[0].ogFoerderung, 7, 'OG-Foerderung muss in der Position gespeichert werden');
  assertEqual(positionen[0].foerderungGespeichert, true, 'Position muss als Snapshot markiert werden');
});

test('bauePositionenAusAbgleich uebernimmt OG-Kosten separat', () => {
  const positionen = bauePositionenAusAbgleich({
    gematch: [],
    abweichungen: [],
    og_kosten: [
      { artikelNr: 'VERSANDKOSTEN', name: 'Versand', menge: 1, einzelpreis: 6.5 },
    ],
  }, [], [], new Map());

  assertEqual(positionen.length, 1, 'OG-Kosten muessen als eigene Position gespeichert werden');
  assertEqual(positionen[0].typ, 'og-kosten', 'OG-Kosten muessen den passenden Typ behalten');
  assertEqual(positionen[0].einzelpreis, 6.5, 'OG-Kosten muessen Preiswerte behalten');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

console.log(`${passed}/${tests.length} Tests bestanden`);
