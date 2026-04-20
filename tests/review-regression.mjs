import fs from 'node:fs/promises';
import path from 'node:path';
import {
  berechneStunden,
  verechneSchuld,
  fristDerAeltestenOffenenSchuld,
} from '../src/stunden.js';
import { fuegeArtikelHinzu } from '../src/artikel-katalog.js';
import { berechneKassenwartZeilen, berechneSondermengenZeilen } from '../src/kassenwart.js';
import { bauePositionenAusAbgleich, normalisierePosition } from '../src/abgleich.js';
import {
  bucheMaterialBewegung,
  normalisiereMaterialEintrag,
  validateMaterialEintrag,
  zusammenfassungMaterialbestand,
  verbucheLagerbestandAusBestellung,
  storniereLagerbestandAusBestellung,
} from '../src/materialbestand.js';
import {
  normalisiereMaterialanfrage,
  validateMaterialanfrage,
} from '../src/materialanfragen.js';
import { erstelleLagerverkauf, findeArtikelFuerBestand } from '../src/materialverkauf.js';
import { auditAktion } from '../src/audit.js';
import { erstelleRechnungsDaten } from '../src/pdf.js';
import {
  authentifiziereBenutzer,
  hashPassword,
  initialisiereErstenBenutzer,
  normalizeLogin,
  verifyPassword,
} from '../src/auth.js';
import {
  authentifiziereMitglied,
  hashClockPin,
  verifyClockPin,
} from '../src/stempeluhr-auth.js';
import {
  findeMitgliedsSperre,
  normalizeZugriff,
} from '../src/zugriff.js';
import {
  persistJsonWithSync,
  hydrateJsonFromSync,
  getScopeSyncStatus,
  isConflictSync,
} from '../src/sync.js';
import { parseVerkaufsrechnung } from '../src/parse-verkaufsrechnung.js';

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

test('berechneKassenwartZeilen zeigt virtuelle Extern-Besteller mit sprechendem Namen', () => {
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
            { mitgliedId: '__extern__', menge: 1, ogKostenlos: false },
          ],
        },
      ],
      rechnungen: [],
    },
  ];

  const zeilen = berechneKassenwartZeilen(bestellungen, [], []);
  assertEqual(zeilen[0].mitgliedName, 'Extern', 'Virtuelle Extern-Besteller sollen sauber benannt werden');
});

test('fuegeArtikelHinzu ueberschreibt vorhandene Artikel bei neuerem Preis oder Foerderung', () => {
  const katalog = [{
    id: 'a1',
    artikelNr: '4711',
    variante: 'GR 43',
    name: 'Einsatzhose',
    einzelpreis: 50,
    bvFoerderung: 5,
    lvFoerderung: 0,
    ogFoerderung: 0,
    ogUebernimmtRest: false,
  }];
  const neu = [{
    artikelNr: '4711',
    variante: 'gr 43',
    name: 'Einsatzhose',
    einzelpreis: 55,
    bvFoerderung: 6,
    lvFoerderung: 0,
    ogFoerderung: 0,
    ogUebernimmtRest: false,
  }];

  const result = fuegeArtikelHinzu(katalog, neu);

  assertEqual(result.katalog.length, 1, 'Aktualisierte Artikel duerfen keinen Duplikat-Eintrag erzeugen');
  assertEqual(result.katalog[0].id, 'a1', 'Beim Ueberschreiben soll die bestehende ID erhalten bleiben');
  assertEqual(result.katalog[0].einzelpreis, 55, 'Neuer Preis muss den alten ueberschreiben');
  assertEqual(result.aktualisiert.length, 1, 'Aktualisierung muss gemeldet werden');
  assertEqual(result.duplikate.length, 0, 'Geaenderte Artikel duerfen nicht als Duplikat gelten');
});

test('fuegeArtikelHinzu ueberspringt nur vollstaendig identische Artikel', () => {
  const katalog = [{
    id: 'a1',
    artikelNr: '4711',
    variante: 'GR 43',
    name: 'Einsatzhose',
    einzelpreis: 50,
    bvFoerderung: 5,
    lvFoerderung: 0,
    ogFoerderung: 0,
    ogUebernimmtRest: false,
  }];

  const result = fuegeArtikelHinzu(katalog, [{
    artikelNr: '4711',
    variante: 'GR 43',
    name: 'Einsatzhose',
    einzelpreis: 50,
    bvFoerderung: 5,
    lvFoerderung: 0,
    ogFoerderung: 0,
    ogUebernimmtRest: false,
  }]);

  assertEqual(result.katalog.length, 1, 'Identische Artikel duerfen keinen zweiten Eintrag erzeugen');
  assertEqual(result.duplikate.length, 1, 'Identische Artikel muessen als Duplikat gemeldet werden');
});

