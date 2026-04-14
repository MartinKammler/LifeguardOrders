# Sprint 01: Fundament & Artikelkatalog

## Sprint Goal

Nach diesem Sprint kann der Admin die App öffnen, Nextcloud-Zugangsdaten hinterlegen,
die Mitgliederliste importieren, den Artikelkatalog aufbauen (manuell und per
Copy-Paste-Import) und hat damit die vollständige Grundlage für alle folgenden Sprints.

Das Ergebnis ist eine lauffähige PWA mit drei funktionierenden Seiten:
Einstellungen, Artikelkatalog und Navigation.

---

## In Scope Issues

| # | Issue | Typ | Blocked By |
|---|---|---|---|
| 01 | WebDAV-Client-Modul | AFK | — |
| 03 | Import-Parser (Logik) | AFK | — |
| 07 | Förderberechnungs-Modul | AFK | — |
| 02 | Einstellungen-Seite | HITL | 01 |
| 06 | Mitgliederliste importieren | HITL | 02 |
| 04 | Artikelkatalog-Seite (CRUD) | HITL | 01 |
| 05 | Artikel-Import-UI | HITL | 03, 04 |

---

## Execution Order

```
1. Issue 01 (WebDAV) + Issue 03 (Parser) + Issue 07 (Berechnung)  ← parallel, kein DOM
2. Issue 02 (Einstellungen)                                         ← braucht 01
3. Issue 06 (Mitgliederliste) + Issue 04 (Artikelkatalog)          ← parallel, beide brauchen 02/01
4. Issue 05 (Artikel-Import-UI)                                     ← braucht 03 + 04
```

---

## Risks

- **CORS auf Nextcloud:** Wenn die App nicht vom gleichen Origin wie die NC läuft, schlagen
  WebDAV-Requests fehl. Lösung: Nextcloud CORS-Header konfigurieren oder App direkt auf NC
  deployen (wie Stempeluhr). Frühzeitig testen.
- **Mitglieder-Parser:** Input ist JavaScript-Quellcode, kein JSON. Robustheit bei
  Sonderzeichen (Umlaute) prüfen.
- **jsPDF:** Wird erst in Sprint 3 gebraucht, aber Bibliothek frühzeitig einbinden und testen,
  ob CDN-Zugriff in der Umgebung funktioniert.

---

## Done Looks Like

- [ ] `tests/unit.js` läuft durch: Parser, Förderberechnung, Rechnungsnummerierung
- [ ] `einstellungen.html`: OG-Daten speicherbar, Verbindungstest grün auf cloud.goddyhome.de
- [ ] Mitgliederliste aus `config.js` importiert, in `einstellungen.json` gespeichert
- [ ] `artikel.html`: Alle Artikel aus NC-Datei sichtbar
- [ ] Artikel anlegen, bearbeiten, löschen funktioniert (NC-Datei wird aktualisiert)
- [ ] Copy-Paste einer Materialstelle-Auftragsbestätigung → Artikel erscheinen im Katalog
- [ ] Leerhinweis auf Artikelseite wenn Katalog leer
- [ ] Offline: App lädt aus localStorage/Cache wenn NC nicht erreichbar

---

## Stretch Items (wenn Zeit bleibt)

- `index.html` Startseite mit Navigation zu allen Seiten und Status-Kacheln
- Service Worker bereits einrichten (später nötig für PWA)
