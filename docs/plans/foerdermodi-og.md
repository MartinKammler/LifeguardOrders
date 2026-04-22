# Plan: Getrennte OG-Foerdermodi

**Status:** umgesetzt

## Ziel

Das bestehende Bool-Feld `ogKostenlos` ist fachlich zu grob. Künftig soll das
System zwischen drei Kostenmodi unterscheiden:

- `normal`
- `og_mit_stunden`
- `og_ohne_gegenleistung`

Damit werden stundengebundene OG-Förderung und echter OG-Zuschuss sauber
getrennt, ohne Altbestände unbrauchbar zu machen.

## Umsetzungsergebnis

- `kostenmodus` ist in den aktiven Schreibpfaden eingeführt.
- Alt-Daten mit `ogKostenlos` bleiben lesbar.
- Kassenwart, PDF, Stunden und Lagerfreigaben unterscheiden sauber zwischen
  `og_mit_stunden` und `og_ohne_gegenleistung`.
- Die UI verwendet Selects statt der früheren Einzel-Checkbox.

## Produktregeln

1. `normal`
- Mitglied zahlt den regulären Restbetrag nach Förderabzug.
- Es entsteht keine zusätzliche Stundenschuld aus einer Vollübernahme.

2. `og_mit_stunden`
- Mitglied zahlt `0 €`.
- OG übernimmt den verbleibenden Restbetrag.
- Es entsteht eine Stundenschuld / `erwartetEinsatzstunden`.

3. `og_ohne_gegenleistung`
- Mitglied zahlt `0 €`.
- OG übernimmt den verbleibenden Restbetrag.
- Es entsteht **keine** Stundenschuld.

## Migration

- Alt-Daten mit `ogKostenlos: true` und ohne `kostenmodus` werden als
  `og_mit_stunden` interpretiert.
- Fehlender Modus sonst als `normal`.
- Neue Schreibpfade schreiben nur noch `kostenmodus`.
- Kompatibilitätsleser für `ogKostenlos` bleiben nur noch als Lesebrücke erhalten.

## Betroffene Bereiche

### Domänenmodell

- `bestellungen.json`
  - `wuensche[].kostenmodus`
  - `positionen[].zuweisung[].kostenmodus`
- `materialanfragen.json`
  - `kostenmodus`

### Berechnung & Ableitungen

- `src/berechnung.js`
- `src/stunden.js`
- `src/pdf.js`
- `src/kassenwart.js`

### Workflow/UI

- `bestellung-sammeln.html`
- `bestellung-abgleich.html`
- `src/materialbestand-app.js`
- `src/materialverkauf.js`

### Merge- und Normalisierungslogik

- `src/sammlung.js`
- `src/abgleich.js`
- `src/materialanfragen.js`

## Umsetzungsphasen

## Phase 1: Kompatibles Domänenmodell

Ziele:
- zentrale Hilfsfunktionen für `kostenmodus`
- Alt-Daten beim Lesen migrieren
- neue Daten nur noch mit `kostenmodus` schreiben

Änderungen:
- Hilfsfunktionen einführen:
  - `normalisiereKostenmodus(...)`
  - `istOgMitStunden(...)`
  - `istOgOhneGegenleistung(...)`
  - `istVollOgUebernahme(...)`
- Loader und Normalisierer kompatibel machen

Akzeptanz:
- Altbestände mit `ogKostenlos` funktionieren unverändert weiter
- neue Objekte haben konsistent `kostenmodus`

## Phase 2: Berechnung, Rechnungen, Stunden

Ziele:
- Rechnungsbetrag und Stundenpflicht sauber trennen

Änderungen:
- `src/berechnung.js`
  - `berechneFoerderung(...)` auf `kostenmodus`
- `src/pdf.js`
  - Stundenhinweise nur bei `og_mit_stunden`
- `src/stunden.js`
  - Stundenschuld nur aus `og_mit_stunden`
- `src/kassenwart.js`
  - getrennte Ausweisung:
    - `OG mit Stunden`
    - `OG ohne Gegenleistung`

Akzeptanz:
- `og_mit_stunden` und `og_ohne_gegenleistung` erzeugen beide `0 €` Mitgliedsanteil
- nur `og_mit_stunden` erzeugt Stundenpflicht

## Phase 3: Sammelbestellung und Anprobe

Ziele:
- UI und Speicherung statt Checkbox auf Kostenmodus umstellen

Änderungen:
- Checkbox `OG übernimmt` durch Select ersetzen:
  - `Normal`
  - `OG übernimmt mit Wachstunden`
  - `OG übernimmt ohne Gegenleistung`
- Teilabschluss-/Rechnungspfad invalidiert sauber, wenn sich der Modus ändert
- Merge in `src/sammlung.js` unterscheidet die beiden OG-Modi

Akzeptanz:
- gleicher Artikel mit verschiedenen Kostenmodi wird nie zusammengelegt
- Moduswechsel erzwingt Neuberechnung und ggf. Rechnungs-Neuerzeugung

## Phase 4: Materialfreigaben und Lagerverkauf

Ziele:
- auch Lagerprozesse nutzen denselben Modus

Änderungen:
- `src/materialanfragen.js`
- `src/materialverkauf.js`
- `src/materialbestand-app.js`

Akzeptanz:
- Materialfreigaben können `normal`, `og_mit_stunden` oder `og_ohne_gegenleistung`
- Förder- und Zuschussfälle bleiben in Audit und Kassenwart getrennt

## Phase 5: Tests und Bereinigung

Ziele:
- Migration absichern
- Alt-Feld `ogKostenlos` aus aktiven Schreibpfaden entfernen

Tests:
- Berechnungsfälle für alle drei Modi
- Kassenwart-Auswertung getrennt
- Stundenpflicht nur für `og_mit_stunden`
- Merge-Verhalten in Sammlung/Anprobe
- Alt-Datenmigration `ogKostenlos -> og_mit_stunden`

## Risiken

1. `ogKostenlos` steckt an vielen Stellen indirekt in Snapshots und Merge-Logik.
2. Rechnungen und Teilabschlüsse müssen bei Moduswechsel zuverlässig invalidiert werden.
3. Kassenwart und Dashboard dürfen Zuschüsse nicht fälschlich als Stundenpflicht werten.

## Non-Goals

- kein neuer Fördertyp außerhalb dieser drei Modi
- keine Änderung am Artikelkatalog-Feld `ogUebernimmtRest`
- keine neue Backend-Architektur
