# PRD: DLRG Bestellsystem (LifeguardOrders)

## Problem Statement

Die DLRG Ortsgruppe Schellbronn e.V. verwaltet Sammelbestellungen von Einsatzkleidung und
Material bisher manuell. Es fehlt ein System, das Bestellungen aus der DLRG-Materialstelle
erfasst, Förderanteile von BV, LV und OG korrekt verrechnet, rechtskonforme Rechnungen erzeugt,
dem Kassenwart eine Gesamtübersicht liefert und nachverfolgt, ob Mitglieder ihre OG-Förderung
durch Einsatzstunden abgearbeitet haben.

---

## Solution

Eine Progressive Web App (PWA) im gleichen Tech-Stack wie die bestehende Stempeluhr (Vanilla JS,
reines HTML/CSS, keine Build-Tools). Daten werden als JSON-Dateien auf der Nextcloud der OG
gespeichert und via WebDAV gelesen und geschrieben. Die App läuft im Browser, benötigt keinen
eigenen Server und arbeitet nach dem ersten Laden auch offline.

**Nextcloud-Dateistruktur:**
```
/LifeguardOrders/
  artikel.json       ← Artikelkatalog
  bestellungen.json  ← Sammelbestellungen mit Wünschen, CSV-Export, Rechnungen
  materialbestand.json ← Lager- und Materialposten der OG
  einstellungen.json ← OG-Daten, Förderrate, zählende Einsatztypen

/LifeguardClock/
  lgc_*.json         ← Stempeluhr-Exports (nur lesen)
```

**Seitenstruktur (je eine HTML-Datei):**
```
index.html                ← Navigation / Startseite mit Kacheln und Live-Statistiken
artikel.html              ← Artikelkatalog: CRUD + Import (Auftragsbestätigung & Produktseite)
bestellungen.html         ← Übersicht aller Sammelbestellungen mit Phase und Status
materialbestand.html      ← Materialbestand: Lagerposten mit Nummer, Variante, Menge und Status
bestellung-neu.html       ← Neue Sammelbestellung anlegen (Datum, Bezeichnung)
bestellung-sammeln.html   ← Phase 1: Mitgliederwünsche erfassen + CSV-Export für Materialstelle
bestellung-abgleich.html  ← Phase 2+3: Rechnungsimport, Abgleich, Anprobe, Abschluss
rechnungen.html           ← Rechnungsübersicht + PDF-Erzeugung + Zahlungsstatus
kassenwart.html           ← Kassenwart-Übersicht + PDF/CSV-Export
dashboard.html            ← Einsatzstunden-Dashboard
einstellungen.html        ← Konfiguration (NC, OG-Stammdaten, Mitglieder, Stundensatz)
```

**Workflow (mit finaler Anprobe vor Rechnung):**
```
Phase 1 — Sammlung:
  Admin legt Sammelbestellung an →
  Erfasst Wünsche: Mitglied + Basisartikel (Nummer + Bezeichnung aus Katalog) + Variante + Menge →
  Optional: markiert Wunsch als "OG übernimmt Kosten" →
  System aggregiert: Artikel XL: 3 Stk. gesamt →
  CSV-Export: "18507110,XL,3" pro Zeile → Admin kopiert in Materialstelle-Bestellformular

Phase 2 — Eingang (nach Lieferung):
  Admin öffnet Sammelbestellung →
  Importiert Materialstelle-Rechnung (gleicher Parser) →
  System gleicht ab: Rechnung ↔ Wunschliste (nach artikelNr + variante) →
  Abweichungen (mehr/weniger geliefert) → Review-Ansicht mit "Menge übernehmen" oder "Ignorieren" →
  Gematchte Positionen → Bestellung wechselt in "Anprobe"

Phase 3 — Anprobe / finale Verteilung:
  Admin prüft gelieferte Positionen →
  Ändert die finale Verteilung zwischen Mitgliedern →
  Markiert Teilmengen als Retoure oder Lagerbestand →
  Bestellung ist erst abschließbar wenn jede gelieferte Menge vollständig
  einer finalen Verwendung zugeordnet ist

Phase 4 — Abschluss & Rechnungen:
  Admin schließt die Anprobe ab →
  Erst danach werden Rechnungen je Mitglied erzeugt →
  Kassenwart-Übersicht und Dashboard nutzen die finale Verteilung
```

