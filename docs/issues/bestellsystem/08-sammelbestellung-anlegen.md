# Issue 08: Sammelbestellung anlegen & Positionen importieren

## Goal
Admin kann eine neue Sammelbestellung mit Datum und Bezeichnung anlegen und Positionen aus
einer Materialstelle-Auftragsbestätigung importieren.

## User Stories Addressed
- Story 15 (Sammelbestellung anlegen)
- Story 16 (Positionen importieren)
- Story 21 (Versandkosten als OG-Kosten)
- Story 23 (mehrere offene Bestellungen)

## What to Build
- `bestellungen.html` + `bestellungen-app.js` — Übersicht aller Sammelbestellungen
- `bestellung-neu.html` + `bestellung-neu-app.js` — Formular + Import-Workflow:
  1. Datum und Bezeichnung eingeben
  2. Materialliste importieren (gleiche Parser-UI wie Artikel-Import)
  3. Positionen werden als `positionen[]` in `bestellungen.json` gespeichert
  4. OG-Kostenposten erscheinen markiert (grau/kursiv), nicht als normale Position

## Acceptance Criteria
- Neue Bestellung erscheint in Übersicht mit Status "offen"
- Importierte Positionen (inkl. berechneter Förderanteile) in `bestellungen.json` gespeichert
- VERSANDKOSTEN als `typ: "og-kosten"` gespeichert, sichtbar aber nicht zuweisbar
- Mehrere Bestellungen gleichzeitig offen möglich

## Blocked By
- Issue 01, Issue 03, Issue 07

## TDD Entry Point
```js
// teste erstelleSammelbestellung(datum, bezeichnung, positionen): korrekte Struktur mit UUID
// teste istOgKosten(artikelNr): true für VERSANDKOSTEN, EILAUFTRAG; false für normale Artikel
```

## Notes / Risks
Keine.