test('berechneSondermengenZeilen listet Retoure und Lagerbestand nur fuer abgeschlossene Bestellungen', () => {
  const zeilen = berechneSondermengenZeilen([
    {
      id: 'b1',
      datum: '2026-04-01',
      bezeichnung: 'Fruehjahr',
      status: 'abgeschlossen',
      positionen: [
        {
          typ: 'artikel',
          name: 'Jacke',
          variante: 'M',
          einzelpreis: 20,
          retoureMenge: 2,
          ogBestandMenge: 1,
        },
        {
          typ: 'og-kosten',
          name: 'Versand',
          einzelpreis: 5,
          retoureMenge: 9,
          ogBestandMenge: 9,
        },
      ],
    },
    {
      id: 'b2',
      datum: '2026-05-01',
      bezeichnung: 'Sommer',
      status: 'anprobe',
      positionen: [
        {
          typ: 'artikel',
          name: 'Hose',
          variante: 'L',
          einzelpreis: 15,
          retoureMenge: 1,
          ogBestandMenge: 1,
        },
      ],
    },
  ]);

  assertEqual(zeilen.length, 2, 'Es duerfen nur Artikel-Sondermengen abgeschlossener Bestellungen auftauchen');
  assertEqual(zeilen[0].typ, 'retoure', 'Die erste Zeile muss eine Retoure sein');
  assertEqual(zeilen[0].brutto, 40, 'Retoure-Wert muss Menge x Einzelpreis sein');
  assertEqual(zeilen[1].typ, 'og-bestand', 'Die zweite Zeile muss Lagerbestand sein');
  assertEqual(zeilen[1].brutto, 20, 'Lagerbestand-Wert muss Menge x Einzelpreis sein');
});

test('normalisiereMaterialEintrag vereinheitlicht Variante, Status und Mengenfelder', () => {
  const eintrag = normalisiereMaterialEintrag({
    nummer: '4711 ',
    bezeichnung: ' Einsatzhose ',
    variante: 'gr 43',
    menge: 4,
    lagerort: ' Schrank A ',
  });

  assertEqual(eintrag.nummer, '4711', 'Nummer muss getrimmt werden');
  assertEqual(eintrag.bezeichnung, 'Einsatzhose', 'Bezeichnung muss getrimmt werden');
  assertEqual(eintrag.variante, 'GR 43', 'Variante muss vereinheitlicht werden');
  assertEqual(eintrag.status, 'aktiv', 'Fehlender Status muss als aktiv normalisiert werden');
  assertEqual(eintrag.lagerort, 'Schrank A', 'Lagerort muss getrimmt werden');
});

test('validateMaterialEintrag verlangt Nummer, Bezeichnung und nicht-negative Menge', () => {
  assertEqual(validateMaterialEintrag({
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    menge: 3,
    status: 'aktiv',
  }).ok, true, 'Gueltiger Bestandsposten muss akzeptiert werden');

  assertEqual(validateMaterialEintrag({
    nummer: '',
    bezeichnung: 'Einsatzhose',
    menge: 3,
    status: 'aktiv',
  }).ok, false, 'Leere Nummer muss abgelehnt werden');

  assertEqual(validateMaterialEintrag({
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    menge: -1,
    status: 'aktiv',
  }).ok, false, 'Negative Menge muss abgelehnt werden');
});

test('zusammenfassungMaterialbestand summiert nur aktive Mengen in den Bestand', () => {
  const summe = zusammenfassungMaterialbestand([
    { status: 'aktiv', menge: 4 },
    { status: 'aktiv', menge: 2 },
    { status: 'aufgebraucht', menge: 0 },
    { status: 'ausgesondert', menge: 1 },
  ]);

  assertEqual(summe.postenAktiv, 2, 'Aktive Posten muessen gezaehlt werden');
  assertEqual(summe.mengeAktiv, 6, 'Nur aktive Mengen gehoeren in den Bestand');
  assertEqual(summe.postenAufgebraucht, 1, 'Aufgebrauchte Posten muessen separat gezaehlt werden');
  assertEqual(summe.postenAusgesondert, 1, 'Ausgesonderte Posten muessen separat gezaehlt werden');
});