**Mitgliederliste:** Wird einmalig aus der `config.js` der Stempeluhr übernommen (gleiche IDs,
gleiche Namen). Sie ist die einzige Quelle der Wahrheit für Personen in beiden Apps.
Einzelne Mitglieder können auch manuell als JSON-Objekt (`{"id": "...", "name": "..."}`) eingetragen
werden — der Parser versteht beide Formate.

---

## User Stories

### Ersteinrichtung

1. Als Admin möchte ich beim ersten Start geführt werden, OG-Stammdaten einzutragen (Name,
   Adresse, IBAN, Steuernr., Vorstand), damit Rechnungen sofort korrekte Kopfdaten haben.
2. Als Admin möchte ich Nextcloud-Zugangsdaten (URL, Benutzer, App-Passwort) in den
   Einstellungen hinterlegen, damit die App auf die Dateiablage zugreift.
3. Als Admin möchte ich die Mitgliederliste aus der Stempeluhr-`config.js` importieren
   (Copy-Paste der Array-Einträge oder Datei-Upload), damit ich nicht alle Namen neu eingeben muss.
   Der Parser erkennt sowohl JS-Literal-Syntax (`id: 'value'`) als auch JSON-Syntax (`"id": "value"`),
   sodass einzelne Mitglieder auch manuell als JSON-Objekt eingetragen werden können.
4. Als Admin möchte ich sehen, ob die Nextcloud-Verbindung funktioniert (Verbindungstest),
   damit ich Konfigurationsfehler früh erkennen kann.

### Artikelverwaltung

5. Als Admin möchte ich den Artikelkatalog als Liste sehen mit Artikel-Nr., Größe/Variante,
   Name, Einzelpreis (brutto), BV-Förderung, LV-Förderung und OG-Förderung je Eintrag.
6. Als Admin möchte ich eine Auftragsbestätigung der Materialstelle (Tab-getrennt oder
   mehrzeilig) in ein Eingabefeld einfügen und automatisch parsen lassen.
7. Als Admin möchte ich eine Produktdetailseite der Materialstelle einfügen und alle
   verfügbaren Größen/Varianten automatisch als separate Katalogeinträge importieren,
   damit ich nicht jede Größe einzeln anlegen muss.
8. Als Admin möchte ich, dass beim Produktseitenimport BV- und LV-Förderung automatisch
   erkannt und übernommen werden.
9. Als Admin möchte ich, dass der Parser `MITTELVERW. BV`-Zeilen als BV-Förderung und
   `MITTELVERW. LV`-Zeilen als LV-Förderung dem jeweils vorherigen Artikel zuordnet.
10. Als Admin möchte ich, dass Zeilen mit `VERSANDKOSTEN` und `EILAUFTRAG` beim Import als
    OG-Kostenposten markiert werden und nicht im Artikelkatalog landen.
11. Als Admin möchte ich, dass Artikel mit Menge 0 beim Import automatisch übersprungen werden.
12. Als Admin möchte ich die OG-Förderung pro Artikel als festen Betrag oder als Checkbox
    "OG übernimmt Rest" festlegen können.
13. Als Admin möchte ich Artikel manuell neu anlegen (Formular mit allen Feldern inkl. Variante).
14. Als Admin möchte ich Artikel bearbeiten und löschen können.
15. Als Admin möchte ich bei einem leeren Artikelkatalog einen deutlichen Hinweistext sehen.

### Sammelbestellung — Phase 1: Sammlung

16. Als Admin möchte ich eine neue Sammelbestellung anlegen mit Datum und Bezeichnung.
17. Als Admin möchte ich in einer Sammelbestellung Mitgliederwünsche erfassen:
    Mitglied auswählen (Dropdown), Basisartikel aus dem Katalog suchen
    (`Nummer + Bezeichnung`), danach die Variante wählen und die Menge angeben.
18. Als Admin möchte ich in derselben Bestellung für verschiedene Mitglieder und Artikel
    beliebig viele Wunschzeilen hinzufügen.
