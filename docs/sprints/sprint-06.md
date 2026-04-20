# Sprint 06: Remote-First Sync, Konfliktsperre & App-Login

## Sprint Goal

Die App verhindert stille Überschreibungen, schreibt fachliche Daten nur bei erreichbarer
Nextcloud und bereitet den Mehrnutzerbetrieb über ein App-Login vor.

---

## Produktentscheidungen

- Fachliche Daten werden nur geschrieben, wenn Nextcloud erreichbar ist
- Vor jedem Upload wird der aktuelle Remote-Stand geprüft
- Bei Remote-Abweichung: harte Sperre statt stilles Überschreiben
- App-Login dient zunächst Nutzerzuordnung, Rollensteuerung und Auditierung
- Audit-Log wird append-only auf Remote geführt; lokal nur als Cache

---

## In Scope

| # | Was | Typ | Blocked By |
|---|---|---|---|
| A | `src/webdav.js` — ETag/Remote-Metadaten, robustes XML-Parsing | AFK | Sprint 05 |
| B | `src/sync.js` — Remote-first Write Gate, Konfliktstatus | AFK | A |
| C | Login/Session (`login.html`, `src/auth.js`, `src/session.js`) | HITL | B |
| D | Konflikt-UX statt `alert()`/`confirm()` in kritischen Speicherpfaden | HITL | B |
| E | Remote-Audit-Log für Bestellungen/Rechnungen/Materialbewegungen | AFK | C |

---

## Acceptance Criteria

### Sync & Konflikte

- [x] Bestellungen, Artikel, Materialbestand und Einstellungen werden nur geschrieben, wenn Remote erreichbar ist
- [x] Vor jedem Schreiben wird die aktuelle Remote-Version geprüft
- [x] Bei Remote-Abweichung entsteht ein sichtbarer Konfliktstatus
- [x] Konflikte blockieren das Speichern hart; kein stilles Überschreiben
- [x] Erste Konfliktaktionen sind: `Remote neu laden`, `lokale Kopie exportieren`, `Abbrechen`
- [x] Offline ohne Remote ist lesbar, aber für fachliche Schreibvorgänge gesperrt

### Login & Rollen

- [x] `benutzer.json` definiert aktive Nutzer und Rollen
- [x] App startet mit Login-Seite / Session-Guard
- [x] Rollen sind im UI verfügbar und dem aktuellen Nutzer zugeordnet
- [x] Audit-Einträge referenzieren den angemeldeten Nutzer

### Audit

- [x] Kritische Änderungen landen append-only auf Remote
- [x] Audit-Write-Fehler blockieren abrechnungsrelevante Aktionen
- [x] Lokales Audit ist nur Cache/Fallback, nicht führende Wahrheit

### Robustheit

- [x] `package.json` deklariert ES-Module sauber
- [x] WebDAV-XML-Parsing funktioniert ohne Regex
- [x] Tests decken Konflikterkennung, Remote-Fehler und Login-Grundpfade ab

---

## Nicht-Ziel dieses Sprints

- Kein serverseitiges Auth-Backend
- Kein generischer Merge-Dialog für fachliche Kerndaten
- Keine echte Manipulationssicherheit gegen lokale Administratoren am Gerät
- Keine Vollverschlüsselung des lokalen Browser-Caches

---

## Technische Leitplanken

- `sync.js` kennt nur noch klare Zustände wie `synced`, `conflict`, `offline-readonly`, `auth-required`
- `pending` bleibt höchstens für unkritische oder rein lokale Nebenpfade relevant, nicht für fachliche Kernobjekte
- `writeJson()` nutzt `If-Match` bzw. Remote-Metadaten, um Race Conditions sichtbar zu machen
- Auto-Merge ist nur für append-only Daten wie Audit später erlaubt, nicht für Bestellungen oder Einstellungen

---

## Ergebnis

Abgeschlossen. Offene Hinweise aus Code-Review:
- `'lo_nc_pass'` als Magic String in mehreren HTML-Seiten (nutzt statt `SESSION_KEY_NC_PASS`-Konstante direkte Strings) — technische Schuld, kein Sicherheitsproblem
- FOUC bei Auth-Guard: `type="module"` Scripts sind deferred — kurzer Content-Flash vor Redirect möglich; akzeptiert für Single-Admin-Setup
- Audit-Race-Condition (append-only, 412 ohne Retry) — kein automatischer Retry implementiert; akzeptiert
