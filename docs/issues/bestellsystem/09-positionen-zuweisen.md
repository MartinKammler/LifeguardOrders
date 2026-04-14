# Issue 09: Positionen Mitgliedern zuweisen

## Goal
Admin kann jede Position einer Sammelbestellung einem Mitglied zuordnen. Bei Menge > 1
kann die Position auf mehrere Mitglieder aufgeteilt werden.

## User Stories Addressed
- Story 17 (Position → Mitglied-Dropdown)
- Story 18 (Menge aufteilen)
- Story 19 (nicht zugewiesene Positionen hervorheben)
- Story 20 (Förderanteile je Zuweisung anzeigen)
- Story 24 (Bestellung nachträglich bearbeiten)

## What to Build
- Zuweisungs-UI auf `bestellung-neu.html` (nach Import-Schritt):
  - Je Position: Dropdown "Mitglied" + Menge-Eingabe
  - "+" Button zum Hinzufügen weiterer Mitglieder für dieselbe Position
  - Anzeige: zugewiesene Menge / Gesamtmenge, farblich wenn vollständig
  - Förderanteile (BV/LV/OG/Mitglied) live berechnet und angezeigt
  - Nicht vollständig zugewiesene Positionen: orange Markierung
- Speichern schreibt `zuweisung[]` in die jeweilige Position in `bestellungen.json`

## Acceptance Criteria
- Alle Mitglieder aus Einstellungen erscheinen im Dropdown
- Menge-Zuweisung: Summe der Teilmengen = Gesamtmenge (Validierung)
- Förderberechnung korrekt je Teilmenge
- Nicht vollständig zugewiesene Positionen sind visuell erkennbar
- Änderung der Zuweisung nach erstem Speichern möglich (solange Status "offen")

## Blocked By
- Issue 06, Issue 07, Issue 08

## TDD Entry Point
```js
// teste validiereZuweisung(position, zuweisungen): Fehler wenn Summe ≠ Gesamtmenge
// teste validiereZuweisung(position, zuweisungen): ok wenn Summe = Gesamtmenge
// teste berechneZuweisungsAnteile(artikel, menge): korrekte Förderanteile
```

## Notes / Risks
- UI-Komplexität: Aufspaltung in mehrere Mitglieder erfordert dynamisches Hinzufügen von Zeilen
