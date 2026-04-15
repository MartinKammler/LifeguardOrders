# Sprint 03: Sammelbestellung — Eingang & Abgleich

## Sprint Goal

Admin kann nach Lieferung die Materialstelle-Rechnung in eine Sammelbestellung importieren,
den automatischen Abgleich mit den Wünschen sehen und Abweichungen manuell auflösen.

---

## In Scope

| # | Was | Typ | Blocked By |
|---|---|---|---|
| A | Logik: `gleiche_ab(wuensche[], rechnungsPositionen[])` | AFK | Sprint 02 |
| B | `bestellung-abgleich.html` — Rechnungsimport + Abgleich-UI | HITL | A |
| C | Abweichungs-Review: zu viel / zu wenig / nicht bestellt | HITL | A |
| D | Status "bestellt" → "abgeschlossen" setzen | HITL | B |

---

## TDD Entry Points

```js
// gleiche_ab(wuensche[], positionen[]) → { gematch[], abweichungen[] }
//   Match-Schlüssel: artikelNr + variante
//   - exakter Match (Menge gleich) → gematch
//   - Menge weicht ab → abweichung { typ: 'menge', erwartet, geliefert }
//   - Position ohne Wunsch → abweichung { typ: 'nicht_bestellt' }
//   - Wunsch ohne Position → abweichung { typ: 'nicht_geliefert' }

// berechneOgAnteil(position, wunsch) → number
//   OG-Kosten werden der Bestellung zugerechnet, nicht dem Mitglied
```

---

## Acceptance Criteria

- [ ] Rechnungstext einfügen → Parser liefert Positionen (gleicher Parser wie Artikelimport)
- [ ] Automatischer Match nach artikelNr + variante
- [ ] Gematchte Positionen grün markiert, Mitglied daneben sichtbar
- [ ] Abweichungen rot/gelb markiert mit Typ-Hinweis
- [ ] Abweichung auflösen: Menge anpassen, Mitglied neu zuweisen oder ignorieren
- [ ] OG-Kosten (Versand, Eilauftrag) sichtbar, aber nicht zuweisbar
- [ ] Bestellung auf "abgeschlossen" setzen möglich wenn alle Positionen aufgelöst
- [ ] Gespeichert in `lo_bestellungen` + Nextcloud

---

## Done Looks Like

- Echte Materialstelle-Rechnung importieren → automatischer Abgleich funktioniert
- Abweichungen sichtbar und auflösbar
- Tests für Abgleich-Logik bestehen
