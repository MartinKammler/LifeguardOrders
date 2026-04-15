# Sprint 05: Kassenwart-Übersicht & Einsatzstunden-Dashboard

## Sprint Goal

Admin kann dem Kassenwart vollständige Unterlagen liefern (Tabelle + CSV/PDF-Export)
und den Einsatzstunden-Fortschritt je Mitglied mit Ampel-Status sehen.

---

## In Scope

| # | Was | Typ | Blocked By |
|---|---|---|---|
| A | `kassenwart.html` — Tabelle, Summen, Filter, CSV/PDF-Export | HITL | Sprint 04 |
| B | `src/stunden.js` — Stunden-Matching + Schulden-Verrechnung | AFK | Sprint 03 |
| C | `dashboard.html` — Ampel, Stunden, Fristen | HITL | B |

---

## TDD Entry Points

```js
// berechneStunden(logEntries[], einsatztypen[]) → Map<mitgliedId, stunden>
//   - summiert dauer_ms der Stop-Events erlaubter Typen
//   - anwesenheit zählt NICHT
//   - unbekannte Nutzernamen → unbekannt[]

// verechneSchuld(mitgliedId, bestellungen[], geleisteteStunden)
//   - iteriert chronologisch
//   - tilgt älteste Schuld zuerst
//   - gibt restSchuld und ampel zurück

// ampelStatus(restSchuld, frist, heute) → 'gruen' | 'gelb' | 'rot'
//   - gruen: restSchuld === 0
//   - gelb: restSchuld > 0 und frist in der Zukunft
//   - rot: restSchuld > 0 und frist überschritten
```

---

## Acceptance Criteria

**Kassenwart:**
- [ ] Tabelle: Mitglied, Artikel, Bruttobetrag, BV, LV, OG, Mitgliedsanteil, Zahlungsstatus
- [ ] Summenzeilen: BV-Gesamt, LV-Gesamt, OG-Gesamt, Mitglieder-Gesamt, offen/bezahlt
- [ ] Filter nach Kalenderjahr
- [ ] CSV-Export (für Excel)
- [ ] PDF-Export

**Dashboard:**
- [ ] Alle `lgc_*.json` aus `/LifeguardClock/` beim Öffnen automatisch einlesen
- [ ] Stunden je Mitglied korrekt summiert (nur erlaubte Typen)
- [ ] Offene Stundenschuld berechnet (OG-Betrag € ÷ 10 × 3)
- [ ] Frist: 31.12. Bestelljahr + 1 Kulanzjahr
- [ ] Ampel grün/gelb/rot je Mitglied
- [ ] Mitglieder ohne OG-Förderung ausblendbar
- [ ] Unbekannte Nutzernamen markiert

---

## Done Looks Like

- Kassenwart-CSV mit echten Daten erzeugen und in Excel öffnen
- Dashboard zeigt Ampel-Status für alle Mitglieder mit OG-Schulden
- Tests für Stunden-Matching und Schulden-Verrechnung bestehen
