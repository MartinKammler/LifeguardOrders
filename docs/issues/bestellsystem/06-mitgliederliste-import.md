# Issue 06: Mitgliederliste aus Stempeluhr importieren

## Goal
Admin kann die Mitgliederliste aus der Stempeluhr-`config.js` einmalig in die
`einstellungen.json` übertragen, damit beide Apps dieselbe Personenliste teilen.

## User Stories Addressed
- Story 3 (Mitgliederliste importieren)
- Story 30 (Single Source of Truth mit Stempeluhr)

## What to Build
- Abschnitt "Mitglieder" auf `einstellungen.html`
- Textarea zum Einfügen der `defaultUsers`-Array aus `config.js`
- Button "Importieren" → parst den Array, extrahiert `id` und `name`, speichert in
  `einstellungen.json` unter `mitglieder: [{ id, name }]`
- Anzeige der aktuellen Mitgliederliste (Name, ID) mit Anzahl
- Hinweis: "Mitglieder werden nicht mit der Stempeluhr synchronisiert — bei Änderungen
  erneut importieren"

## Acceptance Criteria
- Nach Import: `einstellungen.json.mitglieder` enthält alle 20 Mitglieder aus `config.js`
- Nur `id` und `name` werden übernommen (keine PINs!)
- Mitgliederliste wird auf anderen Seiten (Dropdowns) korrekt befüllt
- Erneuter Import überschreibt die bestehende Liste (kein Merge)

## Blocked By
- Issue 02 (Einstellungen-Seite)

## TDD Entry Point
```js
// tests/unit.js
// teste parseMitglieder(configJsText): extrahiert korrekt id und name aus defaultUsers-Array
// teste parseMitglieder(configJsText): enthält keine pin-Felder im Ergebnis
// teste parseMitglieder(ungueltigerText): gibt leeres Array + Fehlermeldung zurück
```

## Notes / Risks
- Der Input ist JavaScript-Quellcode (kein JSON) — Parser muss mit `Function()` oder Regex
  arbeiten. Sicherster Ansatz: User kopiert nur den Array-Inhalt, App wrapped ihn in `[...]`
  und nutzt `JSON.parse` nach Normalisierung (einfache Anführungszeichen → doppelte).
- PINs dürfen auf keinen Fall in `einstellungen.json` gespeichert werden.
