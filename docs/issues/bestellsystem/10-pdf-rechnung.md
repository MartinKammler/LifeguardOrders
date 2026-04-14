# Issue 10: PDF-Rechnung erzeugen

## Goal
Admin kann für jedes zugewiesene Mitglied einer Sammelbestellung eine Rechnung als PDF
im Layout der bestehenden OG-Rechnungen herunterladen.

## User Stories Addressed
- Story 25–31 (Rechnungen)

## What to Build
- `pdf.js` mit `erzeugeRechnung(einstellungen, mitglied, positionen, rechnungsnummer, datum)`
  → erzeugt jsPDF-Dokument und triggert Download
- Layout exakt nach Vorlage `R_2025_07_001_Kammler.pdf`:
  - DLRG-Logo + OG-Block rechts oben
  - Empfängeradresse links (Briefenster)
  - Rechnungsnummer + Datum
  - Tabelle: Anzahl | Bezeichnung | Einzelpreis | Gesamtpreis
  - Gesamtbetrag (Brutto)
  - MwSt.-Hinweis, Zahlungsfrist, Bankdaten, Rechtsangaben
- `rechnungen.html` + `rechnungen-app.js` — Übersicht + "PDF herunterladen"-Button

## Acceptance Criteria
- PDF-Download startet im Browser
- Layout stimmt mit Vorlage überein (Logo, Tabelle, Fußzeile)
- Rechnungsnummer folgt Format `R_YYYY_MM_NNN`, fortlaufend
- Bereits erzeugte Rechnung kann erneut heruntergeladen werden
- Auf der Rechnung erscheint nur der Mitgliedsanteil (nach Förderabzug)

## Blocked By
- Issue 07 (Rechnungsnummerierung in `berechnung.js`)
- Issue 09 (Zuweisungen vorhanden)

## TDD Entry Point
```js
// teste naechsteRechnungsnummer([], new Date('2025-07-01')): → 'R_2025_07_001'
// teste naechsteRechnungsnummer([{nummer:'R_2025_07_003'}], new Date('2025-07-01')): → 'R_2025_07_004'
// teste naechsteRechnungsnummer([{nummer:'R_2025_06_005'}], new Date('2025-07-01')): → 'R_2025_07_001'
```

## Notes / Risks
- jsPDF muss als Bibliothek eingebunden werden (CDN oder lokal)
- DLRG-Logo als Base64 in `pdf.js` einbetten für PDF-Einbettung
- Testen des PDF-Layouts visuell (Screenshot-Vergleich) — kein Unit-Test möglich
