# Issue 05: Artikel-Import-UI (Copy-Paste in Katalog)

## Goal
Admin kann Text aus einer Materialstelle-Auftragsbestätigung per Copy-Paste in ein Textfeld
einfügen, eine Vorschau der erkannten Artikel prüfen und sie in den Katalog übernehmen.

## User Stories Addressed
- Story 1 (Copy-Paste-Import)
- Story 2 (Importierte Artikel bearbeiten vor Speichern)
- Story 10 (Vorschau + Korrektur nach Import)

## What to Build
- Import-Bereich auf `artikel.html` (Button "Aus Materialstelle importieren" → Panel/Modal)
- Textarea für Rohtexteingabe
- Button "Parsen" → ruft `parseBestellung(text)` auf, zeigt Ergebnis als editierbare Tabelle
- Vorschau-Tabelle: je erkannter Artikel eine Zeile, alle Felder editierbar
- Fehler-Bereich: falls `parser.fehler.length > 0`, werden unerkannte Zeilen angezeigt
- Button "In Katalog übernehmen" → fügt geparste Artikel zur bestehenden `artikel.json` hinzu
- Duplikat-Check: Artikel-Nr. bereits vorhanden → Warnung, kein automatisches Überschreiben

## Acceptance Criteria
- Eingabe → Parse → Vorschau funktioniert ohne Seitenreload
- Fehlerhaft erkannte Zeilen erscheinen als Warnhinweis, blockieren nicht den Rest
- Nach "Übernehmen" sind neue Artikel in der Katalogliste sichtbar
- Artikel mit gleicher Artikel-Nr. erzeugen eine Warnung (kein blindes Überschreiben)
- VERSANDKOSTEN/EILAUFTRAG erscheinen nicht in der Vorschau (werden ignoriert)

## Blocked By
- Issue 03 (Import-Parser)
- Issue 04 (Artikelkatalog-Seite)

## TDD Entry Point
```js
// tests/unit.js
// teste fuegeArtikelHinzu(katalog, neueArtikel): keine Duplikate (gleiche artikelNr)
// teste fuegeArtikelHinzu(katalog, neueArtikel): neue Artikel erhalten UUID
// teste fuegeArtikelHinzu(katalog, neueArtikel): bestehende Artikel unverändert
```

## Notes / Risks
- Reihenfolge der Felder in der Vorschau-Tabelle beeinflusst Usability stark
  → wichtigste Felder zuerst: Name, Einzelpreis, BV, LV, OG
