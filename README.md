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
login.html                ← Login: Mitglied per Stempeluhr-PIN oder Funktionslogin
artikel.html              ← Artikelkatalog: Import, CRUD, BV-/LV-/OG-Förderung je Artikel
bestellungen.html         ← Übersicht aller Sammelbestellungen mit Phase und Status
materialbestand.html      ← Lagerbestand: Posten anlegen, Zu-/Abgänge buchen, Lagerverkauf
bestellung-neu.html       ← Neue Sammelbestellung anlegen
bestellung-sammeln.html   ← Phase 1: Mitgliederwünsche erfassen + aggregierte CSV für Materialstelle
bestellung-abgleich.html  ← Phase 2+3: Rechnungsimport, Abgleich, Anprobe, Abschluss
rechnungen.html           ← Rechnungsübersicht: PDF-Download, Zahlungsstatus
kassenwart.html           ← Kassenwart-Übersicht: Förderanteile, Summen, PDF/CSV-Export
dashboard.html            ← Einsatzstunden-Dashboard: Ampel je Mitglied, LifeguardClock-Import
mitglied.html             ← Mitglieder-Startseite
wuensche.html             ← Mitglieder-Wunschliste
wunsch-queue.html         ← Admin-Queue für Mitgliederwünsche
einstellungen.html        ← Konfiguration: NC-Zugangsdaten, OG-Stammdaten (Name, IBAN, BIC, Bank, Finanzen), Mitglieder
```

### Workflow einer Sammelbestellung

```
Phase 1 – Sammlung (bestellung-sammeln.html):
  Admin legt Bestellung an → erfasst Wünsche (Mitglied + Artikel + Variante + Menge)
  → Kostenmodus je Wunsch:
      - Normal
      - OG übernimmt mit Wachstunden
      - OG übernimmt ohne Gegenleistung
  → CSV-Export für Materialstelle-Bestellformular
  → "Als bestellt markieren" übergibt an Phase 2

Phase 2 – Eingang / Abgleich (bestellung-abgleich.html):
  Admin importiert DLRG-Verkaufsrechnung als PDF oder Auftragsbestätigung als Text
  → parse-verkaufsrechnung.js / parser.js extrahieren Positionen (inkl. Varianten, Förderabzüge)
  → System gleicht Rechnung ↔ Wünsche ab (exakter Match + Fuzzy-Match für Variantenkodierung)
  → Abweichungen (Menge, nicht geliefert, nicht bestellt) werden reviewt

