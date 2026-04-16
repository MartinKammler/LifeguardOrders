# Sprint 05: Kassenwart-Übersicht & Einsatzstunden-Dashboard ✅ ABGESCHLOSSEN

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
//   - userId/user_id oder fallback nutzer-Name → Mitglied
//   - unbekannte Nutzernamen → unbekannt[]

// verechneSchuld(mitgliedId, bestellungen[], geleisteteStunden)
//   - iteriert chronologisch
//   - tilgt älteste Schuld zuerst
//   - Frist kommt aus der ältesten noch offenen Schuld

// ampelStatus(restSchuld, frist, heute) → 'gruen' | 'gelb' | 'rot'
//   - gruen: restSchuld === 0
//   - gelb: restSchuld > 0 und frist in der Zukunft
//   - rot: restSchuld > 0 und frist überschritten
```

---

## Acceptance Criteria

**Kassenwart:**
- [x] Tabelle: Mitglied, Artikel, Bruttobetrag, BV, LV, OG, Mitgliedsanteil, Zahlungsstatus
- [x] Summenzeilen: BV-Gesamt, LV-Gesamt, OG-Gesamt, Mitglieder-Gesamt, offen/bezahlt
- [x] Historische Förderwerte bleiben stabil über gespeicherte Positions-Snapshots
- [x] `ogKostenlos` wird konsistent als 0 € Mitglied / Rest OG ausgewertet
- [x] Filter nach Kalenderjahr
- [x] CSV-Export (für Excel)
- [x] PDF-Export

**Dashboard:**
- [x] Alle `lgc_*.json` aus `/LifeguardClock/` beim Öffnen automatisch einlesen
- [x] Stunden je Mitglied korrekt summiert (nur erlaubte Typen)
- [x] Matching über `userId`/`user_id` oder fallback `nutzer`-Vollname
- [x] Offene Stundenschuld berechnet (OG-Betrag € ÷ 10 × 3)
- [x] Frist: 31.12. Bestelljahr + 1 Kulanzjahr
- [x] Maßgebliche Frist = älteste noch offene Schuld
- [x] Ampel grün/gelb/rot je Mitglied
- [x] Mitglieder ohne OG-Förderung ausblendbar
- [x] Unbekannte Nutzernamen markiert

---

## Ergebnis

| Modul/Seite | Status | Tests |
|---|---|---|
| `src/stunden.js` | ✅ | bestehen + Node-Regressionen |
| `src/kassenwart.js` | ✅ | Node-Regressionen |
| `kassenwart.html` | ✅ | manuell + Modul-Regressionen |
| `dashboard.html` | ✅ | manuell |
