# Sprint 04: Rechnungen & Zahlungsverfolgung

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

- [ ] PDF entspricht Layout der Vorlage `R_2025_07_001_Kammler.pdf`
- [ ] OG-Adresse, Empfänger, Positionstabelle, Gesamtbetrag, Bankdaten im PDF
- [ ] Rechnung zeigt Mitgliedsanteil (nach Förderabzug) + erwartete Stunden für OG-Anteil
- [ ] Rechnungsnummern lückenlos fortlaufend pro Monat
- [ ] `rechnungen.html`: alle Rechnungen mit Nummer, Mitglied, Betrag, Status
- [ ] Rechnung als "bezahlt" markieren mit Zahlungsdatum
- [ ] Zahlung rückgängig machen möglich
- [ ] Offener Gesamtbetrag in der Übersicht sichtbar
- [ ] Bereits erzeugte Rechnung erneut als PDF abrufbar

---

## Done Looks Like

- Echte Rechnung für ein Mitglied erzeugen, PDF sieht aus wie die Vorlage
- Zahlungsstatus setzen und in Übersicht sehen
