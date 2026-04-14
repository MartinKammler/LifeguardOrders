# Issue 03: Import-Parser (Logik-Modul)

## Goal
Eine reine Logik-Funktion `parseBestellung(text)` wandelt den Tab-getrennten Text einer
Materialstelle-Auftragsbestätigung in ein strukturiertes Daten-Array um — ohne DOM, ohne
Netzwerk, vollständig unit-testbar.

## User Stories Addressed
- Story 6 (Copy-Paste-Import)
- Story 7 (Menge-0 überspringen)
- Story 8 (MITTELVERW. BV/LV erkennen)
- Story 9 (VERSANDKOSTEN/EILAUFTRAG als OG-Kosten)

## What to Build
- `parser.js` mit Export-Funktion:
  ```
  parseBestellung(text) → {
    artikel: [{
      artikelNr, name, menge, einzelpreis, netto,
      bvFoerderung, lvFoerderung
    }],
    ogKosten: [{
      name, menge, einzelpreis
    }],
    fehler: [{ zeile, meldung }]
  }
  ```
- Parsing-Regeln:
  - Zeilen mit `MITTELVERW. BV` → BV-Förderung für vorherigen Artikel
  - Zeilen mit `MITTELVERW. LV` → LV-Förderung für vorherigen Artikel
  - Zeilen mit `VERSANDKOSTEN` oder `EILAUFTRAG` → ogKosten[]
  - Artikel mit Menge 0 (inkl. zugehöriger MITTELVERW.-Zeilen) → überspringen
  - Preise: `€`-Zeichen entfernen, Komma → Punkt, parsen
  - Robustheit: extra Whitespace, fehlende Spalten tolerieren

## Acceptance Criteria
- Normaler Import: Artikel mit BV+LV korrekt geparst
- Nur BV (keine LV-Zeile): LV-Förderung = 0, kein Fehler
- Menge 0: Artikel + zugehörige MITTELVERW.-Zeilen nicht in Ergebnis
- VERSANDKOSTEN → ogKosten[], nicht in artikel[]
- Ungültige Zeile → in fehler[], restliche Zeilen werden weiter geparst
- Gleicher Artikel mehrfach (verschiedene Größen) → separate Einträge

## Blocked By
Nichts (reine Logik, kein WebDAV nötig).

## TDD Entry Point
```js
// tests/unit.js — dies ist der Kern-Testblock des gesamten Projekts
assert(parseBestellung(normalerText).artikel.length === 3)
assert(parseBestellung(nurBvText).artikel[0].lvFoerderung === 0)
assert(parseBestellung(menge0Text).artikel.length === 0)
assert(parseBestellung(versandText).ogKosten.length === 1)
assert(parseBestellung(ungueltigeZeile).fehler.length === 1)
```

## Notes / Risks
- Formatvarianten beim Preisformat: `69,90 €`, `69.90`, `-34,90 €` — alle müssen korrekt geparst werden
- Tab-Trennzeichen kann durch Kopieren aus Browser durch mehrere Spaces ersetzt werden — Regex statt split('\t') verwenden
