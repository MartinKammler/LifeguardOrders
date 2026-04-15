# Sprint 04: Rechnungen & Zahlungsverfolgung ✅ ABGESCHLOSSEN

## Sprint Goal

Admin kann nach dem Abgleich für jedes Mitglied eine PDF-Rechnung im OG-Layout erzeugen,
Zahlungen nachverfolgen und den offenen Gesamtbetrag sehen.

---

## In Scope

| # | Was | Typ | Blocked By |
|---|---|---|---|
| A | `src/pdf.js` — jsPDF-Wrapper, Rechnungs-Layout | AFK | Sprint 03 |
| B | Rechnungsnummer-Logik (bereits in berechnung.js) | AFK | — |
| C | `rechnungen.html` — Übersicht + PDF-Download + Zahlungsstatus | HITL | A, B |
| D | "Rechnungen erzeugen"-Button auf bestellung-abgleich.html | HITL | A |

---

## TDD Entry Points

```js
// naechsteRechnungsnummer(rechnungen[], datum) → "R_YYYY_MM_NNN"
//   - bereits implementiert in berechnung.js ✅

// erstelleRechnungsDaten(mitgliedId, positionen[], einstellungen) → RechnungsObjekt
//   - berechnet Mitgliedsanteil nach Förderabzug
//   - berechnet erwartete Einsatzstunden (ogBetrag / 10 * 3)
//   - setzt Rechnungsnummer, Datum, Fälligkeit
```

---

## Acceptance Criteria

- [x] PDF entspricht Layout der Vorlage `R_2025_07_001_Kammler.pdf`
- [x] OG-Adresse, Empfänger, Positionstabelle, Gesamtbetrag, Bankdaten im PDF
- [x] Rechnung zeigt Mitgliedsanteil (nach Förderabzug) + erwartete Stunden für OG-Anteil
- [x] Rechnungsnummern lückenlos fortlaufend pro Monat
- [x] `rechnungen.html`: alle Rechnungen mit Nummer, Mitglied, Betrag, Status
- [x] Rechnung als "bezahlt" markieren mit Zahlungsdatum
- [x] Zahlung rückgängig machen möglich
- [x] Offener Gesamtbetrag in der Übersicht sichtbar
- [x] Bereits erzeugte Rechnung erneut als PDF abrufbar

---

## Ergebnis

| Modul/Seite | Status | Tests |
|---|---|---|
| `src/pdf.js` | ✅ | manuell |
| `rechnungen.html` | ✅ | manuell |

## Hinweise zur Implementierung

- `erstelleRechnungsDaten()` und `druckePDF()` als separate Funktionen — Daten-Erstellung von PDF-Ausgabe getrennt.
- Zahlungsfrist: 30 Tage ab Rechnungsdatum (nicht 14 wie im PRD skizziert — pragmatische Entscheidung).
- Statistik-Karten oben in `rechnungen.html`: Anzahl Rechnungen, Gesamtbetrag, offener Betrag.
