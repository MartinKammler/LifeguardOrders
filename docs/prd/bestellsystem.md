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
eigenen Server. Für fachliche Daten ist eine erreichbare Nextcloud/WebDAV-Verbindung Pflicht;
ohne WebDAV werden keine Bestellungen, Wünsche, Lagerdaten, Rechnungen oder Rolleninformationen geladen.

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

**Geplantes Mehrnutzer-Zielbild:**
```
Mitglied:
  Meldet sich mit Stempeluhr-PIN an →
  Erfasst eigenen Bestellwunsch in separater Wunschliste →
  Sieht eigenes Dashboard mit Wunschstatus, Bestellstatus, Förderstunden und Rechnungen

Admin:
  Übernimmt Wünsche aus der Wunschliste in die offizielle Sammelbestellung →
  Darf Wünsche im Auftrag des Mitglieds anpassen →
  Darf globale und individuelle Sperren setzen →
  Verwaltet Benutzer, Rollen, Artikelkatalog und Systemeinstellungen

Finanzen:
  Darf OG-Förderung setzen und entziehen →
  Darf globale und individuelle Sperren setzen →
  Erzeugt Rechnungen, verwaltet Zahlstatus und finanzielle Freigaben →
  Darf keine Benutzer oder Systemeinstellungen verwalten

Materialwart:
  Pflegt Lagerbestand, Zugang, Abgang und Ausgaben →
  Darf ungeförderte Lagerausgaben zum Katalogpreis direkt erfassen →
  Markiert Förderfälle nur als Freigabefall für Admin oder Finanzen
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
62. Als Admin möchte ich lokal höchstens die Nextcloud-URL und den Benutzernamen als Login-Hilfe behalten,
    nicht aber fachliche Daten oder vollständige Einstellungen dauerhaft im Browser speichern.

### Fehler- und Leerzustände

63. Als Admin möchte ich bei fehlendem Netzwerk eine klare Fehlermeldung sehen und wissen,
    dass ohne erreichbare Nextcloud keine fachlichen Daten bearbeitet oder geladen werden.
64. Als Admin möchte ich bei fehlerhaftem Import-Text eine verständliche Fehlermeldung erhalten.
65. Als Admin möchte ich auf jeder leeren Listenseite einen erklärenden Hinweis sehen.

### Mitglieder-Self-Service (Zielbild)

66. Als Mitglied möchte ich mich mit derselben PIN wie in der Stempeluhr anmelden können,
    damit ich keinen zweiten persönlichen Login pflegen muss.
67. Als Mitglied möchte ich nur meine eigenen Wünsche, Bestellungen, Rechnungen und
    Förderstunden sehen.
68. Als Mitglied möchte ich einen neuen Wunsch in eine separate Wunschliste eintragen,
    ohne die offizielle Sammelbestellung direkt zu verändern.
69. Als Mitglied möchte ich eigene Wünsche bearbeiten oder stornieren können, solange
    sie noch nicht in die offizielle Sammelbestellung übernommen wurden.
70. Als Mitglied möchte ich sehen, ob ein Wunsch `offen`, `teilweise übernommen`,
    `übernommen`, `abgelehnt`, `storniert` oder `erledigt` ist.
71. Als Mitglied möchte ich sehen, wenn die Verwaltung meinen Wunsch nachträglich
    angepasst hat, damit der aktuelle Stand nachvollziehbar bleibt.
72. Als Mitglied möchte ich auch bei einer Sperre meine bisherigen Wünsche und Rechnungen
    weiter sehen, aber keine neuen Wünsche mehr anlegen können.

### Rollen & Freigaben (Zielbild)

73. Als Admin möchte ich Wünsche aus der separaten Wunschliste bewusst in die offizielle
    Sammelbestellung übernehmen können.
74. Als Admin möchte ich Wünsche im Auftrag eines Mitglieds ändern können
    (z. B. nach WhatsApp-Rückmeldung), wobei diese Änderung auditiert wird.
75. Als Admin oder Finanzen möchte ich OG-Förderung bis zur Rechnungserzeugung setzen
    oder entziehen können.
76. Als Admin oder Finanzen möchte ich globale Sperren für neue geförderte Wünsche
    und neue geförderte Lageranfragen setzen können.
77. Als Admin oder Finanzen möchte ich einzelne Mitglieder für neue geförderte Wünsche
    und Lageranfragen sperren können, inklusive Grund und optionalem Enddatum.
78. Als Finanzen möchte ich Rechnungen, Zahlstatus und finanzielle Freigaben verwalten,
    aber keine Benutzer oder Systemeinstellungen ändern.
79. Als Materialwart möchte ich Lagerzugänge, Lagerabgänge und ungeförderte Ausgaben
    zum Katalogpreis erfassen, ohne selbst Förderentscheidungen treffen zu dürfen.
80. Als Materialwart möchte ich Förderfälle oder Preisabweichungen als Freigabefall
    an Admin oder Finanzen markieren können.
81. Als Funktionsnutzer (`admin`, `finanzen`, `materialwart`) möchte ich mich mit einem
    Funktionslogin anmelden und zusätzlich die handelnde Person auswählen, damit
    Audit-Einträge trotzdem einer realen Person zugeordnet werden können.

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
nc{}           — { url, user } — pass wird nur in sessionStorage gehalten, nie gespeichert
```

