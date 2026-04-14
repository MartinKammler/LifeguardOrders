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
  bestellungen.json  ← Sammelbestellungen, Positionen, Zuweisungen, Rechnungen
  einstellungen.json ← OG-Daten, Förderrate, zählende Einsatztypen

/LifeguardClock/
  lgc_*.json         ← Stempeluhr-Exports (nur lesen)
```

**Seitenstruktur (je eine HTML-Datei):**
```
index.html          ← Navigation / Startseite
artikel.html        ← Artikelkatalog
bestellungen.html   ← Sammelbestellungen-Übersicht
bestellung-neu.html ← Import + Mitglieder-Zuweisung
rechnungen.html     ← Rechnungsübersicht + PDF-Erzeugung
kassenwart.html     ← Kassenwart-Übersicht + Export
dashboard.html      ← Einsatzstunden-Dashboard
einstellungen.html  ← Konfiguration
```

**Mitgliederliste:** Wird einmalig aus der `config.js` der Stempeluhr übernommen (gleiche IDs,
gleiche Namen). Sie ist die einzige Quelle der Wahrheit für Personen in beiden Apps.

---

## User Stories

### Ersteinrichtung

1. Als Admin möchte ich beim ersten Start geführt werden, OG-Stammdaten einzutragen (Name,
   Adresse, IBAN, Steuernr., Vorstand), damit Rechnungen sofort korrekte Kopfdaten haben.
2. Als Admin möchte ich Nextcloud-Zugangsdaten (URL, Benutzer, App-Passwort) in den
   Einstellungen hinterlegen, damit die App auf die Dateiablage zugreift.
3. Als Admin möchte ich die Mitgliederliste aus der Stempeluhr-`config.js` importieren
   (Copy-Paste der Array-Einträge oder Datei-Upload), damit ich nicht alle Namen neu eingeben muss.
4. Als Admin möchte ich sehen, ob die Nextcloud-Verbindung funktioniert (Verbindungstest),
   damit ich Konfigurationsfehler früh erkennen kann.

### Artikelverwaltung

5. Als Admin möchte ich den Artikelkatalog als Liste sehen mit Artikel-Nr., Name,
   Einzelpreis (brutto), BV-Förderung, LV-Förderung und OG-Förderung je Eintrag.
6. Als Admin möchte ich eine Auftragsbestätigung der Materialstelle als Tab-getrennten Text
   in ein Eingabefeld einfügen und automatisch parsen lassen, damit Artikel samt Förderbeträgen
   erkannt werden.
7. Als Admin möchte ich, dass der Parser `MITTELVERW. BV`-Zeilen als BV-Förderung und
   `MITTELVERW. LV`-Zeilen als LV-Förderung dem jeweils vorherigen Artikel zuordnet.
8. Als Admin möchte ich, dass Zeilen mit `VERSANDKOSTEN` und `EILAUFTRAG` beim Import als
   OG-Kostenposten markiert werden und nicht im Artikelkatalog landen.
9. Als Admin möchte ich, dass Artikel mit Menge 0 beim Import automatisch übersprungen werden.
10. Als Admin möchte ich nach dem Import die erkannten Artikel prüfen und einzeln bearbeiten
    (Name, Preis, Förderbeträge korrigieren), bevor sie gespeichert werden.
11. Als Admin möchte ich die OG-Förderung pro Artikel als festen Betrag oder als Checkbox
    "OG übernimmt Rest" festlegen können.
12. Als Admin möchte ich Artikel manuell neu anlegen (Formular mit allen Feldern), damit
    ich den Katalog jederzeit erweitern kann.
13. Als Admin möchte ich Artikel bearbeiten und löschen können.
14. Als Admin möchte ich bei einem leeren Artikelkatalog einen deutlichen Hinweistext sehen,
    damit ich weiß, wie ich starte.

### Sammelbestellung erfassen

15. Als Admin möchte ich eine neue Sammelbestellung anlegen mit Datum und einer frei wählbaren
    Bezeichnung (z. B. "Bestellung März 2025").
16. Als Admin möchte ich in einer Sammelbestellung Zeilen aus einer Auftragsbestätigung
    importieren (gleicher Parser wie Artikelkatalog), damit ich nicht doppelt eintippe.
17. Als Admin möchte ich jede importierte Position einer Sammelbestellung einem Mitglied
    zuweisen (Dropdown mit Mitgliederliste).
18. Als Admin möchte ich eine Position mit Menge > 1 auf mehrere Mitglieder aufteilen, indem
    ich pro Mitglied eine Teilmenge angebe, bis die Gesamtmenge verteilt ist.
19. Als Admin möchte ich sehen, welche Positionen noch nicht vollständig zugewiesen sind
    (visuell hervorgehoben), damit mir keine Zuweisung fehlt.
20. Als Admin möchte ich pro zugewiesener Position sehen: Bruttobetrag, BV-Abzug, LV-Abzug,
    OG-Abzug und den verbleibenden Mitgliedsanteil.
21. Als Admin möchte ich, dass Versandkosten und Eilauftrag in der Sammelbestellung sichtbar
    sind, aber als OG-Kosten ausgewiesen werden und nicht in Mitgliedsrechnungen fließen.
22. Als Admin möchte ich eine Sammelbestellung als "abgeschlossen" markieren, sobald alle
    Positionen zugewiesen und alle Rechnungen erstellt sind.
23. Als Admin möchte ich mehrere Sammelbestellungen gleichzeitig offen haben können.
24. Als Admin möchte ich eine bestehende Sammelbestellung nachträglich bearbeiten (Positionen
    hinzufügen, Zuweisungen ändern), solange sie noch nicht abgeschlossen ist.

### Rechnungen

25. Als Admin möchte ich aus einer Sammelbestellung heraus für jedes zugewiesene Mitglied
    eine Rechnung erzeugen lassen (einzeln oder alle auf einmal).
26. Als Admin möchte ich, dass die Rechnung im Layout der bestehenden Rechnungen erscheint:
    DLRG-Logo, OG-Adresse rechts, Empfängeradresse links, Tabelle mit Anzahl/Bezeichnung/
    Einzelpreis/Gesamtpreis, Gesamtbetrag (Brutto), MwSt.-Hinweis, Zahlungsfrist 14 Tage,
    Bankdaten und rechtliche Angaben im Fußbereich.
27. Als Admin möchte ich, dass Rechnungen automatisch nummeriert werden im Format `R_YYYY_MM_NNN`
    (fortlaufend pro Monat), damit sie eindeutig referenzierbar sind.
28. Als Admin möchte ich, dass auf der Rechnung nur der vom Mitglied zu zahlende Betrag
    erscheint (nach Abzug aller Förderungen) — keine Förderdetails, die das Mitglied
    nicht sehen muss.
29. Als Admin möchte ich die erzeugte Rechnung als PDF herunterladen können.
30. Als Admin möchte ich eine bereits erzeugte Rechnung erneut als PDF abrufen können.
31. Als Admin möchte ich eine Vorschau der Rechnung sehen, bevor ich sie finalisiere.

### Zahlungsverfolgung

32. Als Admin möchte ich alle Rechnungen in einer Übersicht sehen (Mitglied, Rechnungsnummer,
    Betrag, Datum, Status: offen / bezahlt).
33. Als Admin möchte ich eine Rechnung als "bezahlt" markieren mit Eingabe des Zahlungsdatums.
34. Als Admin möchte ich eine Zahlung als "bezahlt" rückgängig machen können (zurück auf offen).
35. Als Admin möchte ich die Rechnungsübersicht nach Status (offen/bezahlt) und nach Mitglied
    filtern können.
36. Als Admin möchte ich sehen, wie viel Gesamtbetrag noch offen ist, damit ich den
    Liquiditätsbedarf kenne.

### Kassenwart-Übersicht

37. Als Admin möchte ich eine Kassenwart-Übersicht erzeugen, die alle Positionen aller
    Sammelbestellungen tabellarisch zeigt: Mitglied, Artikel, Bruttobetrag, BV-Förderung,
    LV-Förderung, OG-Förderung, Mitgliedsanteil, Zahlungsstatus.
38. Als Admin möchte ich in der Kassenwart-Übersicht Summenzeilen sehen: BV-Gesamtbetrag,
    LV-Gesamtbetrag, OG-Gesamtbetrag, Mitglieder-Gesamtbetrag, davon offen / bezahlt.
39. Als Admin möchte ich die Kassenwart-Übersicht nach Zeitraum (z. B. Kalenderjahr) filtern.
40. Als Admin möchte ich die Kassenwart-Übersicht als PDF exportieren.
41. Als Admin möchte ich die Kassenwart-Übersicht als CSV exportieren, damit der Kassenwart
    sie in Excel weiterverarbeiten kann.

### Einsatzstunden-Dashboard

42. Als Admin möchte ich beim Öffnen des Dashboards automatisch alle LifeguardClock-JSON-Dateien
    aus `/LifeguardClock/` auf der Nextcloud eingelesen bekommen, ohne einen Import-Button
    drücken zu müssen.
43. Als Admin möchte ich je Mitglied die Summe der geleisteten Einsatzstunden sehen, wobei
    die Typen `wachdienst`, `sanitaetsdienst`, `helfer` und `verwaltung` zählen,
    `anwesenheit` jedoch nicht.
44. Als Admin möchte ich je Mitglied die offene Stundenschuld aus OG-Förderungen sehen,
    berechnet als: OG-Förderbetrag (€) ÷ 10 × 3 Stunden.
45. Als Admin möchte ich sehen, bis wann die Stundenverpflichtung einer Bestellung erfüllt
    sein muss: 31.12. des Bestelljahres + 1 Kulanzjahr = 31.12. des Folgejahres.
46. Als Admin möchte ich, dass bei einem Mitglied mit mehreren offenen Sammelbestellungen
    die geleisteten Stunden zuerst der ältesten Schuld angerechnet werden.
47. Als Admin möchte ich je Mitglied eine Ampel-Anzeige sehen: grün = Schuld vollständig
    abgearbeitet, gelb = Frist läuft noch, rot = Frist überschritten und Schuld offen.
48. Als Admin möchte ich je Mitglied den genauen Stand sehen: geleistete Stunden,
    benötigte Stunden, Differenz (übrig oder Schuld), Frist.
49. Als Admin möchte ich Mitglieder ohne OG-Förderung im Dashboard ausblenden können, damit
    die Ansicht übersichtlich bleibt.
50. Als Admin möchte ich, dass LifeguardClock-Einträge, deren `nutzer`-Name keinem Mitglied
    zugeordnet werden kann, als "unbekannte Person" markiert werden, damit ich Datenfehler
    erkennen kann.

### Einstellungen

51. Als Admin möchte ich alle OG-Stammdaten in den Einstellungen pflegen: Name, Landesverband,
    Bezirk, Adresse, E-Mail, Website, IBAN, BIC, Bank, Amtsgericht, Steuernummer,
    Vorstandsnamen und Finanzverantwortliche.
52. Als Admin möchte ich den Einsatzstunden-Umrechnungsschlüssel konfigurieren
    (Standard: 3 Stunden = 10 €), damit eine spätere Änderung kein Code-Update erfordert.
53. Als Admin möchte ich konfigurieren, welche Einsatztypen für die Stundenpflicht zählen,
    damit ich Anpassungen ohne Entwickler vornehmen kann.
54. Als Admin möchte ich die Nextcloud-Zugangsdaten in den Einstellungen ändern können.
55. Als Admin möchte ich die Einstellungen lokal im Browser-`localStorage` speichern, damit
    sie nach einem Neustart ohne erneute Eingabe verfügbar sind.

### Fehler- und Leerszustände

56. Als Admin möchte ich bei fehlendem Netzwerk/WebDAV eine klare Fehlermeldung sehen und
    mit den zuletzt gecachten Daten weiterarbeiten können.
57. Als Admin möchte ich bei einem fehlerhaften Import-Text eine verständliche Fehlermeldung
    erhalten, die beschreibt, welche Zeile nicht geparst werden konnte.
58. Als Admin möchte ich auf jeder leeren Listenseite (kein Artikel, keine Bestellung,
    keine Rechnung) einen erklärenden Hinweis sehen, was als nächstes zu tun ist.

---

## Implementation Decisions

### Datenmodell (JSON-Schemas)

**`artikel.json`** — Array von Artikeln:
```
id            string   — UUID, intern generiert
artikelNr     string   — Artikel-Nr. aus Materialstelle (z.B. "29510012")
name          string
einzelpreis   number   — Bruttobetrag in €
netto         number   — Nettobetrag (exkl. MwSt.)
bvFoerderung  number   — € pro Stück, 0 wenn keine Förderung
lvFoerderung  number   — € pro Stück, 0 wenn keine Förderung
ogFoerderung  number   — € pro Stück, 0 wenn keine OG-Förderung
ogUebernimmtRest boolean — true = ogFoerderung wird als (preis − bv − lv) berechnet
```

**`bestellungen.json`** — Array von Sammelbestellungen:
```
id            string
datum         string   — ISO-Datum der Bestellung
bezeichnung   string   — frei wählbarer Name
status        enum     — "offen" | "abgeschlossen"
positionen[]
  id              string
  artikelNr       string
  name            string
  menge           number   — Gesamtmenge dieser Zeile
  einzelpreis     number
  bvFoerderung    number   — pro Stück
  lvFoerderung    number
  ogFoerderung    number   — pro Stück (berechnet)
  typ             enum     — "artikel" | "og-kosten"
  zuweisung[]
    mitgliedId    string
    menge         number
    ogAnteil      number   — OG zahlt diesen Betrag
    mitgliedsAnteil number — Mitglied zahlt diesen Betrag
