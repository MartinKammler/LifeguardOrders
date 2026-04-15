# Sprint 02: Sammelbestellung — Sammlung & CSV-Export ✅ ABGESCHLOSSEN

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

- [x] Neue Sammelbestellung mit Datum + Bezeichnung anlegen
- [x] Wunschzeile: Mitglied (Dropdown), Artikel aus Katalog (mit Variante), Menge
- [x] Mehrere Wünsche für verschiedene Mitglieder/Artikel in einer Bestellung
- [x] Aggregierte Tabelle: Artikel+Variante | Menge gesamt | Mitglieder (Namen)
- [x] "CSV kopieren" → Clipboard-Inhalt `18507110,XL,3` pro Zeile
- [x] Wünsche nachträglich bearbeiten/löschen (solange Status "sammlung")
- [x] `bestellungen.html` zeigt Phase ("Sammlung" / "Abgleich" / "Abgeschlossen") + Wunschanzahl
- [x] Gespeichert in `lo_bestellungen` + Nextcloud

---

## Risks

- **Artikel-Suche:** Katalog kann viele Einträge haben — Suche/Filter im Artikel-Dropdown nötig
- **Leerer Katalog:** Wenn noch keine Artikel importiert, Hinweis zeigen mit Link zu artikel.html
- **NC-Sync:** localStorage-Daten dürfen nie durch leeres NC-Ergebnis überschrieben werden
  (Fix bereits in PRD dokumentiert)

---

## Ergebnis

| Modul/Seite | Status | Tests |
|---|---|---|
| `src/sammlung.js` | ✅ | bestehen |
| `bestellungen.html` | ✅ | manuell |
| `bestellung-sammeln.html` | ✅ | manuell |
| `bestellung-neu.html` | ✅ | manuell |

## Nachträgliche Erweiterungen

- `bestellung-neu.html` als eigene Seite zum Anlegen einer neuen Sammelbestellung (war nicht explizit geplant)
- "Bestellung wieder öffnen" in `bestellungen.html`: setzt Status zurück auf "sammlung", löscht positionen + rechnungen
