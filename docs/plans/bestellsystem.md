# Plan: DLRG Bestellsystem (LifeguardOrders)

## Architectural Decisions

| Entscheidung | Festlegung |
|---|---|
| **Seitenstruktur** | Eine HTML-Datei pro Seite (kein SPA-Router), konsistent mit Stempeluhr |
| **JS-Module** | Pro Seite eine `*-app.js`; geteilte Logik in eigenständigen Modulen: `webdav.js`, `parser.js`, `berechnung.js`, `mitglieder.js`, `pdf.js` |
| **Datenhaltung** | JSON-Dateien auf Nextcloud: `artikel.json`, `bestellungen.json`, `einstellungen.json` |
| **Offline-Cache** | `localStorage` als Lese-Fallback; Service Worker für statische Assets |
| **WebDAV** | Alle NC-Zugriffe laufen durch `webdav.js`; Fehler als strukturierte Objekte, keine Exceptions |
| **PDF** | jsPDF im Browser; Download lokal, kein NC-Upload im MVP |
| **Rechnungsnummern** | Format `R_YYYY_MM_NNN`; Zähler wird live aus `bestellungen.json` berechnet |
| **Mitgliederliste** | Einmalig aus Stempeluhr `config.js` importiert, in `einstellungen.json` gespeichert; Matching per Vollname auf `nutzer`-Feld der LifeguardClock-JSONs |
| **Tests** | `tests/unit.js` — plain JS `assert`, kein Framework, testet nur reine Logik-Funktionen |

---

## Phase 1 — Fundament & Artikelkatalog

**Ziel:** Admin kann Artikel aus Materialstelle-Bestellbestätigungen importieren und den Katalog pflegen.

**Stories:** 1–14 (Ersteinrichtung + Artikelverwaltung)

**Wird möglich nach Phase 1:**
- Nextcloud-Verbindung einrichten und prüfen
- OG-Stammdaten hinterlegen
- Mitgliederliste einmalig importieren
- Artikelkatalog aufbauen (Import + manuell)

**Acceptance Criteria:**
- Einstellungsseite speichert OG-Daten und NC-Credentials in `einstellungen.json`
- Artikelkatalog zeigt alle Einträge aus `artikel.json`
- Import-Parser erkennt Artikel, BV/LV-Förderung, Versandkosten; Menge-0-Artikel werden übersprungen
- Artikel können manuell angelegt, bearbeitet und gelöscht werden
- Bei leerem Katalog erscheint ein erklärender Hinweis

---

## Phase 2 — Sammelbestellung & Mitglieder-Zuweisung

**Ziel:** Admin kann eine Sammelbestellung anlegen, Positionen importieren und Mitgliedern zuweisen.

**Stories:** 15–24

**Wird möglich nach Phase 2:**
- Vollständige Sammelbestellung von Materialstelle bis Mitglieder-Zuweisung
- Sichtbar: wer zahlt was, inkl. aller Förderabzüge

**Acceptance Criteria:**
- Neue Sammelbestellung mit Datum und Bezeichnung anlegen
- Positionen per Import-Parser befüllen
- Jede Position einem Mitglied zuweisen (Dropdown)
- Menge > 1 auf mehrere Mitglieder aufteilen
- Nicht zugewiesene Positionen visuell hervorgehoben
- OG-Kostenposten (Versand, Eilauftrag) klar als OG-Kosten ausgewiesen
- Förderberechnung je Zuweisung korrekt angezeigt

---

## Phase 3 — Rechnungen & Zahlungsverfolgung

**Ziel:** Admin kann PDF-Rechnungen erzeugen und Zahlungen nachverfolgen.

**Stories:** 25–36

**Wird möglich nach Phase 3:**
- Professionelle Rechnungen im bestehenden OG-Layout als PDF-Download
- Offene Rechnungen auf einen Blick
- Zahlungsmarkierung mit Datum

**Acceptance Criteria:**
- PDF entspricht Layout der Vorlage `R_2025_07_001_Kammler.pdf`
- Rechnungsnummern lückenlos und monatsweise fortlaufend (R_YYYY_MM_NNN)
- Rechnungsübersicht filterbar nach offen/bezahlt und nach Mitglied
- Zahlung als bezahlt/offen markierbar mit Datum
- Offener Gesamtbetrag in Übersicht sichtbar

---

## Phase 4 — Kassenwart-Übersicht

**Ziel:** Admin kann dem Kassenwart eine vollständige Übersicht mit Export liefern.

**Stories:** 37–41

**Wird möglich nach Phase 4:**
- Tabellarische Kassenwart-Übersicht aller Positionen
- PDF- und CSV-Export

**Acceptance Criteria:**
- Tabelle zeigt alle Positionen mit Mitglied, Artikel, allen Förderanteilen, Zahlungsstatus
- Summenzeilen je Fördertopf korrekt berechnet
- Filterbar nach Kalenderjahr
- PDF- und CSV-Download funktionsfähig

---

## Phase 5 — Einsatzstunden-Dashboard

**Ziel:** Admin sieht, ob Mitglieder ihre OG-Förderung durch Einsatzstunden abgearbeitet haben.

**Stories:** 42–50

**Wird möglich nach Phase 5:**
- Dashboard liest LifeguardClock-JSONs automatisch
- Ampel-Status je Mitglied und Verpflichtung
- Vollständig funktionsfähiges System

**Acceptance Criteria:**
- Alle `lgc_*.json` aus `/LifeguardClock/` werden beim Öffnen des Dashboards eingelesen
- Stunden je Mitglied korrekt summiert (nur erlaubte Typen)
- Schuld aus OG-Förderung korrekt berechnet (3h / 10€)
- Chronologische Tilgungsreihenfolge bei mehreren offenen Bestellungen
- Ampel: grün/gelb/rot je Mitglied/Verpflichtung
- Unbekannte Nutzernamen als "unbekannt" markiert