**`benutzer.json`** *(geplante Mehrnutzer-Vorbereitung, nur Funktionskonten)*:
```
id             string
name           string
rolle          enum     — "admin" | "finanzen" | "materialwart"
aktiv          boolean
salt           string
passwordHash   string
authType       string   — immer "lokal"
```

**`zugriff.json`** — Rollen-Overlay und Sperren für Mitglieder:
```
global
  userBestellungGesperrt  boolean
  lagerverkaufGesperrt    boolean
  grund                   string
  gesetztVon              string
  gesetztAm               string   — ISO-Zeitstempel
mitglieder[]
  mitgliedId              string
  gesperrt                boolean
  grund                   string
  gesetztVon              string
  gesetztAm               string   — ISO-Zeitstempel
  gesperrtBis             string   — optional, ISO-Datum
```

**`wuensche.json`** — Wunschqueue der Mitglieder vor der offiziellen Sammelbestellung:
```
id                    string
mitgliedId            string
status                enum     — "offen" | "teilweise_uebernommen" | "uebernommen" | "abgelehnt" | "storniert" | "erledigt"
geaendertDurchAdmin   boolean
geaendertAm           string   — optional, ISO-Zeitstempel
geaendertGrund        string   — optional, z. B. "WhatsApp"
positionen[]
  id                  string
  artikelNr           string
  bezeichnung         string
  variante            string
  menge               number
uebernahmen[]
  bestellungId        string
  wunschPositionId    string
  uebernommeneMenge   number
```

**Virtuelle Mitglieder (konstanten.js):**
```
EXTERN_ID = '__EXTERN__'   — externe Käufer; keine OG-Stundenpflicht in PDF/Dashboard
OG_ID     = '__OG__'       — interne OG-Kosten (Versandkosten, Eilauftrag)
```

**`artikel.json`** enthält auch Lehrgänge (Präfix `LG-`, 8 Lehrgänge × Mitglied/Nichtmitglied).

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

**`materialanfragen.json`** — erfasste Lagerausgaben mit Freigabefluss:
```
id                  string
status              enum     — "offen" | "abgerechnet" | "abgelehnt"
materialId          string   — Referenz auf den Lagerposten
nummer              string
bezeichnung         string
variante            string
menge               number
mitgliedId          string
mitgliedName        string
hinweis             string   — optional
foerderwunsch       boolean  — Materialwart fordert Finanz-/Förderentscheidung an
angelegtAm          string   — ISO-Zeitstempel
angelegtVonRolle    string
angelegtVonName     string
entscheidung        enum     — "" | "normal" | "og" | "abgelehnt"
entschiedenAm       string   — optional, ISO-Zeitstempel
entschiedenVonRolle string   — optional
entschiedenVonName  string   — optional
bestellungId        string   — optional, nach Freigabe
rechnungId          string   — optional, nach Freigabe
rechnungsnummer     string   — optional, nach Freigabe
ogKostenlos         boolean
```

**Artikel-/Varianten-Auswahl in der UI**
- Sammelbestellung (`bestellung-sammeln.html`): erst Suche nach Basisartikel über `Nummer + Bezeichnung`, danach separate Variantenauswahl
- Materialbestand (`materialbestand.html`): gleicher Ablauf; alternativ bleiben Nummer, Bezeichnung und Variante manuell editierbar
- Die fachliche Datenbasis bleibt trotzdem `artikelNr + variante`; die zweistufige Auswahl dient nur der besseren Bedienbarkeit bei vielen Größen

### Materialwart / Lagerfreigabe

- `materialwart` erfasst Lagerausgaben operativ im Materialbestand
- dabei wird die Menge sofort als Bestandsabgang gebucht
- die Ausgabe landet zunächst in `materialanfragen.json` mit Status `offen`
- `admin` oder `finanzen` entscheiden anschließend:
  - normal abrechnen
  - `OG übernimmt`
  - ablehnen und Bestand zurückbuchen