19. Als Admin möchte ich eine aggregierte Ansicht sehen: welche Artikel in welcher Variante
    wie oft insgesamt bestellt werden sollen (Summe über alle Mitglieder).
20. Als Admin möchte ich einen CSV-Export der aggregierten Bestellliste erhalten im Format
    `artikelNr,variante,menge` (eine Zeile pro Artikel+Variante), den ich in das
    Bestellformular der Materialstelle einfügen kann.
21. Als Admin möchte ich eine bestehende Sammelbestellung nachträglich bearbeiten
    (Wünsche hinzufügen, ändern, löschen), solange Phase 2 noch nicht begonnen hat;
    dabei soll dieselbe Artikel-/Varianten-Auswahl gelten wie beim Neuanlegen.
22. Als Admin möchte ich mehrere Sammelbestellungen gleichzeitig offen haben können.
23. Als Admin möchte ich einen Wunsch als "OG übernimmt Kosten" markieren können,
    damit der Mitgliedsanteil auf 0 € gesetzt und der Rest vollständig der OG zugerechnet wird.

### Sammelbestellung — Phase 2: Eingang & Abgleich

24. Als Admin möchte ich nach Lieferung die Materialstelle-Rechnung in die Sammelbestellung
    importieren (gleicher Parser wie Artikelkatalog).
25. Als Admin möchte ich, dass das System die importierten Rechnungspositionen automatisch
    den Mitgliederwünschen zuordnet (nach artikelNr + variante).
26. Als Admin möchte ich Abweichungen zwischen Rechnung und Wunschliste in einer
    Review-Ansicht sehen: zu viel geliefert, zu wenig geliefert, nicht bestellt.
27. Als Admin möchte ich Mengenabweichungen bewusst entweder als gelieferte Menge
    übernehmen oder vollständig ignorieren können, damit "Ignorieren" keine stillschweigende
    Mengenanpassung auslöst.
28. Als Admin möchte ich nach dem Abgleich eine eigene Anprobe-Phase haben, in der ich
    die finale Verteilung der gelieferten Positionen bearbeite, bevor Rechnungen erzeugt werden.
29. Als Admin möchte ich, dass Versandkosten und Eilauftrag in der Bestellung sichtbar sind,
    als OG-Kosten ausgewiesen werden und nicht in Mitgliedsrechnungen fließen.
30. Als Admin möchte ich in der Anprobe eine gelieferte Position ganz oder teilweise einem
    anderen Mitglied zuweisen können als dem ursprünglichen Besteller.
31. Als Admin möchte ich in der Anprobe Teilmengen als Retoure oder Lagerbestand markieren
    können, damit diese Mengen nicht in Mitgliedsrechnungen landen.
32. Als Admin möchte ich eine Sammelbestellung erst dann als "abgeschlossen" markieren,
    wenn alle gelieferten Mengen vollständig verteilt, retourniert oder dem Lagerbestand
    zugeordnet sind.

### Rechnungen

33. Als Admin möchte ich alle Rechnungen in einer Übersicht sehen (Mitglied, Nummer,
    Betrag, Datum, Status: offen / bezahlt).
34. Als Admin möchte ich, dass die Rechnung das Layout der bestehenden Vorlage hat:
    DLRG-Logo, OG-Adresse, Empfängeradresse, Positionstabelle, Gesamtbetrag,
    MwSt.-Hinweis, Zahlungsfrist 14 Tage, Bankdaten, Fußbereich.
35. Als Admin möchte ich, dass Rechnungen automatisch nummeriert werden im Format
    `R_YYYY_MM_NNN` (fortlaufend pro Monat).
36. Als Admin möchte ich, dass auf der Rechnung nur der Mitgliedsanteil (nach Förderabzug)
    erscheint sowie die erwarteten Einsatzstunden für die OG-Förderung.
37. Als Admin möchte ich die Rechnung als PDF herunterladen.
38. Als Admin möchte ich eine bereits erzeugte Rechnung erneut als PDF abrufen.
39. Als Admin möchte ich eine Rechnung als "bezahlt" markieren (mit Zahlungsdatum).
40. Als Admin möchte ich eine Zahlung rückgängig machen können (zurück auf offen).
41. Als Admin möchte ich sehen, wie viel Gesamtbetrag noch offen ist.

