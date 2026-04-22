# Sprint 13 — `storageKey`-Cleanup & sync.js Signatur-Bereinigung

**Status:** geplant
**Motivation:** In Sprint 12 wurde sync.js auf eine Remote-required-Architektur
umgestellt. Der `storageKey`-Parameter wird seitdem in `persistJsonWithSync` und
`hydrateJsonFromSync` nicht mehr gelesen, aber von allen Callern weiter
übergeben. Das ist irreführend für spätere Leser (der Name suggeriert, die
Funktionen würden noch in localStorage schreiben).

## Ziele

1. `storageKey` aus der Signatur beider Funktionen entfernen.
2. Alle Call-Sites anpassen (siehe Liste unten).
3. Regressionstests aktualisieren.
4. Prüfen, ob weitere dead parameters oder orphan writes existieren.

## Call-Sites (`storageKey:` als Aufrufparameter)

| Datei                          | Zeile(n)                              |
|--------------------------------|----------------------------------------|
| `src/app-context.js`           | 21                                     |
| `src/artikel-app.js`           | 82, 99                                 |
| `src/einstellungen-app.js`     | 244, 283                               |
| `src/materialbestand-app.js`   | 590, 600, 610, 621, 636, 647, 658, 673, 684, 695, 710, 1133, 1141, 1149, 1157 |
| `bestellung-abgleich.html`     | siehe `git grep "storageKey:"`         |
| `bestellung-neu.html`          | 508, 516                               |
| `bestellung-sammeln.html`      | siehe `git grep "storageKey:"`         |
| `bestellungen.html`            | siehe `git grep "storageKey:"`         |
| `dashboard.html`, `index.html` | siehe `git grep "storageKey:"`         |
| `kassenwart.html`              | siehe `git grep "storageKey:"`         |
| `rechnungen.html`              | siehe `git grep "storageKey:"`         |
| `wuensche.html`                | siehe `git grep "storageKey:"`         |
| `wunsch-queue.html`            | siehe `git grep "storageKey:"`         |

Erwartet: ca. 30–40 Aufrufe über ~15 Dateien.

## Zusätzliche Aufräumarbeiten (im gleichen Sprint)

- **`src/materialbestand-app.js:31`** — `STORAGE_KEY_E` ist deklariert aber
  unbenutzt. Löschen.
- **`src/zugriff.js:54, 66`** — Orphan-Writes auf `STORAGE_KEY_Z`. Entweder
  Read-Path ergänzen oder `storage.save(STORAGE_KEY_Z, …)` + `storage`-Parameter
  entfernen.
- **Einstellungen-App umgeht `ladeRemoteEinstellungen`** — ruft direkt
  `hydrateJsonFromSync`. Harmonisieren oder `NC_PFAD_E`/`SYNC_SCOPE_E` aus
  `app-context.js` importieren.
- **Inline-Pfade** `'/LifeguardOrders/artikel.json'` in `bestellung-neu.html`,
  `wuensche.html`, `wunsch-queue.html` durch Konstanten ersetzen (idealerweise
  zentral in `app-context.js`).

## Non-Goals

- Keine Architektur-Änderungen an der Remote-required-Semantik.
- Keine neuen Features.

## Akzeptanzkriterien

- [ ] `git grep "storageKey"` liefert nur noch Vorkommen in Doku/CHANGELOG.
- [ ] Tests grün (aktuell 53/53).
- [ ] `STORAGE_KEY_E` in `materialbestand-app.js` und `STORAGE_KEY_Z` in
      `zugriff.js` aufgeräumt.
- [ ] Manueller Smoke-Test jeder HTML-Seite (Bootcode bricht nicht).
