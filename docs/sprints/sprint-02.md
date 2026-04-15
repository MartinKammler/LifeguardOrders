# Sprint 02: Sammelbestellung — Sammlung & CSV-Export

## Sprint Goal

Admin kann eine Sammelbestellung anlegen, Mitgliederwünsche (Artikel + Variante + Menge)
erfassen, die aggregierte Bestellmenge sehen und eine fertige CSV-Liste für das
Materialstelle-Bestellformular kopieren.

---

## In Scope

| # | Was | Typ | Blocked By |
|---|---|---|---|
| A | Datenmodell `bestellungen.json` (wuensche[], status) | AFK | — |
| B | Logik: `erstelleWunsch`, `aggregiereWuensche`, `exportiereCSV` | AFK | A |
| C | `bestellungen.html` — Übersicht mit Phase/Status angepasst | HITL | A |
| D | `bestellung-sammeln.html` — Wünsche erfassen + CSV-Export | HITL | B, C |

---

## Execution Order

```
1. A (Datenmodell definieren)
2. B (Logik-Funktionen + Tests)
3. C (Übersicht anpassen)     ← parallel mit D möglich
4. D (Sammelseite bauen)
```

---

## TDD Entry Points

```js
// aggregiereWuensche(wuensche[]) → [{ artikelNr, variante, name, menge }]
//   - summiert Mengen je artikelNr+variante über alle Mitglieder
//   - sortiert nach artikelNr, dann variante

// exportiereCSV(aggregiert[]) → string
//   - Format: "artikelNr,variante,menge\n" pro Zeile
//   - Variante leer → "artikelNr,,menge"

// validiereWunsch(wunsch) → { ok, fehler }
//   - mitgliedId nicht leer
//   - artikelNr nicht leer
//   - menge > 0
```

---

## Acceptance Criteria

- [ ] Neue Sammelbestellung mit Datum + Bezeichnung anlegen
- [ ] Wunschzeile: Mitglied (Dropdown), Artikel aus Katalog (mit Variante), Menge
- [ ] Mehrere Wünsche für verschiedene Mitglieder/Artikel in einer Bestellung
- [ ] Aggregierte Tabelle: Artikel+Variante | Menge gesamt | Mitglieder (Namen)
- [ ] "CSV kopieren" → Clipboard-Inhalt `18507110,XL,3` pro Zeile
- [ ] Wünsche nachträglich bearbeiten/löschen (solange Status "sammlung")
- [ ] `bestellungen.html` zeigt Phase ("Sammlung" / "Abgleich" / "Abgeschlossen") + Wunschanzahl
- [ ] Gespeichert in `lo_bestellungen` + Nextcloud

---

## Risks

- **Artikel-Suche:** Katalog kann viele Einträge haben — Suche/Filter im Artikel-Dropdown nötig
- **Leerer Katalog:** Wenn noch keine Artikel importiert, Hinweis zeigen mit Link zu artikel.html
- **NC-Sync:** localStorage-Daten dürfen nie durch leeres NC-Ergebnis überschrieben werden
  (Fix bereits in PRD dokumentiert)

---

## Done Looks Like

- Sammelbestellung anlegen und Wünsche erfassen funktioniert ohne Fehler
- CSV lässt sich aus einer echten Bestellung erzeugen und in die Materialstelle einfügen
- `bestellungen.html` zeigt alle Bestellungen mit Phase
- Tests für Logik-Funktionen bestehen