### Kassenwart-Übersicht

42. Als Admin möchte ich eine Kassenwart-Übersicht mit allen Positionen aller Bestellungen:
    Mitglied, Artikel, Bruttobetrag, BV, LV, OG, Mitgliedsanteil, Zahlungsstatus.
43. Als Admin möchte ich Summenzeilen sehen: BV-Gesamt, LV-Gesamt, OG-Gesamt,
    Mitglieder-Gesamt, davon offen / bezahlt.
44. Als Admin möchte ich, dass die Kassenwart-Übersicht historische Förderwerte aus der
    gespeicherten Bestellung verwendet, damit spätere Katalogänderungen alte Abschlüsse
    nicht rückwirkend verfälschen.
45. Als Admin möchte ich die Übersicht nach Kalenderjahr filtern.
46. Als Admin möchte ich die Übersicht als PDF exportieren.
47. Als Admin möchte ich die Übersicht als CSV exportieren (für Excel).

### Einsatzstunden-Dashboard

48. Als Admin möchte ich beim Öffnen des Dashboards automatisch alle LifeguardClock-JSON-Dateien
    aus `/LifeguardClock/` einlesen, ohne manuellen Import.
49. Als Admin möchte ich je Mitglied die Summe der geleisteten Einsatzstunden sehen
    (zählende Typen: wachdienst, sanitaetsdienst, helfer, verwaltung — nicht anwesenheit).
50. Als Admin möchte ich je Mitglied die offene Stundenschuld aus OG-Förderungen sehen
    (OG-Betrag € ÷ 10 × 3 Stunden).
51. Als Admin möchte ich sehen, bis wann die Stundenpflicht erfüllt sein muss:
    31.12. des Bestelljahres + 1 Kulanzjahr.
52. Als Admin möchte ich, dass bei mehreren offenen Bestellungen die geleisteten Stunden
    zuerst der ältesten Schuld angerechnet werden.
53. Als Admin möchte ich, dass die Ampel die Frist der ältesten noch offenen Schuld
    verwendet und nicht bereits erledigte Altlasten berücksichtigt.
54. Als Admin möchte ich je Mitglied eine Ampel sehen: grün = abgearbeitet, gelb = Frist
    läuft, rot = Frist überschritten.
55. Als Admin möchte ich je Mitglied den genauen Stand sehen: geleistete / benötigte
    Stunden, Differenz, Frist.
56. Als Admin möchte ich Mitglieder ohne OG-Förderung ausblenden können.
57. Als Admin möchte ich LifeguardClock-Einträge über `userId` oder über das Feld `nutzer`
    (Vollname, normalisiert) zuordnen können und unbekannte Namen markiert sehen.

### Einstellungen

58. Als Admin möchte ich alle OG-Stammdaten pflegen: Name, LV, Bezirk, Adresse, E-Mail,
    Website, IBAN, BIC, Bank, Amtsgericht, Steuernummer, Vorstandsnamen, Finanzverantwortliche.
59. Als Admin möchte ich den Einsatzstunden-Umrechnungsschlüssel konfigurieren
    (Standard: 3 Stunden = 10 €).
60. Als Admin möchte ich konfigurieren, welche Einsatztypen für die Stundenpflicht zählen.
61. Als Admin möchte ich die Nextcloud-Zugangsdaten ändern können.
62. Als Admin möchte ich die Einstellungen lokal im `localStorage` speichern.

### Fehler- und Leerzustände

63. Als Admin möchte ich bei fehlendem Netzwerk eine klare Fehlermeldung sehen und mit
    gecachten Daten weiterarbeiten können.
64. Als Admin möchte ich bei fehlerhaftem Import-Text eine verständliche Fehlermeldung erhalten.
65. Als Admin möchte ich auf jeder leeren Listenseite einen erklärenden Hinweis sehen.

---

## Implementation Decisions

### Datenmodell (JSON-Schemas)

