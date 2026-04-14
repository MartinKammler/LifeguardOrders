# Issue 04: Artikelkatalog-Seite (Anzeige + CRUD)

## Goal
Admin sieht alle Artikel aus `artikel.json` in einer Liste und kann einzelne Artikel
manuell anlegen, bearbeiten und löschen.

## User Stories Addressed
- Story 3 (Artikel manuell anlegen)
- Story 5 (Varianten als separate Einträge)
- Story 12 (Artikel bearbeiten/löschen)
- Story 13 (Artikel bearbeiten und löschen)
- Story 14 (Leerhinweis)

## What to Build
- `artikel.html` + `artikel-app.js`
- Liste aller Artikel: Artikel-Nr., Name, Einzelpreis (brutto), BV-Förderung, LV-Förderung,
  OG-Förderung / "übernimmt Rest", Bearbeiten- und Löschen-Button
- Formular (Modal oder Inline) zum Anlegen/Bearbeiten eines Artikels:
  - Felder: Artikel-Nr., Name, Einzelpreis, Netto, BV-Förderung, LV-Förderung,
    OG-Förderung (€) oder Checkbox "OG übernimmt Rest"
- Löschen mit Bestätigungsdialog
- Leerhinweis wenn `artikel.json` leer oder nicht vorhanden
- Speichern schreibt `artikel.json` komplett via `webdav.writeJson()`

## Acceptance Criteria
- Artikel aus NC werden beim Laden der Seite angezeigt
- Neuer Artikel erscheint nach Speichern in der Liste
- Bearbeitung aktualisiert bestehenden Eintrag (gleiche UUID)
- Löschen entfernt Eintrag aus Liste und NC
- Bei leerem Katalog: Hinweistext mit Link zum Import
- Checkbox "OG übernimmt Rest" deaktiviert das OG-€-Eingabefeld

## Blocked By
- Issue 01 (WebDAV-Client)

## TDD Entry Point
```js
// tests/unit.js
// teste speichereArtikel(liste, neuerArtikel): gibt Liste mit neuem Eintrag zurück (UUID gesetzt)
// teste loescheArtikel(liste, id): gibt Liste ohne Eintrag zurück
// teste aktualisiereArtikel(liste, geaendert): gibt Liste mit aktualisiertem Eintrag zurück
```

## Notes / Risks
- UUID-Generierung: `crypto.randomUUID()` (in allen modernen Browsern verfügbar)
- Beim Löschen prüfen: Artikel der in einer offenen Bestellung verwendet wird, sollte
  nicht gelöscht werden (Warnung anzeigen) — MVP kann das per Hinweis lösen
