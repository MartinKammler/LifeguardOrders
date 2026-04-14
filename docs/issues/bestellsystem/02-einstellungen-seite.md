# Issue 02: Einstellungen-Seite

## Goal
Admin kann OG-Stammdaten und Nextcloud-Zugangsdaten eingeben, speichern und einen
Verbindungstest ausführen. Die Einstellungen landen in `einstellungen.json` auf der Nextcloud
und werden im `localStorage` gecacht.

## User Stories Addressed
- Story 1 (Ersteinrichtung OG-Daten)
- Story 2 (Nextcloud-Zugangsdaten)
- Story 4 (Verbindungstest)
- Story 51–54 (Einstellungen pflegen)
- Story 55 (localStorage-Cache)

## What to Build
- `einstellungen.html` + `einstellungen-app.js`
- Formular mit Feldern: NC-URL, NC-User, NC-Passwort, OG-Name, Landesverband, Bezirk,
  Adresse, PLZ, Ort, E-Mail, Website, IBAN, BIC, Bank, Amtsgericht, Steuernr.,
  Vorstand 1, Vorstand 2, Finanzen
- Button "Verbindung testen" — ruft `webdav.testConnection()` auf, zeigt Ergebnis
- Button "Speichern" — schreibt `einstellungen.json` via `webdav.writeJson()`
- Beim Laden: erst `localStorage`, dann `webdav.readJson()` (Fallback)
- Vorausgefüllte OG-Schellbronn-Defaults für schnellen Start

## Acceptance Criteria
- Formular lädt gespeicherte Werte beim Öffnen
- Verbindungstest zeigt grünes Häkchen oder rote Fehlermeldung
- Nach Speichern existiert `einstellungen.json` auf Nextcloud mit korrektem Inhalt
- `localStorage`-Fallback funktioniert wenn Nextcloud nicht erreichbar

## Blocked By
- Issue 01 (WebDAV-Client)

## TDD Entry Point
```js
// tests/unit.js
// teste ladeEinstellungen(): wenn localStorage leer und NC gibt JSON zurück → korrektes Objekt
// teste ladeEinstellungen(): wenn NC nicht erreichbar → Werte aus localStorage
// teste speichereEinstellungen(daten): ruft webdav.writeJson mit korrektem Pfad auf
```

## Notes / Risks
- NC-Passwort im localStorage speichern ist akzeptabel für Single-User-Lokal-App
- Vorausgefüllte Defaults (OG-Schellbronn-Daten) beschleunigen Ersteinrichtung
