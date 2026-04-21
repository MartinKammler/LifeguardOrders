# LifeguardOrders – DLRG Bestellsystem

Vanilla-JS-Webanwendung zur Verwaltung von Sammelbestellungen der DLRG Ortsgruppe Schellbronn.
Erfasst Mitgliederwünsche, gleicht Lieferungen ab, erzeugt Mitgliedsrechnungen als PDF,
führt den Kassenwart und trackt Einsatzstunden-Pflichten aus OG-Förderungen.

Kein Framework, kein Build-Schritt, kein eigener Server — läuft direkt im Browser.
Daten werden als JSON-Dateien auf der Nextcloud der OG via WebDAV gespeichert.

---

## Seiten und Workflow

```
index.html                ← Startseite: Kacheln + Live-Statistiken + ausstehende Syncs
artikel.html              ← Artikelkatalog: Import, CRUD, BV-/LV-/OG-Förderung je Artikel
bestellungen.html         ← Übersicht aller Sammelbestellungen mit Phase und Status
materialbestand.html      ← Lagerbestand: Posten anlegen, Zu-/Abgänge buchen, Lagerverkauf
bestellung-neu.html       ← Neue Sammelbestellung anlegen
bestellung-sammeln.html   ← Phase 1: Mitgliederwünsche erfassen + aggregierte CSV für Materialstelle
bestellung-abgleich.html  ← Phase 2+3: Rechnungsimport, Abgleich, Anprobe, Abschluss
rechnungen.html           ← Rechnungsübersicht: PDF-Download, Zahlungsstatus
kassenwart.html           ← Kassenwart-Übersicht: Förderanteile, Summen, PDF/CSV-Export
dashboard.html            ← Einsatzstunden-Dashboard: Ampel je Mitglied, LifeguardClock-Import
einstellungen.html        ← Konfiguration: NC-Zugangsdaten, OG-Stammdaten, Mitglieder
```

### Workflow einer Sammelbestellung

```
Phase 1 – Sammlung (bestellung-sammeln.html):
  Admin legt Bestellung an → erfasst Wünsche (Mitglied + Artikel + Variante + Menge)
  → optional "OG übernimmt Kosten" → CSV-Export für Materialstelle-Bestellformular
  → "Als bestellt markieren" übergibt an Phase 2

Phase 2 – Eingang / Abgleich (bestellung-abgleich.html):
  Admin importiert DLRG-Verkaufsrechnung als PDF oder Auftragsbestätigung als Text
  → parse-verkaufsrechnung.js / parser.js extrahieren Positionen (inkl. Varianten, Förderabzüge)
  → System gleicht Rechnung ↔ Wünsche ab (exakter Match + Fuzzy-Match für Variantenkodierung)
  → Abweichungen (Menge, nicht geliefert, nicht bestellt) werden reviewt

Phase 3 – Anprobe (bestellung-abgleich.html):
  Admin prüft Mengen-Zuweisung je Mitglied → kann Retoure- und Lagerbestandsmengen markieren
  → Abschluss erst wenn alle Positionen vollständig zugeordnet
  → "Bestellung wieder öffnen" → zurück zu Phase 1 (Wünsche bearbeiten) oder Phase 2 (Neuabgleich)

Phase 4 – Abschluss & Rechnungen:
  Rechnungen je Mitglied werden erzeugt (PDF via pdf-lib, Template-basiert)
  Lagerbestandsmengen werden automatisch in materialbestand.json gebucht
```

---

## Tech-Stack

