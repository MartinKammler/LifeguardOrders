# Issue 13: Einsatzstunden-Dashboard

## Goal
Das Dashboard liest automatisch alle LifeguardClock-JSONs von Nextcloud, berechnet
Stundenschulden je Mitglied und zeigt den Abarbeitungsstatus mit Ampel.

## User Stories Addressed
- Story 46–55 (Einsatzstunden-Dashboard)

## What to Build
- `stundenberechnung.js` mit:
  - `berechneStunden(logEntries[], einsatztypen[])` → `Map<name, stunden>`
  - `verechneSchuld(mitgliedId, bestellungen[], geleisteteStunden)` → `[{ bestellungId, schuld, geleistet, rest, frist, status }]`
  - `ampelStatus(schuld, frist, heute)` → `"gruen" | "gelb" | "rot"`
- `dashboard.html` + `dashboard-app.js`:
  - Beim Laden: `webdav.listFiles('/LifeguardClock/')` + alle JSONs einlesen
  - Tabelle je Mitglied: Stunden geleistet | Stunden benötigt | Differenz | Frist | Ampel
  - Detail-Ansicht je Bestellung klappbar
  - Filter: "Nur mit Schulden anzeigen"
  - Unbekannte Nutzernamen in separatem Warnblock

## Acceptance Criteria
- Beim Öffnen werden alle lgc_*.json automatisch eingelesen (kein manueller Import)
- `anwesenheit`-Einträge werden nicht gezählt
- Schuld korrekt: 3h pro 10€ OG-Förderung
- Frist: 31.12. Bestelljahr + 1 Jahr
- Chronologische Tilgung: älteste Schuld zuerst
- Die angezeigte Frist stammt von der ältesten noch offenen Schuld
- Ampel: grün (abgearbeitet), gelb (Frist läuft noch), rot (Frist überschritten, Schuld offen)
- Matching erfolgt über `userId`/`user_id` oder fallback über normalisierten `nutzer`-Vollnamen
- Unbekannte Namen werden angezeigt

## Blocked By
- Issue 01, Issue 09

## TDD Entry Point
```js
// berechneStunden mit anwesenheit-Einträgen: anwesenheit wird nicht gezählt
// berechneStunden mit nutzer-Name: wird per Normalisierung einem Mitglied zugeordnet
// verechneSchuld: älteste Bestellung zuerst tilgen
// fristDerAeltestenOffenenSchuld: ignoriert vollständig getilgte Alt-Schulden
// ampelStatus: rot wenn Frist < heute und rest > 0
// ampelStatus: gelb wenn Frist >= heute und rest > 0
// ampelStatus: grün wenn rest <= 0
```

## Notes / Risks
- Viele JSON-Dateien können das Laden verlangsamen → parallele Fetches (Promise.all)
- Matching nutzer-Name → Mitglied-ID: Groß/Kleinschreibung und Whitespace normalisieren