**`artikel.json`** — Array von Artikeln:
```
id              string   — UUID, intern generiert
artikelNr       string   — Artikel-Nr. aus Materialstelle (z.B. "18507110")
variante        string   — Größe/Variante-Code (z.B. "XL", "MAGNET", "46") oder ""
name            string   — Produktname ohne Größe
einzelpreis     number   — Bruttobetrag in €
bvFoerderung    number   — € pro Stück, 0 wenn keine Förderung
lvFoerderung    number   — € pro Stück, 0 wenn keine Förderung
ogFoerderung    number   — € pro Stück, 0 wenn keine OG-Förderung
ogUebernimmtRest boolean — true = og = (preis − bv − lv)
```
Deduplizierung: `artikelNr + variante` (= ein Katalogeintrag pro Größe/Variante).

**`bestellungen.json`** — Array von Sammelbestellungen:
```
id            string
datum         string    — ISO-Datum (Bestelldatum Phase 1)
bezeichnung   string
status        enum      — "sammlung" | "bestellt" | "anprobe" | "abgeschlossen"
wuensche[]              — Phase 1: Mitgliederwünsche
  id          string
  mitgliedId  string
  artikelNr   string
  variante    string
  name        string
  menge       number
  ogKostenlos boolean   — true = Mitglied zahlt 0 €, OG übernimmt den Rest
positionen[]            — Phase 2+3: aus Rechnungsimport, danach finale Verteilung in der Anprobe
  id          string
  artikelNr   string
  variante    string
  name        string
  menge       number
  einzelpreis number
  bvFoerderung number
  lvFoerderung number
  ogFoerderung number
  ogUebernimmtRest boolean
  foerderungGespeichert boolean — true = Snapshot enthält vollständige Förderdaten
  typ         enum      — "artikel" | "og-kosten"
  retoureMenge number   — Menge, die an die Materialstelle zurückgeht
  ogBestandMenge number — Menge, die bei der OG verbleibt und nicht verrechnet wird (fachlich: Lagerbestand)
  zuweisung[]           — Verteilung auf Mitglieder
    mitgliedId string
    menge      number
    ogKostenlos boolean
rechnungen[]
  id          string
  nummer      string    — "R_YYYY_MM_NNN"
  datum       string
  mitgliedId  string
  positionen[]          — Snapshot der zugewiesenen Positionen
  gesamtbetrag number
  bezahlt     boolean
  bezahltDatum string | null
```

**`einstellungen.json`**:
```
og{}           — alle OG-Stammdaten (Name, Adresse, IBAN, ...)
stundenRate{}  — { stunden: 3, euro: 10 }
einsatztypen[] — z.B. ["wachdienst", "sanitaetsdienst", "helfer", "verwaltung"]
mitglieder[]   — [{ id, name }] — importiert aus Stempeluhr config.js
nc{}           — { url, user, pass }
```

**`materialbestand.json`** — Array von Lagerposten:
```
id                  string
nummer              string   — Nummer der Materialstelle
bezeichnung         string   — Bezeichnung wie bei der Materialstelle
variante            string   — Größe / Variante oder ""
menge               number   — aktueller Bestand bei der OG
status              enum     — "aktiv" | "aufgebraucht" | "ausgesondert"
lagerort            string   — optional
herkunftBestellungId string  — optional, Referenz auf die Bestellung oder Freitext
notiz               string   — optional
bewegungen[]        — Bestandsbewegungen, neueste zuerst
  id                string
  typ               enum     — "zugang" | "abgang" | "storno"
  menge             number
  timestamp         string   — ISO-Zeitstempel
  quelle            string   — z. B. "bestellung-abschluss" | "manuell"
  referenz          string   — optional, z. B. Bestell-ID
  notiz             string   — optional
```

**Artikel-/Varianten-Auswahl in der UI**
- Sammelbestellung (`bestellung-sammeln.html`): erst Suche nach Basisartikel über `Nummer + Bezeichnung`, danach separate Variantenauswahl
- Materialbestand (`materialbestand.html`): gleicher Ablauf; alternativ bleiben Nummer, Bezeichnung und Variante manuell editierbar
- Die fachliche Datenbasis bleibt trotzdem `artikelNr + variante`; die zweistufige Auswahl dient nur der besseren Bedienbarkeit bei vielen Größen