Phase 3 – Anprobe (bestellung-abgleich.html):
  Admin prüft Mengen-Zuweisung je Mitglied → kann Retoure- und Lagerbestandsmengen markieren
  → pro Besteller kann die Anprobe einzeln abgeschlossen und die Rechnung erzeugt werden
  → Gesamtabschluss erst wenn alle Positionen vollständig zugeordnet sind
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
| Datenzugriff | WebDAV/Nextcloud ist für fachliche Daten zwingend; `localStorage` dient als Login-Hilfe (NC-URL, Benutzer, optional App-Passwort per Opt-in), Sessiondaten und technische Marker |
| PDF | [pdf-lib](https://pdf-lib.js.org/) (lokal in `lib/`), Template-basiert (`Rechnung _Template.pdf`) |
| XSS-Schutz | `html\`...\`` tagged template (auto-escaped), `raw()` nur für vertrauenswürdige Strings, `setHTML()` für alle DOM-Mutationen |
| Tests | Node.js-Testrunner (`tests/run-html-tests.mjs`) + Regression (`tests/review-regression.mjs`) |
| Abhängigkeiten | Nur `pdf-lib` (lokal), keine CDN-Aufrufe |

---

## Projektstruktur

```
src/
  app-context.js          — gemeinsamer NC-/Remote-Kontext für fachliche Daten
  auth.js                 — Funktionslogin gegen `benutzer.json`
  auth-guard.js           — Session-/Seitenschutz
  authz.js                — Rollen- und Aktionsrechte
  webdav.js               — WebDAV-Client, Factory-Pattern, strukturierte Fehler
  sync.js                 — remote-required Laden/Speichern, ETag-Prüfung, Konfliktsperren
  storage.js              — localStorage load/save
  dom.js                  — html``, raw(), setHTML() (XSS-Schutz)
  kostenmodus.js          — Kostenmodus-Helfer (`normal`, `og_mit_stunden`, `og_ohne_gegenleistung`)
  parser.js               — Auftragsbestätigung-Parser (3 Formate: Produktseite, mehrzeilig, Tab)
  parse-verkaufsrechnung.js — DLRG-Verkaufsrechnung-Parser (PDF-Textextraktion):
                              Artikelzeilen mit/ohne Preis (Bundlekomponenten werden ignoriert),
                              gesplittete Zeilen (Variante auf Folgezeile), MITTELVERW. BV/LV,
                              EILAUFTRAG; extrahiert Varianten aus Klammern oder als bareSize-Token;
                              Seiten-/Zeilenverfolgung (_seite, _zeile) für Debug-Anzeige im UI
  berechnung.js           — berechneFoerderung: BV/LV/OG/Anteil Mitglied + Stundenpflicht nach Kostenmodus;
                              Rechnungsnummer-Format: R_MAT_YYYY_MM_NNN (monatlich laufend)
  sammlung.js             — aggregiereWuensche, exportiereCSV, validiereWunsch
  abgleich.js             — gleiche_ab (2-Pass: exakt + fuzzy), bauePositionenAusAbgleich,
                              normalisierePosition, verteileGelieferteMenge
  stunden.js              — berechneStunden, verechneSchuld, ampelStatus
  kassenwart.js           — Kassenwart-Zeilen aus gespeicherten Positions-Snapshots
  pdf.js                  — druckePDF, erstelleRechnungsDaten (pdf-lib, Template)
  session.js              — Sessionverwaltung, Timeouts, Login-Redirect
  stempeluhr-auth.js      — Mitgliedslogin gegen `/LifeguardClock/lgc_users.json`
  zugriff.js              — globale und individuelle Sperren
  wunsch.js               — Mitgliederwünsche und Queue-Helfer
  materialanfragen.js     — Lagerfreigaben / offene Materialanfragen
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
  benutzer.json         ← Funktionskonten (`admin`, `finanzen`, `materialwart`)
  zugriff.json          ← globale und individuelle Sperren
  wuensche.json         ← Mitglieder-Wunschqueue
  materialanfragen.json ← offene Lagerfreigaben / Materialanfragen
  audit.log.json        ← Remote-Audit-Log

/LifeguardClock/
  lgc_*.json            ← Stempeluhr-Exports (nur lesen, für Dashboard)
```

---

## Fördermodell

Jeder Artikel hat optionale Förderbeträge (BV, LV, OG) in €. Die Rechnung zeigt
nur den Mitgliedsanteil nach Abzug aller Förderungen.

- `ogUebernimmtRest: true` → OG-Anteil = Preis − BV − LV
- `kostenmodus = normal` → Mitglied zahlt regulären Restbetrag
- `kostenmodus = og_mit_stunden` → Mitglied zahlt `0 €`, OG übernimmt den Rest, daraus entsteht Stundenpflicht
- `kostenmodus = og_ohne_gegenleistung` → Mitglied zahlt `0 €`, OG übernimmt den Rest ohne Stundenpflicht
- Nur `og_mit_stunden` erzeugt eine Stunden-Verpflichtung: standardmäßig 3 Std. je 10 € OG-Anteil

Virtuelle Mitglieder:
- `OG_ID` (`__OG__`) — interne OG-Kosten (Versand, Eilauftrag)
- `EXTERN_ID` (`__EXTERN__`) — externe Käufer (keine Stundenpflicht)

---

## Sync-Verhalten

Fachliche Daten sind **remote-required**:

- Ohne erreichbare Nextcloud/WebDAV-Verbindung werden Bestellungen, Wünsche, Lagerdaten,
  Rechnungen und Rolleninformationen nicht geladen.
- Schreiben erfolgt nur nach Remote-Prüfung mit ETag-/Versionskontrolle.
- Bei Remote-Konflikten wird hart gesperrt statt still zu überschreiben.
- Lokal bleiben nur minimale Login-Hilfen, Sessiondaten und technische Marker.

---

## Login und Rollen

Es gibt zwei Login-Wege:

- **Mitgliedslogin** über Stempeluhr-PIN aus `/LifeguardClock/lgc_users.json`
- **Funktionslogin** über `/LifeguardOrders/benutzer.json`

Funktionskonten:

- `admin`
- `finanzen`
- `materialwart`

Nach dem Funktionslogin muss zusätzlich eine handelnde Person gewählt werden, damit
Audit-Einträge einer realen Person zugeordnet bleiben.

---

## Einrichtung

1. Alle Dateien auf einem Webserver bereitstellen (oder lokal über `localhost` öffnen).
2. `einstellungen.html` öffnen: NC-URL, Benutzer, App-Passwort sowie OG-Name, IBAN, BIC, Bank und Finanzkontakt eintragen.
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
npm test
node tests/run-html-tests.mjs
node tests/review-regression.mjs
```

Testabdeckung: parser.js, berechnung.js, webdav.js, mitglieder.js,
sammlung.js, abgleich.js (inkl. Fuzzy-Match, Kostenmodus, Teilabschluss-Logik),
parse-verkaufsrechnung.js (Bundle, Split-Zeile, VPE-False-Positive, Seitentracking),
stunden.js, kassenwart.js, materialbestand.js, validation.js, authz.js, wunsch.js, audit.js,
sync.js, session.js, stempeluhr-auth.js — vollständiger Lauf via `npm test`.

---

## Verwandte Projekte

- **LifeguardClock** (Stempeluhr) — gleicher Tech-Stack, gleiche Mitglieder-IDs.
  Dashboard liest automatisch `lgc_*.json` aus `/LifeguardClock/` auf Nextcloud.