- erst mit dieser Freigabe entsteht die abrechnungswirksame Bestellung samt Rechnung

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

Im Browser via `pdf-lib` (lokal in `lib/pdf-lib.esm.min.js`, kein CDN).
Layout basiert auf Template-PDF `Rechnung _Template.pdf`, das als Basis-Seite eingelesen wird.
Mehrseitige Rechnungen mit Übertragssummen werden unterstützt.
Rechnung zeigt: Mitgliedsanteil (nach Förderabzug) + erwartete Einsatzstunden für OG-Anteil.
Externe Käufer (`EXTERN_ID`) erhalten keine Stundenpflicht auf der Rechnung.

### Rechnungsnummerierung

Format `R_YYYY_MM_NNN`. Höchstzähler wird aus allen existierenden Rechnungsnummern berechnet.

### WebDAV-Client

`createWebDavClient(creds, fetchFn)` — Factory-Pattern für Testbarkeit. Alle Fehler als
strukturierte Objekte (`{ ok: false, error }`), keine Exceptions.

### Authentifizierung & Rollen-Zielbild

- Es gibt zwei getrennte Login-Wege:
  - **Mitgliedslogin** über PIN aus `/LifeguardClock/lgc_users.json`
  - **Funktionslogin** über lokale Funktionskonten in `/LifeguardOrders/benutzer.json`
- `/LifeguardClock/lgc_users.json` wird vom Bestellsystem nur **lesend** verwendet
- Nur aktive Stempeluhr-Nutzer dürfen sich als Mitglied anmelden
- Die PIN-Prüfung für Mitglieder muss kompatibel zur Stempeluhr sein:
  - Einmal-PIN/Klartext, wenn `mustChangePIN` aktiv ist
  - sonst `SHA-256(salt + ":" + pin)`
- Mitglieder erhalten im Bestellsystem implizit die Rolle `user`
- `admin`, `finanzen` und `materialwart` sind reine Funktionskonten im Bestellsystem
- Nach einem Funktionslogin ist die Auswahl einer **handelnden Person** verpflichtend
- Session-Daten unterscheiden sauber zwischen:
  - `authType = "stempeluhr"` für Mitglieder
  - `authType = "lokal"` für Funktionskonten
- Die eigentliche Rechteprüfung liegt zentral in einer späteren `authz.js`
- Kein Eintrag in `zugriff.json` bedeutet: normales Mitglied ohne Sperre

### Rollenmatrix (Zielbild)

- `user`
  - darf eigene Wünsche anlegen, ändern und stornieren bis zur Übernahme
  - sieht nur eigene Daten
  - darf keine Förderentscheidungen, Rechnungen oder Lagerfreigaben treffen
- `materialwart`
  - darf Lagerbestand und Bewegungen pflegen
  - darf ungeförderte Lagerausgaben zum Katalogpreis erfassen
  - darf keine Preisabweichungen oder OG-Förderungen finalisieren
- `finanzen`
  - darf OG-Förderung setzen und entziehen
  - darf Rechnungen erzeugen, drucken und Zahlstatus pflegen
  - darf globale und individuelle Sperren setzen
  - darf keine Benutzer, Rollen oder Systemeinstellungen verwalten
- `admin`
  - darf alles
  - übernimmt Wünsche aus der Wunschqueue in die offizielle Sammelbestellung
  - verwaltet Benutzer, Rollen, Artikelkatalog und Systemeinstellungen

### Wunschqueue & Sperrregeln (Zielbild)

- Mitgliederwünsche landen zuerst in `wuensche.json`, nicht direkt in `bestellungen.json`
- Nur `admin` übernimmt Wünsche in die offizielle Sammelbestellung
- Bestehende Wünsche bleiben bei einer Sperre sichtbar
- Sperren verhindern nur **neue** Wünsche und **neue** Lageranfragen
- Dasselbe gilt für geförderte Lagerfälle
- Änderungen durch Admin bleiben auditierbar und werden dem Mitglied im Dashboard kenntlich gemacht
- OG-Förderung darf durch `admin` oder `finanzen` bis zur Rechnungserzeugung gesetzt
  oder entzogen werden; danach nur über bewussten Korrekturpfad

### Benutzer-Dashboard (Zielbild)

Das spätere Mitglieder-Dashboard zeigt ausschließlich eigene Daten in vier Blöcken:

1. Meine Wünsche
2. Meine laufenden Bestellungen
3. Meine Förderung / Stunden
4. Meine Rechnungen / Lagerausgaben

### DOM-Sicherheit (XSS-Schutz)

