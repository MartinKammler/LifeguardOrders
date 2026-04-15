# Plan: DLRG Bestellsystem (LifeguardOrders)

## Architectural Decisions

| Entscheidung | Festlegung |
|---|---|
| **Seitenstruktur** | Eine HTML-Datei pro Seite (kein SPA-Router), konsistent mit Stempeluhr |
| **JS-Module** | Pro Seite eine `*-app.js`; geteilte Logik in: `webdav.js`, `parser.js`, `berechnung.js`, `mitglieder.js`, `pdf.js` |
| **Datenhaltung** | JSON-Dateien auf Nextcloud: `artikel.json`, `bestellungen.json`, `einstellungen.json` |
| **Offline-Cache** | `localStorage` als Lese-Fallback (lokale Daten verlieren nie gegen leeres NC-Ergebnis); Service Worker für statische Assets |
| **WebDAV** | Alle NC-Zugriffe laufen durch `webdav.js`; Fehler als strukturierte Objekte, keine Exceptions; Factory-Pattern für Testbarkeit |
| **PDF** | jsPDF im Browser; Download lokal, kein NC-Upload im MVP |
| **Rechnungsnummern** | Format `R_YYYY_MM_NNN`; Zähler live aus `bestellungen.json` berechnet |
| **Mitgliederliste** | Einmalig aus Stempeluhr `config.js` importiert, in `einstellungen.json` gespeichert |
| **Artikelkatalog** | Deduplizierung per `artikelNr + variante`; `variante` = Größen-/Variantencode (z.B. "XL", "MAGNET") |
| **Tests** | HTML-Testseiten mit plain JS `assert`, kein Framework, nur reine Logik-Funktionen |

---

## Phase 1 — Fundament & Artikelkatalog ✅ ABGESCHLOSSEN

**Ziel:** Admin kann Artikel aus Materialstelle importieren (alle drei Formate) und den Katalog pflegen.

**Stories:** 1–15

**Erreicht:**
- Einstellungen: NC-Credentials, OG-Stammdaten, Mitglieder-Import
- Artikelkatalog: Import (Auftragsbestätigung + Produktseite mit Größen + LV-Förderung), CRUD, Variante-Feld
- Module mit Tests: parser.js (39/39), berechnung.js (22/22), webdav.js (19/19), mitglieder.js (8/8)
- index.html mit Kacheln und Live-Statistiken

---

## Phase 2 — Sammelbestellung: Sammlung & CSV-Export

**Ziel:** Admin erfasst Mitgliederwünsche, sieht die aggregierte Bestellmenge und exportiert
die CSV-Liste für das Materialstelle-Bestellformular.

**Stories:** 16–22

**Wird möglich nach Phase 2:**
- Mitgliederwünsche je Bestellung erfassen (Mitglied + Artikel + Variante + Menge)
- Aggregierte Ansicht: wie viel von was insgesamt bestellt wird
- CSV-Export im Format `artikelNr,variante,menge` für Materialstelle

**Acceptance Criteria:**
- Neue Sammelbestellung mit Datum und Bezeichnung anlegen
- Wunscheintrag: Mitglied-Dropdown + Artikel-Suche aus Katalog (mit Variante) + Menge
- Aggregierte Tabelle zeigt Gesamtmengen je Artikel+Variante
- "CSV kopieren"-Button erzeugt fertige Liste
- Wünsche nachträglich bearbeiten/löschen möglich (solange Status "sammlung")
- Bestellungen-Übersicht zeigt Phase und Anzahl Wünsche

**Seiten:** `bestellung-sammeln.html` + `bestellungen.html` (angepasst)

---

## Phase 3 — Sammelbestellung: Eingang & Abgleich

**Ziel:** Admin importiert die Materialstelle-Rechnung, gleicht sie mit den Wünschen ab
und löst Abweichungen auf.

**Stories:** 23–29

**Wird möglich nach Phase 3:**
- Rechnungsimport direkt in die Bestellung
- Automatischer Abgleich Rechnung ↔ Wünsche nach artikelNr + variante
- Review-Ansicht für Abweichungen (zu viel, zu wenig, nicht bestellt)
- Manuelle Korrektur von Abweichungen

**Acceptance Criteria:**
- Rechnungstext einfügen → Parser liefert Positionen
- Automatischer Match nach artikelNr + variante
- Abweichungen visuell markiert und einzeln auflösbar
- OG-Kosten (Versand, Eilauftrag) sichtbar aber nicht zuweisbar
- Status wechselt nach Abgleich auf "abgeschlossen"-bereit

**Seiten:** `bestellung-abgleich.html`

---

## Phase 4 — Rechnungen & Zahlungsverfolgung

**Ziel:** Admin erzeugt PDF-Rechnungen je Mitglied und verfolgt Zahlungen.

**Stories:** 30–38

**Wird möglich nach Phase 4:**
- PDF-Rechnung im OG-Layout mit Mitgliedsanteil und erwarteten Einsatzstunden
- Rechnungsübersicht mit Zahlungsstatus
- Rechnung als bezahlt/offen markieren

**Acceptance Criteria:**
- PDF entspricht Layout der Vorlage `R_2025_07_001_Kammler.pdf`
- Rechnungsnummern lückenlos (R_YYYY_MM_NNN)
- Rechnung zeigt Mitgliedsanteil nach Förderabzug + erwartete Stunden
- Rechnungsübersicht filterbar nach offen/bezahlt und Mitglied
- Offener Gesamtbetrag sichtbar

**Seiten:** `rechnungen.html`

---

## Phase 5 — Kassenwart-Übersicht & Dashboard

**Ziel:** Vollständige Unterlagen für die Kasse + Einsatzstunden-Tracking.

**Stories:** 39–52

**Wird möglich nach Phase 5:**
- Kassenwart-Tabelle: wer hat was bekommen, was wurde wie gefördert
- PDF- und CSV-Export
- Dashboard: Stunden-Ampel je Mitglied

**Acceptance Criteria:**
- Kassenwart-Tabelle mit Förderanteilen und Zahlungsstatus je Mitglied
- Summenzeilen: BV/LV/OG/Mitglieder-Gesamt, offen/bezahlt
- CSV- und PDF-Export funktionsfähig
- Dashboard liest LifeguardClock-JSONs automatisch
- Ampel grün/gelb/rot, chronologische Tilgung
- Unbekannte Nutzernamen markiert

**Seiten:** `kassenwart.html`, `dashboard.html`
