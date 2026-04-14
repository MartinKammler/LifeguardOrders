# Issue 01: WebDAV-Client-Modul

## Goal
Ein schlankes `webdav.js`-Modul kapselt alle Nextcloud-Zugriffe. Alle anderen Module sprechen
ausschließlich über dieses Modul mit der Nextcloud — kein direktes `fetch` außerhalb.

## User Stories Addressed
- Story 4 (Verbindungstest)
- Technische Voraussetzung für alle weiteren Issues

## What to Build
- `webdav.js` mit Funktionen:
  - `readJson(path)` → `{ ok, data, error }` — GET + JSON-Parse
  - `writeJson(path, data)` → `{ ok, error }` — PUT mit JSON-Body
  - `listFiles(path)` → `{ ok, files[], error }` — PROPFIND für Dateinamen-Liste
  - `testConnection()` → `{ ok, error }` — PROPFIND auf Root-Verzeichnis
- Credentials werden aus `einstellungen.json` oder `localStorage` gelesen
- Fehler werden als strukturiertes Objekt zurückgegeben, nie als Exception

## Acceptance Criteria
- `readJson('/LifeguardOrders/artikel.json')` liefert geparsten Inhalt oder Fehler-Objekt
- `writeJson('/LifeguardOrders/artikel.json', data)` speichert korrekt auf Nextcloud
- `listFiles('/LifeguardClock/')` liefert Liste aller Dateinamen
- `testConnection()` gibt `{ ok: true }` bei erreichbarer NC, `{ ok: false, error: '...' }` sonst
- Bei HTTP-Fehler (401, 404, 503) enthält `error` einen lesbaren Hinweistext

## Blocked By
Nichts.

## TDD Entry Point
```js
// tests/unit.js
// Mock fetch, teste dass readJson bei 200-Response korrektes Objekt zurückgibt
// Teste dass readJson bei 401 { ok: false, error: 'Authentifizierung fehlgeschlagen' } liefert
// Teste dass writeJson den Body als JSON mit korrektem Content-Type sendet
```

## Notes / Risks
- Nextcloud erwartet Basic-Auth im Authorization-Header
- CORS: App muss vom gleichen Origin wie die Nextcloud laufen oder CORS ist in Nextcloud konfiguriert
- Beim lokalen Entwickeln ggf. proxy nötig