Alle Seitenmodule verwenden ausschließlich:
- `html\`...\`` — tagged template, escaped alle interpolierten Werte automatisch
- `raw(string)` — für vertrauenswürdige, statische HTML-Strings (nie für Benutzerdaten)
- `setHTML(el, html\`...\`)` — einziger erlaubter Weg zur DOM-Mutation

`innerHTML` direkt wird nie verwendet. `raw()` ist idempotent (verhindert doppeltes Wrapping).

### Sync-Architektur (sync.js)

- Fachliche Daten arbeiten künftig **remote-required**: Lesen und Schreiben nur wenn Nextcloud erreichbar ist
- Kein stilles `pending`-Weiterschreiben mehr für Bestellungen, Artikel, Materialbestand, Einstellungen
- Vor jedem Upload wird der aktuelle Remote-Stand geprüft (`ETag` / Remote-Version)
- Bei Remote-Abweichung: **harte Konfliktsperre**, kein automatisches Überschreiben
- Offline oder ohne Remote-Verbindung: fachliche Daten werden nicht geladen; die App zeigt stattdessen einen klaren Verbindungsfehler
- Pro Scope speichert `sync.js` zusätzlich Remote-Metadaten und Konfliktstatus
- Konflikt-UX bietet zunächst nur: `Remote neu laden`, `lokale Kopie exportieren`, `Konflikt später lösen`
- NC-Passwort wird nur in `sessionStorage` gehalten, nie in `localStorage` gespeichert

### Sicherheit

- Keine CDN-Abhängigkeiten: `pdf-lib` und alle anderen Bibliotheken liegen lokal in `lib/`
- `einstellungen.json` wird nicht als Default vom Webserver geladen (würde Zugangsdaten exponieren)
- NC-Credentials-Validierung: `client` ist nur dann ungleich `null`, wenn URL + User + Pass vollständig
- App-Login wird vorbereitet, ist im Frontend-Only-Betrieb aber **keine harte Sicherheitsgrenze** gegen technisch versierte lokale Nutzer
- Vereinsdaten werden nicht mehr als betrieblicher Lese-Fallback im Browser gehalten; lokal bleiben nur Sessiondaten,
  Sync-Status und minimale Login-Hilfen
- Audit-Log wird künftig append-only auf Nextcloud geführt; lokale Kopie ist nur ein technischer Kurzzeit-Cache

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
9. **Remote-Konflikte** — ETag-/Versionsprüfung, harte Sperre statt stilles Überschreiben
10. **WebDAV-Robustheit** — XML-Parsing ohne Regex, auch bei anderen Namespaces/PREFIXEN
11. **Login & Rollen** — Session-Guard, Rollenauflösung und Audit-Zuordnung

---

## Out of Scope

- Self-Service-Portal für Mitglieder im aktuellen Stand *(als Zielbild eingeplant, aber noch nicht implementiert)*
- Direktanbindung DLRG-Bundesshop / Materialstelle API
- DATEV- oder Buchhaltungsexport
- E-Mail-Versand von Rechnungen *(geplante spätere Erweiterung)*
- Native Mobile App
- Automatischer Kontoabgleich
- Serverseitige Autorisierung / eigenes Backend für harte Zugriffskontrolle *(weiterhin spätere Erweiterung)*

---

## Further Notes

- **OG-Stammdaten für Rechnung:** Landesverband Baden, Bezirk Enz, OG-Schellbronn e.V.,
  Nagoldstr. 47, 75242 Neuhausen, IBAN DE57 6619 0000 0033 5861 08, BIC GENODE61KA1,
  Volksbank pur eG, Amtsgericht Mannheim 501097, Steuernr. 41435/55802.
- **Stempeluhr-Referenz:** `C:\GitHub\Stempeluhr\stempeluhr\` — Code-Stil und WebDAV-Pattern.
- **Parser-Robustheit:** Format der Materialstelle-Seite kann variieren — Parser wird
  laufend mit neuen Beispielen trainiert.
- **NC-Sync-Strategie:** Nextcloud ist die maßgebliche Lese- und Schreibquelle.
  Fachliche Daten werden ohne erreichbares WebDAV nicht geladen; lokaler Speicher dient nicht
  mehr als betrieblicher Offline-Fallback.
- **Konfliktstrategie:** Bei Remote-Änderungen zwischen Lesen und Schreiben wird nicht
  automatisch gemerged, sondern hart gesperrt und dem Nutzer eine Konfliktentscheidung
  aufgezwungen.
- **Login-Vorbereitung:** Mehrnutzerbetrieb wird zunächst als App-Login mit Session-Guard
  vorbereitet; echte technische Zugriffskontrolle erfordert später ein Backend oder eine
  Desktop-App mit sicherem Credential-Store.