test('bucheMaterialBewegung protokolliert Zugang und Abgang direkt am Bestandsposten', () => {
  const start = normalisiereMaterialEintrag({
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    variante: 'GR 43',
    menge: 4,
  });
  const zugang = bucheMaterialBewegung(start, {
    typ: 'zugang',
    menge: 2,
    quelle: 'manuell',
    notiz: 'Nachbestellung',
  });
  assertEqual(zugang.ok, true, 'Zugang muss erlaubt sein');
  assertEqual(zugang.eintrag.menge, 6, 'Zugang muss die Menge erhoehen');
  assertEqual(zugang.eintrag.bewegungen.length, 1, 'Zugang muss protokolliert werden');
  assertEqual(zugang.eintrag.bewegungen[0].typ, 'zugang', 'Zugangslog fehlt');

  const abgang = bucheMaterialBewegung(zugang.eintrag, {
    typ: 'abgang',
    menge: 5,
    quelle: 'manuell',
    notiz: 'Ausgabe an Einsatz',
  });
  assertEqual(abgang.ok, true, 'Abgang muss erlaubt sein');
  assertEqual(abgang.eintrag.menge, 1, 'Abgang muss die Menge reduzieren');
  assertEqual(abgang.eintrag.bewegungen.length, 2, 'Abgang muss im Log ergaenzt werden');
  assertEqual(abgang.eintrag.bewegungen[0].typ, 'abgang', 'Neuster Logeintrag muss der Abgang sein');
});

test('erstelleLagerverkauf baut abgeschlossene Bestellung mit Rechnung aus aktuellem Katalog', () => {
  const bestand = normalisiereMaterialEintrag({
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    variante: 'GR 43',
    menge: 2,
  });
  const artikel = findeArtikelFuerBestand([{
    artikelNr: '4711',
    variante: 'GR 43',
    name: 'Einsatzhose',
    einzelpreis: 60,
    bvFoerderung: 10,
    lvFoerderung: 5,
    ogFoerderung: 0,
    ogUebernimmtRest: false,
  }], bestand);

  const verkauf = erstelleLagerverkauf(
    { ...bestand, menge: 2 },
    artikel,
    'max',
    'Max Muster',
    { stundenRate: { stunden: 3, euro: 10 } },
    []
  );

  assertEqual(verkauf.bestellung.status, 'abgeschlossen', 'Lagerverkauf muss direkt abgeschlossen sein');
  assertEqual(verkauf.bestellung.quelle, 'lagerverkauf', 'Quelle muss als Lagerverkauf markiert sein');
  assertEqual(verkauf.bestellung.rechnungen.length, 1, 'Lagerverkauf muss direkt eine Rechnung erzeugen');
  assertEqual(verkauf.rechnung.gesamtbetrag, 90, 'Rechnung muss mit aktuellem Katalogpreis und Foerderung rechnen');
});

test('erstelleLagerverkauf respektiert OG uebernimmt wie im normalen Bestellfluss', () => {
  const bestand = normalisiereMaterialEintrag({
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    variante: 'GR 43',
    menge: 1,
  });
  const artikel = {
    artikelNr: '4711',
    variante: 'GR 43',
    name: 'Einsatzhose',
    einzelpreis: 60,
    bvFoerderung: 10,
    lvFoerderung: 5,
    ogFoerderung: 0,
    ogUebernimmtRest: false,
  };

  const verkauf = erstelleLagerverkauf(
    bestand,
    artikel,
    'max',
    'Max Muster',
    { stundenRate: { stunden: 3, euro: 10 } },
    [],
    { ogKostenlos: true }
  );

  assertEqual(verkauf.bestellung.positionen[0].zuweisung[0].ogKostenlos, true, 'Lagerverkauf muss ogKostenlos in die Zuweisung schreiben');
  assertEqual(verkauf.rechnung.gesamtbetrag, 0, 'Wenn OG uebernimmt, muss die Rechnung 0 Euro ausweisen');
  assertEqual(verkauf.rechnung.ogAnteil, 45, 'Der Rest muss als OG-Anteil gerechnet werden');
});

test('normalisiereMaterialanfrage setzt Status und Entscheidungsfelder stabil', () => {
  const anfrage = normalisiereMaterialanfrage({
    materialId: 'mat1',
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    menge: 2,
    mitgliedId: 'max',
    foerderwunsch: true,
  });

  assertEqual(anfrage.status, 'offen', 'Neue Materialanfragen muessen offen starten');
  assertEqual(anfrage.foerderwunsch, true, 'Foerderwunsch muss erhalten bleiben');
  assertEqual(anfrage.entscheidung, '', 'Entscheidung darf vor Freigabe leer sein');
});

test('validateMaterialanfrage verlangt Materialbezug, Mitglied und positive Menge', () => {
  const ok = validateMaterialanfrage({
    materialId: 'mat1',
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    menge: 1,
    mitgliedId: 'max',
  });
  assertEqual(ok.ok, true, 'Gueltige Materialanfrage muss akzeptiert werden');

  const fehler = validateMaterialanfrage({
    materialId: '',
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    menge: 0,
    mitgliedId: '',
  });
  assertEqual(fehler.ok, false, 'Ungueltige Materialanfrage muss abgelehnt werden');
});

