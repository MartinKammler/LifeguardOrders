# Issue 12: Kassenwart-Übersicht & Export

## Goal
Admin kann eine vollständige Kassenwart-Übersicht aller Bestellungen mit Summenzeilen
als PDF oder CSV exportieren.

## User Stories Addressed
- Story 40–45 (Kassenwart-Übersicht)

## What to Build
- `kassenwart.html` + `kassenwart-app.js`
- Tabelle: Mitglied | Artikel | Bruttobetrag | BV | LV | OG | Mitglied | Status
- Summenzeilen: BV-Gesamt, LV-Gesamt, OG-Gesamt, Mitglieder-Gesamt, davon offen/bezahlt
- Filter: Kalenderjahr-Dropdown
- Button "PDF exportieren" (via jsPDF, Querformat)
- Button "CSV exportieren" (Download als .csv, Semikolon-getrennt, Excel-kompatibel)
- Berechnung aus gespeicherten Positions-Snapshots; der Live-Katalog ist nur Fallback für Altbestände
- `ogKostenlos` muss in OG-/Mitgliedsanteil einfließen

## Acceptance Criteria
- Alle Positionen aller Sammelbestellungen erscheinen in der Tabelle
- Summen korrekt berechnet
- Nachträgliche Änderungen am Artikelkatalog verfälschen alte Bestellungen nicht
- Wünsche mit `ogKostenlos` zeigen 0 € Mitgliedsanteil und den Rest korrekt als OG-Anteil
- Jahresfilter begrenzt die Anzeige korrekt
- CSV öffnet sich korrekt in Excel (UTF-8 BOM für deutsche Sonderzeichen)

## Blocked By
- Issue 11

## TDD Entry Point
```js
// teste aggregiereKassenwart(bestellungen): korrekte Summe je Fördertopf
// teste aggregiereKassenwart(bestellungen): verwendet Positions-Snapshot vor Live-Katalog
// teste aggregiereKassenwart(bestellungen): ogKostenlos → Mitgliedsanteil 0, OG-Anteil steigt
// teste exportiereCsv(zeilen): korrekte CSV-Formatierung mit Semikolon-Trennung
```

## Notes / Risks
- CSV: UTF-8 BOM (`\uFEFF`) am Anfang für korrekte Excel-Anzeige von Umlauten