| Bereich | Details |
|---|---|
| Sprache | Vanilla JS (ES-Module), kein TypeScript, kein Framework |
| Stil | HTML/CSS, kein Build-Schritt — direkt im Browser ausführbar |
| Persistenz | JSON-Dateien auf Nextcloud via WebDAV (`/LifeguardOrders/`) |
| Datenzugriff | WebDAV/Nextcloud ist für fachliche Daten zwingend; localStorage dient nur als Login-Hilfe und für technische Marker |
| PDF | [pdf-lib](https://pdf-lib.js.org/) (lokal in `lib/`), Template-basiert (`Rechnung _Template.pdf`) |
| XSS-Schutz | `html\`...\`` tagged template (auto-escaped), `raw()` nur für vertrauenswürdige Strings, `setHTML()` für alle DOM-Mutationen |
| Tests | Node.js-Testrunner (`tests/run-html-tests.mjs`) + Regression (`tests/review-regression.mjs`) |
| Abhängigkeiten | Nur `pdf-lib` (lokal), keine CDN-Aufrufe |

---

## Projektstruktur

```
src/
  webdav.js               — WebDAV-Client, Factory-Pattern, strukturierte Fehler
  sync.js                 — persistJsonWithSync, hydrateJsonFromSync, Pending-State
  storage.js              — localStorage load/save
  dom.js                  — html``, raw(), setHTML() (XSS-Schutz)
  parser.js               — Auftragsbestätigung-Parser (3 Formate: Produktseite, mehrzeilig, Tab)
  parse-verkaufsrechnung.js — DLRG-Verkaufsrechnung-Parser (PDF-Textextraktion):
                              Artikelzeilen mit/ohne Preis (Bundlekomponenten werden ignoriert),
                              gesplittete Zeilen (Variante auf Folgezeile), MITTELVERW. BV/LV,
                              EILAUFTRAG; extrahiert Varianten aus Klammern oder als bareSize-Token;
                              Seiten-/Zeilenverfolgung (_seite, _zeile) für Debug-Anzeige im UI
  berechnung.js           — berechneFoerderung: bv, lv, og, mitglied, ogUebernimmtRest, ogKostenlos
  sammlung.js             — aggregiereWuensche, exportiereCSV, validiereWunsch
  abgleich.js             — gleiche_ab (2-Pass: exakt + fuzzy), bauePositionenAusAbgleich,
                              normalisierePosition, verteileGelieferteMenge
  stunden.js              — berechneStunden, verechneSchuld, ampelStatus
  kassenwart.js           — Kassenwart-Zeilen aus gespeicherten Positions-Snapshots
  pdf.js                  — druckePDF, erstelleRechnungsDaten (pdf-lib, Template)
  mitglieder.js           — Mitglieder-Import (JS-Literal + JSON-Format)
  materialbestand.js      — Materialbestand-Logik, Bewegungen, Normalisierung
  materialverkauf.js      — Lagerverkauf: Bestandsabgang + Bestellung + Rechnung in einem Schritt
  artikel-katalog.js      — Artikelkatalog-Logik
  artikel-app.js          — Artikelseite UI
  materialbestand-app.js  — Materialbestand UI
  einstellungen-app.js    — Einstellungen UI
  konstanten.js           — EXTERN_ID, OG_ID (virtuelle Mitglieder)
  validation.js           — Eingabevalidierung
  audit.js                — Audit-Log
  defaults.js             — Standardwerte

lib/
  pdf-lib.esm.min.js — PDF-Erzeugung (lokal, kein CDN)

tests/
  run-html-tests.mjs — Testrunner (Node.js, .mjs-Isolation, automatische Cleanup)
  review-regression.mjs — Regression-Tests
  *.test.html        — Testseiten für einzelne Module

data/
  artikel.json       — lokale Standardartikel (gitignore: einstellungen.json, bestellungen.json)

Rechnung _Template.pdf   — PDF-Vorlage für Rechnungserzeugung
```

---

## Nextcloud-Dateistruktur

```
/LifeguardOrders/
  artikel.json          ← Artikelkatalog
  bestellungen.json     ← Sammelbestellungen mit Wünschen, Positionen, Rechnungen
  materialbestand.json  ← Lagerposten
  einstellungen.json    ← OG-Stammdaten, NC-Credentials, Mitglieder

/LifeguardClock/
  lgc_*.json            ← Stempeluhr-Exports (nur lesen, für Dashboard)
```

---

## Fördermodell

Jeder Artikel hat optionale Förderbeträge (BV, LV, OG) in €. Die Rechnung zeigt
nur den Mitgliedsanteil nach Abzug aller Förderungen.

- `ogUebernimmtRest: true` → OG-Anteil = Preis − BV − LV
- `ogKostenlos: true` (pro Wunsch) → Mitgliedsanteil = 0 €, OG übernimmt den Rest
- OG-Förderung erzeugt eine Stunden-Verpflichtung: 3 Std. je 10 € OG-Anteil

Virtuelle Mitglieder:
- `OG_ID` (`__OG__`) — interne OG-Kosten (Versand, Eilauftrag)
- `EXTERN_ID` (`__EXTERN__`) — externe Käufer (keine Stundenpflicht)

---

## Sync-Verhalten

Schreiboperationen sind lokal-first. Bei NC-Fehler bleiben Daten lokal erhalten,
`syncStatus = 'pending'` wird gesetzt und beim nächsten Schreibzugriff erneut versucht.
Die Startseite (`index.html`) zeigt ausstehende Scopes persistent an.

---

## Einrichtung

1. Alle Dateien auf einem Webserver bereitstellen (oder lokal über `localhost` öffnen).
2. `einstellungen.html` öffnen: NC-URL, Benutzer, App-Passwort, OG-Stammdaten eintragen.
3. Mitgliederliste aus Stempeluhr-`config.js` importieren (Copy-Paste).
4. Artikelkatalog über `artikel.html` aufbauen (Import oder manuell).
5. Erste Sammelbestellung über `bestellung-neu.html` anlegen.

Für den NC-Sync muss CORS auf der Nextcloud so konfiguriert sein, dass der Browser-Origin
Zugriff auf die WebDAV-API hat.

---

## Tests

```bash
# Alle Tests
run-tests.bat
# Oder direkt
node tests/run-html-tests.mjs
node tests/review-regression.mjs
```

Testabdeckung: parser.js (39), berechnung.js (22), webdav.js (19), mitglieder.js (8),
sammlung.js, abgleich.js (inkl. Fuzzy-Match, Wunsch-Variante, Doppel-Position-Summierung),
parse-verkaufsrechnung.js (Bundle, Split-Zeile, VPE-False-Positive, Seitentracking),
stunden.js, kassenwart.js, materialbestand.js, validation.js, authz.js, wunsch.js, audit.js,
sync.js, session.js — 48 Regressions-Assertions in review-regression.mjs.

---

## Verwandte Projekte

- **LifeguardClock** (Stempeluhr) — gleicher Tech-Stack, gleiche Mitglieder-IDs.
  Dashboard liest automatisch `lgc_*.json` aus `/LifeguardClock/` auf Nextcloud.