### Import-Parser

Drei Formate, automatisch erkannt (`parseBestellung(text)`):

1. **Produktdetailseite** (enthält `Artikelnummer: XXXXXXXX`):
   - Name aus letzter Titelzeile vor Artikelnummer
   - Varianten aus eingerückter Zeile zwischen Artikelnummer und "Beschreibung"
   - `Dein Preis:` oder `Preis ab:` → einzelpreis
   - `Mittelverwendung Bundesverband...` → bvFoerderung
   - `Mittelverwendung LV...` → lvFoerderung
   - Gibt einen Artikel pro Variante zurück

2. **Auftragsbestätigung mehrzeilig** (Preis-Zeilen allein mit €-Zeichen):
   - State machine: Artikelzeile + 3 Preiszeilen (Einzelpreis, Netto, Summe)
   - MITTELVERW. BV / LV → Förderung für vorherigen Artikel
   - VERSANDKOSTEN / EILAUFTRAG → ogKosten[]

3. **Tab-Format** (Tab-getrennte Spalten):
   - Für Tests und saubere Exporte

### CSV-Export (Phase 1)

Format: `artikelNr,variante,menge` — eine Zeile pro aggregierter Artikel+Variante-Kombination
(Summe über alle Mitgliederwünsche). Groß/Kleinschreibung der Variante wie im Katalog gespeichert
(Materialstelle erwartet Großschreibung — wird beim Speichern normiert).

### Abgleich (Phase 2)

Match-Schlüssel: `artikelNr + variante`. Algorithmus:
- Für jede Rechnungsposition: suche Wunsch mit gleichem Schlüssel
- Menge stimmt → direkt zuweisen
- Menge weicht ab → Review-Flag mit expliziter Aktion `uebernehmen` oder `ignorieren`
- Keine Wunsch-Entsprechung → Review-Flag "nicht bestellt"
- Wunsch ohne Rechnungsposition → Review-Flag "nicht geliefert"
- Nur `uebernehmen` erzeugt beim Abschließen eine reale Positionszeile; `ignorieren`
  dokumentiert die Abweichung, übernimmt aber keine Menge in die Bestellung

### Anprobe / finale Verteilung (Phase 3)

- Grundlage sind die in Phase 2 übernommenen `positionen[]`
- `zuweisung[]` beschreibt die finale Verteilung, nicht zwingend die ursprüngliche Wunschlage
- Während der Anprobe können Mengen zwischen Mitgliedern umgehängt werden
- `retoureMenge` und `ogBestandMenge` sind explizite Restverwendungen und fließen nicht in
  Mitgliedsrechnungen
- Eine Bestellung ist erst abschließbar, wenn für jede Artikelposition gilt:
  `summe(zuweisung.menge) + retoureMenge + ogBestandMenge = menge`

Hinweis: Der interne Feldname `ogBestandMenge` bleibt aus Kompatibilitätsgründen bestehen.
Im Workflow und in der UI wird dieser Wert als `Lagerbestand` bezeichnet und kann später
an eine separate Material-/Lagerverwaltung angebunden werden.

Beim Abschluss einer Bestellung werden Lagerbestandsmengen automatisch in `materialbestand.json`
gebucht. Bestehende Lagerposten werden über `nummer + variante + bezeichnung` zusammengeführt.
Manuelle Zugänge und Abgänge werden ebenfalls direkt am Lagerposten gebucht und als
Bestandsbewegungen protokolliert.
Verkäufe aus dem Lager erzeugen eine eigene abgeschlossene Bestellung mit Rechnung; Preise und
Förderungen kommen dabei aus dem aktuellen Artikelkatalog der Materialstelle.

Beim manuellen Anlegen eines Lagerpostens wird optional derselbe Katalog-Workflow wie in der
Sammelbestellung angeboten: erst Basisartikel suchen, dann Variante wählen. Freie Eingabe bleibt
für Sonderfälle erlaubt.

### Rechnungen (Phase 4)

