# Sprint 14 — Getrennte OG-Foerdermodi

**Status:** abgeschlossen

## Motivation

Das bisherige Feld `ogKostenlos` vermischt zwei fachlich unterschiedliche Fälle:

- OG übernimmt gegen Wachstunden
- OG übernimmt ohne Gegenleistung

Beides führt heute meist zu `0 €` Mitgliedsanteil, hat aber unterschiedliche
Folgen für Stundenpflicht, Audit und Kassenwart-Auswertung. Sprint 14 trennt
diese Fälle sauber.

## Ziele

1. `kostenmodus` als neues Domänenfeld einführen:
   - `normal`
   - `og_mit_stunden`
   - `og_ohne_gegenleistung`
2. Alt-Daten mit `ogKostenlos` kompatibel lesen.
3. Berechnung, PDF, Stunden und Kassenwart auf `kostenmodus` umstellen.
4. UI in Sammelbestellung, Anprobe und Lagerfreigaben auf Select statt Checkbox umstellen.
5. Rechnungs-/Teilabschluss-Invalidierung bei Moduswechsel sauber erzwingen.

## Scope

### In Scope

- `src/berechnung.js`
- `src/pdf.js`
- `src/stunden.js`
- `src/kassenwart.js`
- `src/sammlung.js`
- `src/abgleich.js`
- `bestellung-sammeln.html`
- `bestellung-abgleich.html`
- `src/materialanfragen.js`
- `src/materialverkauf.js`
- `src/materialbestand-app.js`
- Tests und Doku

### Out of Scope

- neue Förderarten über diese drei Modi hinaus
- Änderungen am Nextcloud-/Sync-Modell
- größere Umgestaltung des Artikelkatalogs

## Arbeitspakete

1. Kompatibles Datenmodell und Migrationsleser
2. Berechnung + Rechnungslogik
3. Stundenlogik + Dashboard/Kassenwart
4. Sammelbestellung + Anprobe
5. Materialfreigaben
6. Tests + Dokuabschluss

## Erreicht

- Zentrales Domänenmodell `kostenmodus` ist eingeführt:
  - `normal`
  - `og_mit_stunden`
  - `og_ohne_gegenleistung`
- Alt-Bestände mit `ogKostenlos: true` werden kompatibel als `og_mit_stunden` gelesen.
- Aktive Schreibpfade schreiben nur noch `kostenmodus`.
- Berechnung, PDF, Stunden, Kassenwart, Sammelbestellung, Anprobe und Lagerfreigaben
  arbeiten mit dem neuen Modus.
- Moduswechsel invalidiert betroffene Rechnungen und Teilabschlüsse sauber.

## Akzeptanzkriterien

- [x] Alt-Bestellungen mit `ogKostenlos: true` werden als `og_mit_stunden` gelesen.
- [x] Neue Daten schreiben `kostenmodus` statt `ogKostenlos`.
- [x] `og_mit_stunden` erzeugt Stundenpflicht.
- [x] `og_ohne_gegenleistung` erzeugt keine Stundenpflicht.
- [x] Beide OG-Modi werden im Kassenwart getrennt ausgewiesen.
- [x] Moduswechsel invalidiert betroffene Rechnungen und Teilabschlüsse sauber.
- [x] `npm test` bleibt grün.