rechnungen[]
  id              string
  nummer          string   — "R_YYYY_MM_NNN"
  datum           string
  mitgliedId      string
  positionen[]   — snapshot der zugewiesenen Positionen für dieses Mitglied
  gesamtbetrag    number
  bezahlt         boolean
  bezahltDatum    string | null
```

**`einstellungen.json`**:
```
og{}           — alle OG-Stammdaten (Name, Adresse, IBAN, ...)
stundenRate{}  — { stunden: 3, euro: 10 }
einsatztypen[] — z.B. ["wachdienst", "sanitaetsdienst", "helfer", "verwaltung"]
nextcloud{}    — { url, user, pass }
```

### Import-Parser

Der Parser verarbeitet Tab-getrennten Text zeilenweise in einer einzigen Funktion ohne
Seiteneffekte (`parseBestellung(text) → { artikel[], ogKosten[] }`). Priorität: robust
gegen fehlende Spalten und inkonsistente Whitespace-Formatierung. BV/LV-Zeilen werden dem
unmittelbar vorherigen Artikel-Eintrag zugeordnet. Artikel-Gruppen mit Menge 0 werden
vollständig übersprungen (inkl. zugehöriger MITTELVERW.-Zeilen).

### Förderberechnung

Reine Rechenfunktion (`berechneFoerderung(artikel, menge) → { bv, lv, og, mitglied }`),
die für eine gegebene Menge alle Anteile berechnet. `ogUebernimmtRest: true` setzt
`og = einzelpreis − bv − lv`. Ergebnis ist stets auf 2 Dezimalstellen gerundet
(kaufmännische Rundung).

### Einsatzstunden-Berechnung

Funktion `berechneStunden(logEntries[], einsatztypen[]) → Map<mitgliedId, stunden>`.
Summiert `dauer_ms` aller Stop-Events der erlaubten Typen und rechnet in Stunden um.
Matching: `nutzer`-Feld (Vollname) → ID-Lookup über Mitgliederliste. Nicht zuordenbare
Namen werden in einer separaten Liste "unbekannt" gesammelt.

Stundenschuld-Verrechnung: `verechneSchuld(mitgliedId, bestellungen[], geleisteteStunden)`
→ iteriert chronologisch über Bestellungen, tilgt älteste Schuld zuerst.

### PDF-Erzeugung

Im Browser via `jsPDF` (keine serverseitige Abhängigkeit). Das Layout orientiert sich exakt
an der Vorlage `R_2025_07_001_Kammler.pdf`. Rechnungen werden als Datei-Download
bereitgestellt; kein automatisches Speichern auf Nextcloud (Download lokal).

### Rechnungsnummerierung

Format `R_YYYY_MM_NNN`. Der aktuelle Höchstzähler je Monat wird aus der Liste aller
existierenden Rechnungsnummern in `bestellungen.json` berechnet — kein separater Counter
im Schema. Dadurch ist die Nummerierung stets konsistent mit den gespeicherten Daten.

### WebDAV-Client

Ein schlankes Modul (`webdav.js`) kapselt alle PROPFIND/GET/PUT-Requests gegen die Nextcloud.
Alle anderen Module sprechen ausschließlich durch dieses Modul mit Nextcloud. Fehler werden
als strukturierte Objekte zurückgegeben, nicht als Exceptions, damit die UI sauber reagieren kann.

### Offline / Service Worker

Ein Service Worker cached alle App-Ressourcen (HTML, JS, CSS, Bibliotheken) beim ersten Laden.
Daten aus der letzten erfolgreichen WebDAV-Antwort werden im `localStorage` als Fallback
gecacht. Bei Offline-Betrieb arbeitet die App mit dem Cache und zeigt einen Offline-Banner.

---

## Testing Decisions

Tests prüfen **externes Verhalten durch öffentliche Funktionen** — sie sollen Refactorings
überleben, ohne angepasst werden zu müssen. DOM-Manipulation und WebDAV-Aufrufe werden nicht
direkt getestet.

**Prioritäre Testbereiche:**

1. **Import-Parser** — `parseBestellung(text)`: Eingabe ist Roh-Text, Ausgabe ist das
   geparste Datenmodell. Testfälle: normaler Import, fehlende LV-Zeile, Menge-0-Artikel,
   Versandkosten, mehrere Artikel hintereinander, fehlerhafter Text.

2. **Förderberechnung** — `berechneFoerderung(artikel, menge)`: Zahlentests mit
   Grenzfällen (ogUebernimmtRest, kein OG-Anteil, Menge > 1, Rundung).

3. **Stunden-Matching** — `berechneStunden(logEntries, einsatztypen)`: Eingabe sind
   LifeguardClock-JSON-Entries, Ausgabe ist Stundensumme je Mitglied.
   Testfälle: anwesenheit wird nicht gezählt, mehrere Typen für ein Mitglied,
   unbekannter Nutzername.

4. **Schulden-Verrechnung** — `verechneSchuld(...)`: chronologische Tilgungsreihenfolge,
   Teilerfüllung, keine Schuld vorhanden.

5. **Rechnungsnummerierung** — `naechsteRechnungsnummer(rechnungen[], datum)`:
   Monatsreset, erster des Monats, fortlaufende Zählung.

Testdatei: `tests/unit.js` — einfache `assert`-basierte Tests ohne Testframework,
konsistent mit dem Stempeluhr-Repo-Stil.

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

- **Offene Fragen aus Discovery:** (1) Parser-Robustheit bei Formatvarianten — Empfehlung:
  Parser so robust wie möglich bauen, da das Quelldokument-Format leicht variiert.
  (2) PDF-Ablage auf Nextcloud — zunächst nur lokaler Download, Nextcloud-Ablage als
  optionale Erweiterung. (3) Mitglieder die austreten — Stundenschuld bleibt im System
  als "offen" bestehen; kein automatisierter Löschmechanismus im MVP.
- **OG-Stammdaten für Rechnung** (aus PDF-Vorlage übernommen): Landesverband Baden,
  Bezirk Enz, OG-Schellbronn e.V., Nagoldstr. 47, 75242 Neuhausen,
  IBAN DE57 6619 0000 0033 5861 08, BIC GENODE61KA1, Volksbank pur eG,
  Amtsgericht Mannheim 501097, Steuernr. 41435/55802.
- **Stempeluhr-Referenz:** `C:\GitHub\Stempeluhr\stempeluhr\` — Code-Stil, WebDAV-Pattern
  und SW-Implementierung als Vorlage verwenden.
