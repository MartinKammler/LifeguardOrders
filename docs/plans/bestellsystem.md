# Plan: DLRG Bestellsystem (LifeguardOrders)

## Architectural Decisions

| Entscheidung | Festlegung |
|---|---|
| **Seitenstruktur** | Eine HTML-Datei pro Seite (kein SPA-Router), konsistent mit Stempeluhr |
| **JS-Module** | Pro Seite eine `*-app.js`; geteilte Logik in: `webdav.js`, `parser.js`, `berechnung.js`, `mitglieder.js`, `pdf.js`, `sammlung.js`, `abgleich.js`, `stunden.js`, `defaults.js` |
| **Datenhaltung** | JSON-Dateien auf Nextcloud: `artikel.json`, `bestellungen.json`, `einstellungen.json` |
| **Offline-Cache** | `localStorage` als Lese-Fallback (lokale Daten verlieren nie gegen leeres NC-Ergebnis); Service Worker für statische Assets |
| **WebDAV** | Alle NC-Zugriffe laufen durch `webdav.js`; Fehler als strukturierte Objekte, keine Exceptions; Factory-Pattern für Testbarkeit |
| **PDF** | jsPDF im Browser; Download lokal, kein NC-Upload im MVP |
| **Rechnungsnummern** | Format `R_YYYY_MM_NNN`; Zähler live aus `bestellungen.json` berechnet |
| **Mitgliederliste** | Einmalig aus Stempeluhr `config.js` importiert, in `einstellungen.json` gespeichert |
| **Artikelkatalog** | Deduplizierung per `artikelNr + variante`; `variante` = Größen-/Variantencode (z.B. "XL", "MAGNET") |
| **Tests** | HTML-Testseiten mit plain JS `assert`; ergänzend Node-Regressionen für extrahierte Kernmodule |

---

## Test Commands

```powershell
run-tests.bat
node tests\run-html-tests.mjs
node tests\review-regression.mjs
```

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

## Phase 2 — Sammelbestellung: Sammlung & CSV-Export ✅ ABGESCHLOSSEN

**Ziel:** Admin erfasst Mitgliederwünsche, sieht die aggregierte Bestellmenge und exportiert
die CSV-Liste für das Materialstelle-Bestellformular.

**Stories:** 16–23

**Erreicht:**
- `src/sammlung.js`: `aggregiereWuensche`, `exportiereCSV`, `validiereWunsch` (mit Tests)
- `bestellungen.html`: Übersicht mit Phase, Anzahl Wünsche, "Wieder öffnen"-Button
- `bestellung-sammeln.html`: Wünsche erfassen, aggregierte Tabelle, CSV-Export
- `bestellung-neu.html`: eigene Seite zum Anlegen einer Sammelbestellung (zusätzlich)

**Seiten:** `bestellung-neu.html` + `bestellung-sammeln.html` + `bestellungen.html`

---

## Phase 3 — Sammelbestellung: Eingang, Abgleich & Anprobe ✅ ABGESCHLOSSEN

**Ziel:** Admin importiert die Materialstelle-Rechnung, gleicht sie mit den Wünschen ab
und überführt die gelieferte Bestellung in eine finale Anprobe-/Verteilphase.

**Stories:** 24–32

**Erreicht:**
- `src/abgleich.js`: `gleiche_ab`, `bauePositionenAusAbgleich` (Match, Mengenabweichung, nicht bestellt, nicht geliefert, OG-Kosten) mit Tests
- `bestellung-abgleich.html`: Rechnungsimport, Abgleich-UI, Review, Übergang in Status `anprobe`
- Nachschärfung: eigene Anprobe-Ansicht für finale Verteilung, Mitgliedswechsel, `retoureMenge`, `ogBestandMenge`
- Zusatz: "Wünsche direkt übernehmen" für Artikel ohne externe Rechnung (z.B. Lehrgänge)
- Zusatz: "Bestellung wieder öffnen" setzt Status zurück
- Nachschärfung: Mengenabweichung `ignorieren` erzeugt keine finale Position; nur `uebernehmen` übernimmt gelieferte Mengen
- Nachschärfung: Abschluss erst bei vollständiger Mengenbilanz je Position

**Seiten:** `bestellung-abgleich.html`

---

## Phase 4 — Rechnungen & Zahlungsverfolgung ✅ ABGESCHLOSSEN

**Ziel:** Admin erzeugt PDF-Rechnungen je Mitglied aus der finalen Anprobe-Verteilung
und verfolgt Zahlungen.

**Stories:** 33–41

**Erreicht:**
- `src/pdf.js`: `erstelleRechnungsDaten`, `druckePDF` via jsPDF
- `rechnungen.html`: Rechnungsübersicht mit Statistik-Karten, PDF-Download, Zahlungsstatus
- Rechnungsfreigabe erst nach Status `abgeschlossen`; Status `anprobe` sperrt Rechnungserzeugung
- Zahlungsfrist: 30 Tage ab Rechnungsdatum

**Seiten:** `rechnungen.html`

---

## Phase 5 — Kassenwart-Übersicht & Dashboard ✅ ABGESCHLOSSEN

**Ziel:** Vollständige Unterlagen für die Kasse + Einsatzstunden-Tracking.

**Stories:** 42–57

**Erreicht:**
- `src/stunden.js`: `berechneStunden`, `verechneSchuld`, `fristDerAeltestenOffenenSchuld`, `ampelStatus`, `schuldFrist` mit Tests
- `src/kassenwart.js`: Kassenwart-Zeilen aus gespeicherten Positions-Snapshots, `ogKostenlos`-Berücksichtigung
- `kassenwart.html`: Tabelle mit Förderanteilen, Summenzeilen, Jahresfilter, CSV/PDF-Export
- `dashboard.html`: Ampel-Karten je Mitglied, automatischer LifeguardClock-Import, Ausblenden ohne OG-Schuld
- Nachschärfung: LifeguardClock-Matching via `userId` oder normalisiertem `nutzer`; Frist aus ältester noch offener Schuld

**Seiten:** `kassenwart.html`, `dashboard.html`

---

## Nachträgliche Erweiterungen (nach Sprint 05)

- **Workflow-Erweiterung Anprobe:** neuer Status `anprobe` zwischen `bestellt` und `abgeschlossen`; finale Verteilung, Retoure und OG-Bestand werden in `positionen[]` gepflegt bevor Rechnungen erzeugt werden
- **Lehrgänge als Artikel** in `data/artikel.json`: 16 Einträge (8 Lehrgänge × Mitglied/Nichtmitglied, Präfix `LG-`)
- **Mitglieder-Import JSON-Format** (`src/mitglieder.js`): Parser erkennt jetzt auch JSON-Schlüssel in Anführungszeichen (`"id": "value"`) zusätzlich zum JS-Literal-Format (`id: 'value'`)
