# Issue 11: Zahlungsverfolgung

## Goal
Admin kann Rechnungen als bezahlt markieren und sieht alle offenen Rechnungen auf einen Blick.

## User Stories Addressed
- Story 32–36 (Zahlungsverfolgung)

## What to Build
- Rechnungsübersicht auf `rechnungen.html`:
  - Tabelle: Mitglied, Rechnungsnummer, Betrag, Datum, Status (offen/bezahlt)
  - Filter: alle / offen / bezahlt, nach Mitglied
  - "Als bezahlt markieren"-Button + Datumsfeld
  - "Zurück auf offen"-Link
  - Offener Gesamtbetrag als Summe sichtbar

## Acceptance Criteria
- Offene Rechnungen sind sofort erkennbar (z.B. fett/farbig)
- Bezahlt-Markierung mit Datum wird in `bestellungen.json` gespeichert
- Filter funktioniert ohne Seitenreload
- Offener Gesamtbetrag wird live aktualisiert

## Blocked By
- Issue 10

## TDD Entry Point
```js
// teste markiereBezahlt(rechnungen, id, datum): setzt bezahlt=true, bezahltDatum korrekt
// teste berechneOffenerBetrag(rechnungen): summiert nur unbezahlte Rechnungen
// teste filterRechnungen(rechnungen, { status: 'offen' }): gibt nur offene zurück
```

## Notes / Risks
Keine.
