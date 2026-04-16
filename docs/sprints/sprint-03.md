# Sprint 03: Sammelbestellung — Eingang & Abgleich ✅ ABGESCHLOSSEN

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

// bauePositionenAusAbgleich(abgleichResult, wuensche, artikelListe, aufloesungen)
//   - Mengenabweichung nur bei Aktion 'uebernehmen' in finale Positionen übernehmen
//   - Aktion 'ignorieren' dokumentiert Review, erzeugt aber keine Positionszeile
```

---

## Acceptance Criteria

- [x] Rechnungstext einfügen → Parser liefert Positionen (gleicher Parser wie Artikelimport)
- [x] Automatischer Match nach artikelNr + variante
- [x] Gematchte Positionen grün markiert, Mitglied daneben sichtbar
- [x] Abweichungen rot/gelb markiert mit Typ-Hinweis
- [x] Abweichung auflösen: Menge bewusst übernehmen oder ignorieren; Ignorieren bucht nichts in finale Positionen
- [x] OG-Kosten (Versand, Eilauftrag) sichtbar, aber nicht zuweisbar
- [x] Bestellung auf "abgeschlossen" setzen möglich wenn alle Positionen aufgelöst
- [x] Gespeichert in `lo_bestellungen` + Nextcloud

---

## Ergebnis

| Modul/Seite | Status | Tests |
|---|---|---|
| `src/abgleich.js` | ✅ | bestehen |
| `bestellung-abgleich.html` | ✅ | manuell |

## Nachträgliche Erweiterungen

- **"Wünsche direkt übernehmen"** in `bestellung-abgleich.html`: Für Artikel ohne externe Rechnung (z.B. Lehrgänge) synthetisiert der Button Abgleich-Ergebnis direkt aus den Wünschen → sofortiges Abschließen ohne Datei-Import möglich.
- **"Bestellung wieder öffnen"** (amber) im Rechnungen-Card: setzt Status zurück auf "bestellt".
- **Explizite Auflösungssemantik bei Mengenabweichungen:** `uebernehmen` erzeugt Positions-Snapshot, `ignorieren` markiert nur den Review-Entscheid.
