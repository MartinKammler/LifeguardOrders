# Issue 07: Förderberechnungs-Modul

## Goal
Reine Logik-Funktion `berechneFoerderung(artikel, menge)` berechnet alle Anteile für eine
zugewiesene Position — testbar, ohne DOM und ohne WebDAV.

## User Stories Addressed
- Story 20 (Förderanteile je Zuweisung anzeigen)

## What to Build
- `berechnung.js` mit:
  - `berechneFoerderung(artikel, menge)` → `{ bv, lv, og, mitglied, gesamt }`
  - Bei `ogUebernimmtRest: true`: `og = (einzelpreis − bv − lv) × menge`, kaufmännisch gerundet
  - `naechsteRechnungsnummer(rechnungen[], datum)` → `"R_YYYY_MM_NNN"`

## Acceptance Criteria
- Korrekte Berechnung mit BV+LV+OG-Rest
- Korrekte Berechnung ohne OG-Förderung (og=0)
- Korrekte Berechnung bei Menge > 1
- Rundung auf 2 Dezimalstellen (kaufmännisch)
- Rechnungsnummer zählt ab 001 je Monat, steigt korrekt an

## Blocked By
Nichts (reine Logik).

## TDD Entry Point
```js
berechneFoerderung({ einzelpreis: 69.90, bvFoerderung: 34.90, lvFoerderung: 17.50, ogUebernimmtRest: true }, 1)
// → { bv: 34.90, lv: 17.50, og: 17.50, mitglied: 0, gesamt: 69.90 }

naechsteRechnungsnummer([{ nummer: 'R_2025_07_001' }], new Date('2025-07-15'))
// → 'R_2025_07_002'
```

## Blocked By
Nichts.

## Notes / Risks
- Floating-Point-Ungenauigkeiten bei €-Berechnung: stets auf 2 Stellen runden nach jeder Operation