test('verbucheLagerbestandAusBestellung fuehrt gleiche Nummer, Variante und Bezeichnung zusammen', () => {
  const materialbestand = [{
    id: 'mat1',
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    variante: 'GR 43',
    menge: 2,
    status: 'aktiv',
    bewegungen: [],
  }];
  const bestellung = {
    id: 'best1',
    positionen: [{
      typ: 'artikel',
      artikelNr: '4711',
      name: 'Einsatzhose',
      variante: 'gr 43',
      ogBestandMenge: 3,
    }],
  };

  const neu = verbucheLagerbestandAusBestellung(materialbestand, bestellung);

  assertEqual(neu.length, 1, 'Gleiche Bestandsposten muessen zusammengefuehrt werden');
  assertEqual(neu[0].menge, 5, 'Die Mengen muessen addiert werden');
  assertEqual(neu[0].status, 'aktiv', 'Zusammengefuehrter Bestand muss aktiv sein');
  assertEqual(neu[0].bewegungen[0].typ, 'zugang', 'Automatische Lagerbuchung muss protokolliert werden');
});

test('storniereLagerbestandAusBestellung reduziert zusammengefuehrten Bestand wieder', () => {
  const materialbestand = [{
    id: 'mat1',
    nummer: '4711',
    bezeichnung: 'Einsatzhose',
    variante: 'GR 43',
    menge: 5,
    status: 'aktiv',
    bewegungen: [],
  }];
  const bestellung = {
    id: 'best1',
    positionen: [{
      typ: 'artikel',
      artikelNr: '4711',
      name: 'Einsatzhose',
      variante: 'gr 43',
      ogBestandMenge: 3,
    }],
  };

  const rueck = storniereLagerbestandAusBestellung(materialbestand, bestellung);

  assertEqual(rueck.warnungen.length, 0, 'Passende Bestandsposten duerfen keine Warnung erzeugen');
  assertEqual(rueck.materialbestand[0].menge, 2, 'Rueckbuchung muss die Bestandserhoehung wieder abziehen');
  assertEqual(rueck.materialbestand[0].bewegungen[0].typ, 'storno', 'Rueckbuchung muss im Bewegungslog landen');
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

test('bauePositionenAusAbgleich initialisiert Anprobe-Felder mit 0', () => {
  const positionen = bauePositionenAusAbgleich({
    gematch: [
      {
        wunsch: { artikelNr: 'A1', variante: '', name: 'Jacke', menge: 1 },
        position: { artikelNr: 'A1', variante: '', name: 'Jacke', menge: 1, einzelpreis: 20, bvFoerderung: 5, lvFoerderung: 3 },
      },
    ],
    abweichungen: [],
    og_kosten: [],
  }, [
    { mitgliedId: 'max', artikelNr: 'A1', variante: '', name: 'Jacke', menge: 1, ogKostenlos: false },
  ], [], new Map());

  assertEqual(positionen[0].retoureMenge, 0, 'Retoure-Menge muss initial 0 sein');
  assertEqual(positionen[0].ogBestandMenge, 0, 'Lagerbestand-Menge muss initial 0 sein');
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

test('normalisierePosition trennt gleiche Mitglieder bei unterschiedlichem ogKostenlos-Status', () => {
  const position = normalisierePosition({
    artikelNr: 'A1',
    menge: 4,
    zuweisung: [
      { mitgliedId: 'max', menge: 1, ogKostenlos: false },
      { mitgliedId: 'max', menge: 2, ogKostenlos: true },
      { mitgliedId: 'max', menge: 1, ogKostenlos: true },
    ],
  });

  assertEqual(position.zuweisung.length, 2, 'gleicher Mitgliedseintrag darf nur je ogKostenlos-Status gemerged werden');
  assertEqual(position.zuweisung[0].menge, 1);
  assertEqual(position.zuweisung[0].ogKostenlos, false);
  assertEqual(position.zuweisung[1].menge, 3);
  assertEqual(position.zuweisung[1].ogKostenlos, true);
});

test('erstelleRechnungsDaten beruecksichtigt mehrere Zuweisungen derselben Position fuer ein Mitglied', () => {
  const rechnung = erstelleRechnungsDaten({
    id: 'best1',
    bezeichnung: 'Test',
    positionen: [
      {
        artikelNr: 'A1',
        variante: 'M',
        name: 'Shirt',
        menge: 2,
        einzelpreis: 20,
        bvFoerderung: 2,
        lvFoerderung: 3,
        ogFoerderung: 1,
        ogUebernimmtRest: false,
        typ: 'artikel',
        zuweisung: [
          { mitgliedId: 'max', menge: 1, ogKostenlos: false },
          { mitgliedId: 'max', menge: 1, ogKostenlos: true },
        ],
      },
    ],
  }, 'max', { stundenRate: { stunden: 3, euro: 10 } }, [
    { artikelNr: 'A1', variante: 'M', einzelpreis: 20, bvFoerderung: 2, lvFoerderung: 3, ogFoerderung: 1, ogUebernimmtRest: false },
  ], []);

  assert(rechnung, 'Rechnung muss erzeugt werden');
  assertEqual(rechnung.positionen.length, 2, 'beide Zuweisungen muessen in die Rechnung einfliessen');
  assertEqual(rechnung.gesamtbetrag, 14, 'Eigenanteil muss normalen und OG-kostenlosen Anteil korrekt kombinieren');
  assertEqual(rechnung.ogAnteil, 16, 'OG-Anteil muss aus beiden Zuweisungen summiert werden');
});

test('erstelleRechnungsDaten akzeptiert explizite Laufnummer fuer Serienrechnung', () => {
  const rechnung = erstelleRechnungsDaten({
    id: 'best2',
    bezeichnung: 'Serie',
    positionen: [
      {
        artikelNr: 'A1',
        variante: '',
        name: 'Shirt',
        menge: 1,
        einzelpreis: 20,
        bvFoerderung: 2,
        lvFoerderung: 3,
        ogFoerderung: 1,
        ogUebernimmtRest: false,
        typ: 'artikel',
        zuweisung: [
          { mitgliedId: 'max', menge: 1, ogKostenlos: false },
        ],
      },
    ],
  }, 'max', { stundenRate: { stunden: 3, euro: 10 } }, [
    { artikelNr: 'A1', variante: '', einzelpreis: 20, bvFoerderung: 2, lvFoerderung: 3, ogFoerderung: 1, ogUebernimmtRest: false },
  ], [], {
    laufnummer: 17,
    datum: '2026-04-19',
  });

  assert(rechnung, 'Rechnung muss erzeugt werden');
  assertEqual(rechnung.nummer, 'R_2026_04_017', 'Explizite Serienlaufnummer muss verwendet werden');
});

test('kritische UI-Dateien verwenden keine direkten HTML-Injection-APIs mehr', async () => {
  const dateien = [
    'bestellungen.html',
    'bestellung-abgleich.html',
    'bestellung-neu.html',
    'bestellung-sammeln.html',
    'dashboard.html',
    'index.html',
    'kassenwart.html',
    'materialbestand.html',
    'rechnungen.html',
    path.join('src', 'artikel-app.js'),
    path.join('src', 'materialbestand-app.js'),
  ];
  const verbotenePatterns = [
    /\binnerHTML\b/,
    /\binsertAdjacentHTML\b/,
    /\bouterHTML\b/,
    /\bdocument\.write\b/,
  ];

  for (const datei of dateien) {
    const inhalt = await fs.readFile(new URL(`../${datei}`, import.meta.url), 'utf8');
    const treffer = verbotenePatterns.find(pattern => pattern.test(inhalt));
    assert(!treffer, `${datei} verwendet weiterhin ${treffer}`);
  }
});

test('persistJsonWithSync sperrt Schreiben bei Remote-Fehler als offline-readonly', async () => {
  const storage = createMemoryStorage();
  const result = await persistJsonWithSync({
    scope: 'bestellungen',
    storageKey: 'lo_bestellungen',
    data: [{ id: 'b1' }],
    client: {
      async head() {
        return { ok: false, error: 'Nextcloud nicht erreichbar.' };
      },
      async writeJson() {
        return { ok: false, error: 'Nextcloud nicht erreichbar.' };
      },
    },
    remotePath: '/LifeguardOrders/bestellungen.json',
    storage,
  });

  assertEqual(result.ok, false, 'Schreiben muss ohne Remote fehlschlagen');
  assertEqual(result.remote.ok, false, 'Remote-Fehler muss sichtbar bleiben');
  assertEqual(storage.load('lo_bestellungen'), null, 'Lokale Daten duerfen ohne Remote-Success nicht persistiert werden');
  assertEqual(getScopeSyncStatus(storage.load('lo_sync_status'), 'bestellungen').mode, 'offline-readonly', 'Sync-Status muss auf offline-readonly wechseln');
});

test('persistJsonWithSync erkennt Remote-Konflikte vor dem Upload', async () => {
  const storage = createMemoryStorage({
    lo_bestellungen: [{ id: 'lokal' }],
    lo_sync_status: {
      bestellungen: {
        scope: 'bestellungen',
        mode: 'synced',
        remotePath: '/LifeguardOrders/bestellungen.json',
        etag: '"alt"',
      },
    },
  });

  const result = await hydrateJsonFromSync({
    scope: 'bestellungen',
    storageKey: 'lo_bestellungen',
    client: {
      async readJson() {
        return { ok: true, data: [{ id: 'lokal' }], etag: '"alt-neu"', lastModified: 'Sat, 19 Apr 2026 10:00:00 GMT' };
      },
    },
    remotePath: '/LifeguardOrders/bestellungen.json',
    isValidRemote: data => Array.isArray(data),
    storage,
  });

  assertEqual(result.source, 'remote', 'Initiales Laden muss Remote-Daten mit ETag übernehmen');

  const saveResult = await persistJsonWithSync({
    scope: 'bestellungen',
    storageKey: 'lo_bestellungen',
    data: [{ id: 'lokal', changed: true }],
    client: {
      async head() {
        return { ok: true, etag: '"fremd"', lastModified: 'Sat, 19 Apr 2026 11:00:00 GMT' };
      },
      async writeJson() {
        throw new Error('writeJson darf bei Konflikt nicht aufgerufen werden');
      },
    },
    remotePath: '/LifeguardOrders/bestellungen.json',
    storage,
  });

  assertEqual(saveResult.ok, false, 'Konflikte muessen den Write blockieren');
  assert(isConflictSync(storage.load('lo_sync_status'), 'bestellungen'), 'Konfliktstatus muss gesetzt werden');
});

test('hydrateJsonFromSync faellt bei Remote-Fehler auf lokalen Cache zurück und markiert read-only', async () => {
  const storage = createMemoryStorage({
    lo_bestellungen: [{ id: 'lokal' }],
  });
  const result = await hydrateJsonFromSync({
    scope: 'bestellungen',
    storageKey: 'lo_bestellungen',
    client: {
      async readJson() {
        return { ok: false, error: 'Nextcloud nicht erreichbar.' };
      },
    },
    remotePath: '/LifeguardOrders/bestellungen.json',
    isValidRemote: data => Array.isArray(data),
    storage,
  });

  assertEqual(result.source, 'local-fallback', 'Lokaler Cache muss bei Remote-Fehler lesbar bleiben');
  assertEqual(result.data[0].id, 'lokal', 'Lokaler Cache darf nicht verloren gehen');
  assertEqual(getScopeSyncStatus(storage.load('lo_sync_status'), 'bestellungen').mode, 'offline-readonly', 'Fallback muss als read-only markiert werden');
});

test('hashPassword und verifyPassword pruefen App-Logins stabil', async () => {
  const salt = 'testsalt';
  const passwordHash = await hashPassword('geheim123', salt);
  assert(await verifyPassword('geheim123', {
    id: 'martin',
    name: 'Martin',
    rolle: 'admin',
    aktiv: true,
    salt,
    passwordHash,
  }), 'Passwortpruefung muss fuer das korrekte Passwort erfolgreich sein');
  assertEqual(await verifyPassword('falsch', {
    id: 'martin',
    name: 'Martin',
    rolle: 'admin',
    aktiv: true,
    salt,
    passwordHash,
  }), false, 'Falsches Passwort darf nicht akzeptiert werden');
});

test('initialisiereErstenBenutzer legt einen Admin an und authentifiziereBenutzer meldet ihn an', async () => {
  let savedUsers = null;
  const client = {
    async readJson() {
      return savedUsers
        ? { ok: true, data: savedUsers }
        : { ok: false, error: 'Datei nicht gefunden.' };
    },
    async writeJson(path, data) {
      assertEqual(path, '/LifeguardOrders/benutzer.json', 'Benutzerdatei muss unter benutzer.json liegen');
      savedUsers = data;
      return { ok: true, etag: '"users-1"' };
    },
  };

  const bootstrap = await initialisiereErstenBenutzer({
    client,
    login: ' Martin ',
    name: 'Martin Beispiel',
    password: 'geheim123',
    storage: createMemoryStorage(),
  });
  assert(bootstrap.ok, 'Bootstrap des ersten Admins muss funktionieren');
  assertEqual(savedUsers[0].rolle, 'admin', 'Erster Benutzer muss Admin sein');
  assertEqual(normalizeLogin(savedUsers[0].id), 'martin', 'Login-ID muss normalisiert gespeichert werden');

  const login = await authentifiziereBenutzer({
    client,
    login: 'MARTIN',
    password: 'geheim123',
    storage: createMemoryStorage({ lo_benutzer: savedUsers }),
  });
  assert(login.ok, 'Anmeldung des frisch angelegten Benutzers muss funktionieren');
  assertEqual(login.user.name, 'Martin Beispiel');
});

test('hashClockPin und verifyClockPin pruefen Stempeluhr-PINs kompatibel', async () => {
  const salt = 'abc123';
  const pinHash = await hashClockPin('123456', salt);

  assert(await verifyClockPin('123456', {
    id: 'max',
    name: 'Max Muster',
    pin: pinHash,
    salt,
    mustChangePIN: false,
    aktiv: true,
  }), 'Gehashte PIN muss korrekt erkannt werden');

  assert(await verifyClockPin('654321', {
    id: 'otp',
    name: 'OTP Nutzer',
    pin: '654321',
    mustChangePIN: true,
    aktiv: true,
  }), 'Einmal-PIN im Klartext muss kompatibel zur Stempeluhr pruefbar sein');
});

test('authentifiziereMitglied lehnt mustChangePIN im Bestellsystem ab', async () => {
  const client = {
    async readJson(path) {
      if (path === '/LifeguardClock/lgc_users.json') {
        return {
          ok: true,
          data: [
            { id: 'max', name: 'Max Muster', pin: '123456', mustChangePIN: true, aktiv: true },
          ],
        };
      }
      if (path === '/LifeguardOrders/zugriff.json') {
        return { ok: false, error: 'Datei nicht gefunden.' };
      }
      return { ok: false, error: 'Datei nicht gefunden.' };
    },
  };

  const result = await authentifiziereMitglied({ client, pin: '123456' });

  assertEqual(result.ok, false, 'mustChangePIN darf im Bestellsystem nicht eingeloggt werden');
  assertEqual(result.mustChangePIN, true, 'mustChangePIN-Hinweis muss gesetzt werden');
});

test('authentifiziereMitglied uebernimmt globale oder individuelle Sperren aus zugriff.json', async () => {
  const pinHash = await hashClockPin('123456', 'salt1');
  const client = {
    async readJson(path) {
      if (path === '/LifeguardClock/lgc_users.json') {
        return {
          ok: true,
          data: [
            { id: 'max', name: 'Max Muster', pin: pinHash, salt: 'salt1', aktiv: true },
          ],
        };
      }
      if (path === '/LifeguardOrders/zugriff.json') {
        return {
          ok: true,
          data: {
            global: { userBestellungGesperrt: false, grund: '' },
            mitglieder: [
              { mitgliedId: 'max', gesperrt: true, grund: 'Offene Forderung' },
            ],
          },
        };
      }
      return { ok: false, error: 'Datei nicht gefunden.' };
    },
  };

  const result = await authentifiziereMitglied({
    client,
    pin: '123456',
    storage: createMemoryStorage(),
  });

  assert(result.ok, 'Aktives Mitglied mit korrekter PIN muss erkannt werden');
  assertEqual(result.lock.blocked, true, 'Sperrstatus muss aus zugriff.json uebernommen werden');
  assertEqual(result.lock.reason, 'Offene Forderung', 'Sperrgrund muss sichtbar bleiben');
});

test('normalizeZugriff und findeMitgliedsSperre normalisieren globale und individuelle Sperren', () => {
  const zugriff = normalizeZugriff({
    global: {
      userBestellungGesperrt: true,
      grund: 'Konto leer',
      gesetztVon: 'finanzen',
    },
    mitglieder: [
      { mitgliedId: 'max', gesperrt: true, grund: 'Offene Rechnung' },
    ],
  });

  const globalOnly = findeMitgliedsSperre(zugriff, 'erika');
  assertEqual(globalOnly.blocked, true, 'Globale Sperre muss Mitglieder ohne Einzeleintrag treffen');
  assertEqual(globalOnly.reason, 'Konto leer');

  const individuell = findeMitgliedsSperre(zugriff, 'max');
  assertEqual(individuell.blocked, true, 'Individuelle Sperre muss erkannt werden');
  assertEqual(individuell.reason, 'Offene Rechnung', 'Individueller Grund muss globalen Grund uebersteuern');
});

test('parseVerkaufsrechnung parst Artikel mit Preis, Variante und BV-Foerderung korrekt', () => {
  const text = `
Art.-Nr. Beschreibung Menge Einheit Brutto Rabatt % Betrag
18507180 Poloshirt rot JAKO (M) 2 21,50 43,00 A
MITTELVERW. BV Mittelverwendung Bundesverband 2 STÜCK -6,60 -13,20 C
18504118 DLRG Wetterjacke 4.0 leicht 1 149,90 149,90 A
MARINEPOOL (M)
MITTELVERW. BV Mittelverwendung Bundesverband 1 STÜCK -44,90 -44,90 C
MITTELVERW. LV Mittelverwendung Landesverbände 1 STÜCK -52,50 -52,50 C
EILAUFTRAG Kosten für Eilauftrag 1 5,95 5,95 A
`;
  const result = parseVerkaufsrechnung(text);
  assertEqual(result.artikel.length, 2, 'Zwei Artikel müssen erkannt werden');
  assertEqual(result.ogKosten.length, 1, 'EILAUFTRAG muss als OG-Kosten erkannt werden');

  const polo = result.artikel[0];
  assertEqual(polo.artikelNr, '18507180', 'ArtNr korrekt');
  assertEqual(polo.variante, 'M', 'Variante aus Beschreibungsende');
  assertEqual(polo.menge, 2, 'Menge 2');
  assertEqual(polo.einzelpreis, 21.5, 'Einzelpreis 21,50');
  assertEqual(polo.bvFoerderung, 6.6, 'BV-Förderung');
  assertEqual(polo.lvFoerderung, 0, 'Keine LV-Förderung');

  const jacke = result.artikel[1];
  assertEqual(jacke.artikelNr, '18504118', 'Wetterjacke ArtNr');
  assertEqual(jacke.variante, 'M', 'Variante aus Fortsetzungszeile');
  assertEqual(jacke.bvFoerderung, 44.9, 'BV-Förderung Wetterjacke');
  assertEqual(jacke.lvFoerderung, 52.5, 'LV-Förderung Wetterjacke');
});

test('parseVerkaufsrechnung erkennt Bundlekomponenten ohne Preis und Größe in Beschreibungsmitte', () => {
  const text = `
18508500 DLRG-NIVEA Bekleidungspaket 2.0 1 134,90 134,90 A
MITTELVERW. BV Mittelverwendung Bundesverband 1 STÜCK -104,90 -104,90 C
17406785 DLRG Sporttasche JAKO rot/gelb 1 A
18504111 Inzip-Fleece Jacke schwer (M)- rot - 1 57,90 57,90 A
`;
  const result = parseVerkaufsrechnung(text);
  assertEqual(result.artikel.length, 3, 'Bundle + Komponente + weiterer Artikel');

  const bundle = result.artikel[0];
  assertEqual(bundle.artikelNr, '18508500', 'Bundle ArtNr');
  assertEqual(bundle.einzelpreis, 134.9, 'Bundle-Preis');
  assertEqual(bundle.bvFoerderung, 104.9, 'Bundle BV-Förderung');

  const komp = result.artikel[1];
  assertEqual(komp.einzelpreis, 0, 'Bundlekomponente hat keinen Preis');
  assertEqual(komp.menge, 1, 'Bundlekomponente: Menge 1');

  const fleece = result.artikel[2];
  assertEqual(fleece.variante, 'M', 'Größe in Beschreibungsmitte per Fallback erkannt');
  assertEqual(fleece.einzelpreis, 57.9, 'Fleece-Preis korrekt');
});

test('parseVerkaufsrechnung ignoriert VPE-Zahlen in Beschreibung (kein false-positive menge)', () => {
  const text = `57406909 DLRG Kugelschreiber gelb/rot VPE 50 1 29,90 29,90 A\nStück\n`;
  const result = parseVerkaufsrechnung(text);
  assertEqual(result.artikel[0]?.menge, 1, 'Menge ist 1, nicht 50');
  assertEqual(result.artikel[0]?.einzelpreis, 29.9, 'Preis korrekt');
  assert(!result.artikel[0]?.name?.includes('Stück'), '"Stück"-Einheit darf nicht in Beschreibung landen');
});

test('auditAktion schreibt append-only auf Remote und cached lokal', async () => {
  const storage = createMemoryStorage();
  let remoteLog = [];
  const client = {
    async head() {
      return remoteLog.length
        ? { ok: true, etag: '"audit-1"' }
        : { ok: false, missing: true, error: 'Datei nicht gefunden.' };
    },
    async readJson() {
      return { ok: true, data: remoteLog };
    },
    async writeJson(path, data, opts) {
      assertEqual(path, '/LifeguardOrders/audit.log.json', 'Audit muss unter audit.log.json liegen');
      if (!remoteLog.length) {
        assertEqual(opts.ifNoneMatch, '*', 'Erster Audit-Write muss exklusiv anlegen');
      } else {
        assertEqual(opts.ifMatch, '"audit-1"', 'Folge-Write muss ETag absichern');
      }
      remoteLog = data;
      return { ok: true, etag: '"audit-1"' };
    },
  };

  const first = await auditAktion({
    client,
    user: { id: 'martin' },
    action: 'TEST',
    scope: 'bestellungen',
    entityId: 'b1',
    summary: 'Testeintrag',
    changes: { status: 'neu' },
    storage,
  });
  assert(first.ok, 'Erster Audit-Eintrag muss erfolgreich sein');

  const second = await auditAktion({
    client,
    user: { id: 'martin' },
    action: 'TEST_2',
    scope: 'bestellungen',
    entityId: 'b2',
    summary: 'Folgeeintrag',
    changes: { status: 'offen' },
    storage,
  });
  assert(second.ok, 'Zweiter Audit-Eintrag muss erfolgreich sein');
  assertEqual(remoteLog.length, 2, 'Remote-Log muss append-only wachsen');
  assertEqual(storage.load('lo_audit_log').length, 2, 'Lokaler Cache muss mitgezogen werden');
});

function createMemoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    load(key) {
      const value = map.get(key);
      return value == null ? null : JSON.parse(JSON.stringify(value));
    },
    save(key, value) {
      map.set(key, JSON.parse(JSON.stringify(value)));
    },
  };
}

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