- Rechnungen dürfen erst nach Status `abgeschlossen` erzeugt werden
- Abgerechnet werden ausschließlich die finalen `zuweisung[]`-Mengen der Bestellung

### Förderberechnung

`berechneFoerderung(artikel, menge, opts?) → { bv, lv, og, mitglied, gesamt }`.
`ogUebernimmtRest: true` → `og = einzelpreis − bv − lv`.
`ogKostenlos: true` → `mitglied = 0`, OG übernimmt den verbleibenden Rest. Auf 2 Dezimalstellen gerundet.

### Einsatzstunden-Berechnung

`berechneStunden(logEntries[], einsatztypen[]) → Map<mitgliedId, stunden>`.
Zuordnung erfolgt über `userId`/`user_id` oder, falls nicht vorhanden, über das normalisierte
`nutzer`-Feld gegen die Mitgliederliste.
Schulden-Verrechnung: `verechneSchuld(mitgliedId, bestellungen[], geleisteteStunden)`
→ chronologisch, älteste Schuld zuerst. Die Ampel-Frist richtet sich nach der ältesten
noch offenen Schuld.

### PDF-Erzeugung

Im Browser via `jsPDF`. Layout nach Vorlage `R_2025_07_001_Kammler.pdf`.
Rechnung zeigt: Mitgliedsanteil (nach Förderabzug) + erwartete Einsatzstunden für OG-Anteil.

### Rechnungsnummerierung

Format `R_YYYY_MM_NNN`. Höchstzähler wird aus allen existierenden Rechnungsnummern berechnet.

### WebDAV-Client

`createWebDavClient(creds, fetchFn)` — Factory-Pattern für Testbarkeit. Alle Fehler als
strukturierte Objekte (`{ ok: false, error }`), keine Exceptions.

---

## Testing Decisions

Tests prüfen externes Verhalten durch öffentliche Funktionen — überleben Refactorings.

**Prioritäre Testbereiche:**

1. **Import-Parser** — alle drei Formate, LV-Erkennung, Variantenzeile, Menge-0, ogKosten
2. **Förderberechnung** — ogUebernimmtRest, Rundung, Menge > 1
3. **Abgleich** — Match, Mengenabweichung, nicht bestellt, nicht geliefert, `uebernehmen` vs. `ignorieren`
4. **Stunden-Matching** — anwesenheit nicht zählen, unbekannte Nutzer, `nutzer`-Fallback
5. **Schulden-Verrechnung** — chronologische Tilgung, Teilerfüllung, Frist der ältesten offenen Schuld
6. **Kassenwart-Snapshots** — gespeicherte Förderwerte vor Live-Katalog
7. **Rechnungsnummerierung** — Monatsreset, fortlaufend
8. **Materialbestand** — Normalisierung, Statuswechsel und Bestands-Summen

---

## Out of Scope

- Self-Service-Portal für Mitglieder
- Direktanbindung DLRG-Bundesshop / Materialstelle API
- DATEV- oder Buchhaltungsexport
- E-Mail-Versand von Rechnungen *(geplante spätere Erweiterung)*
- Multi-User-Login / Rollenverwaltung *(geplante spätere Erweiterung)*
- Native Mobile App
- Automatischer Kontoabgleich

---

## Further Notes

- **OG-Stammdaten für Rechnung:** Landesverband Baden, Bezirk Enz, OG-Schellbronn e.V.,
  Nagoldstr. 47, 75242 Neuhausen, IBAN DE57 6619 0000 0033 5861 08, BIC GENODE61KA1,
  Volksbank pur eG, Amtsgericht Mannheim 501097, Steuernr. 41435/55802.
- **Stempeluhr-Referenz:** `C:\GitHub\Stempeluhr\stempeluhr\` — Code-Stil und WebDAV-Pattern.
- **Parser-Robustheit:** Format der Materialstelle-Seite kann variieren — Parser wird
  laufend mit neuen Beispielen trainiert.
- **NC-Sync-Strategie:** localStorage ist primärer Cache. NC wird beim Laden gelesen
  (nur wenn nicht leer) und beim Speichern geschrieben. Lokale Daten verlieren nie gegen
  ein leeres NC-Ergebnis.
