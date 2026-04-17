# Discovery: DLRG Bestellsystem (LifeguardOrders)

## Problem Statement

Die DLRG Ortsgruppe Schellbronn e.V. verwaltet Sammelbestellungen von Einsatzkleidung und
Material für ihre Mitglieder heute manuell (E-Mail, Tabellen, Word-Dokumente). Es fehlt ein
System, das:

1. Sammelbestellungen aus der DLRG-Materialstelle erfasst und auf Mitglieder verteilt,
2. Förderanteile von BV, LV und OG korrekt verrechnet,
3. rechtskonforme Rechnungen für Besteller erzeugt,
4. dem Kassenwart eine Gesamtübersicht liefert, und
5. nachverfolgt, ob geförderte Mitglieder ihre OG-Förderung durch Einsatzstunden
   abgearbeitet haben.

---

## Actors and Roles

| Rolle | Beschreibung |
|---|---|
| **Admin / Gruppenleiter** | Einziger Nutzer im MVP. Verwaltet Artikel, importiert Bestellungen, weist Positionen zu, erstellt Rechnungen, markiert Zahlungen, sieht Dashboard. |
| *(Kassenwart)* | Kein separater Login im MVP — Admin erzeugt Kassenwart-Übersicht. |
| *(Mitglieder)* | Kein Self-Service-Zugang im MVP. |

**Geplante Erweiterung:** Multi-User-Login und E-Mail-Versand in späteren Versionen explizit vorgesehen, aber nicht Teil des MVP.

---

## Numbered User Stories

### Artikelverwaltung

1. Als Admin möchte ich Artikel aus einer Auftragsbestätigung der DLRG-Materialstelle per
   Copy-Paste importieren, damit ich keine Artikel manuell eintippen muss.
2. Als Admin möchte ich importierte Artikel einzeln bearbeiten (Name, Preis, Förderbeträge),
   damit ich Korrekturen vornehmen kann.
3. Als Admin möchte ich neue Artikel manuell im Katalog anlegen, damit ich den Katalog
   jederzeit erweitern kann.
4. Als Admin möchte ich pro Artikel BV-Förderung (€), LV-Förderung (€) und OG-Förderung
   (€ oder "OG übernimmt Rest") hinterlegen, damit die Berechnung automatisch erfolgt.
5. Als Admin möchte ich Artikel mit Größen-/Variantenunterschieden als separate Einträge
   führen können, damit z. B. Hose Gr. 44 und Hose Gr. 80 getrennt zugeordnet werden können.

### Sammelbestellung

6. Als Admin möchte ich eine Auftragsbestätigung der Materialstelle als Tab-getrennten Text
   einfügen und automatisch parsen lassen, damit Artikel und Förderungen korrekt erkannt werden.
7. Als Admin möchte ich, dass Positionen mit Menge 0 beim Import automatisch übersprungen
   werden, damit keine leeren Einträge entstehen.
8. Als Admin möchte ich, dass `MITTELVERW. BV` und `MITTELVERW. LV` automatisch als
   Förderabzüge dem vorherigen Artikel zugeordnet werden, damit ich das nicht manuell
   nachpflegen muss.
9. Als Admin möchte ich, dass `VERSANDKOSTEN` und `EILAUFTRAG` automatisch der OG
   zugeordnet werden und nicht in Mitgliedsrechnungen erscheinen.
10. Als Admin möchte ich nach dem Import jede Zeile einer Sammelbestellung einem Mitglied
    zuweisen (Dropdown), damit klar ist wer was bestellt hat.
11. Als Admin möchte ich eine Position mit Menge > 1 auf mehrere Mitglieder aufteilen können,
    damit Sammelbestellungen korrekt abgebildet werden.
12. Als Admin möchte ich sehen, welche Positionen noch keinem Mitglied zugewiesen sind,
    damit ich keine Bestellung vergesse.
13. Als Admin möchte ich mehrere Sammelbestellungen gleichzeitig offen haben können
    (z. B. März und Oktober desselben Jahres), damit der Jahresablauf der OG abgebildet wird.
14. Als Admin möchte ich einen Wunsch als "OG übernimmt Kosten" markieren können,
    damit Mitgliedsanteil, Rechnung und Kassenwart-Auswertung konsistent 0 € für das
    Mitglied und den Rest als OG-Anteil ausweisen.
15. Als Admin möchte ich nach dem Wareneingang eine eigene Anprobe-Phase haben, in der
    ich die finale Verteilung unabhängig vom ursprünglichen Besteller anpassen kann.
16. Als Admin möchte ich in der Anprobe Teilmengen als Retoure oder Lagerbestand markieren
    können, damit diese Mengen nicht in Mitgliedsrechnungen landen.

### Rechnungen

17. Als Admin möchte ich pro Mitglied eine PDF-Rechnung im bestehenden Layout erzeugen,
    damit Mitglieder einen professionellen Zahlungsbeleg erhalten.
18. Als Admin möchte ich, dass die Rechnung automatisch nummeriert wird (Format `R_YYYY_MM_NNN`),
    damit Rechnungen eindeutig nachvollziehbar sind.
19. Als Admin möchte ich, dass die Rechnung den Bruttobetrag zeigt und Förderabzüge bereits
    verrechnet sind, damit der Mitglied nur seinen Eigenanteil sieht.
20. Als Admin möchte ich die OG-Stammdaten (Name, Adresse, IBAN, Steuernr. etc.) in den
    Einstellungen pflegen, damit die Rechnungen korrekte Kopfdaten haben.

### Zahlungsverfolgung

21. Als Admin möchte ich eine Rechnung manuell als "bezahlt" markieren (mit Datum), damit
    der Zahlungsstand jederzeit aktuell ist.
22. Als Admin möchte ich alle offenen Rechnungen auf einen Blick sehen, damit ich
    Zahlungserinnerungen gezielt verschicken kann.

### Kassenwart-Übersicht

23. Als Admin möchte ich eine Übersicht aller Bestellungen mit Mitglied, Artikel,
    Bruttobetrag, BV-/LV-/OG-Förderung, Mitgliedsanteil und Zahlungsstatus erzeugen,
    damit der Kassenwart einen vollständigen Überblick hat.
24. Als Admin möchte ich Summenzeilen pro Fördertopf (BV gesamt, LV gesamt, OG gesamt,
    Mitglieder gesamt), damit Mittelverwendung nachvollziehbar ist.
25. Als Admin möchte ich die Kassenwart-Übersicht als PDF oder CSV exportieren, damit
    sie abgelegt oder weitergeleitet werden kann.

### Einsatzstunden-Dashboard

26. Als Admin möchte ich, dass das System beim Öffnen des Dashboards alle
    LifeguardClock-JSON-Dateien aus dem Nextcloud-Verzeichnis `/LifeguardClock/` automatisch
    einliest, damit ich keinen manuellen Import anstoßen muss.
27. Als Admin möchte ich die geleisteten Einsatzstunden je Mitglied sehen (alle Typen außer
    `anwesenheit` zählen: `wachdienst`, `sanitaetsdienst`, `helfer`, `verwaltung`), damit
    ich den Einsatzstand kenne.
28. Als Admin möchte ich je Mitglied die offene Stundenschuld aus OG-Förderungen sehen
    (Umrechnungsrate: 3 Stunden = 10 €), damit ich erkennen kann, ob die Verpflichtung
    erfüllt ist.
29. Als Admin möchte ich sehen, bis wann jede Stundenverpflichtung erfüllt sein muss
    (Kalenderjahr der Bestellung + 1 Kulanzjahr), damit ich Fristüberschreitungen erkenne.
30. Als Admin möchte ich, dass bei mehreren offenen Sammelbestellungen die Stunden
    chronologisch verrechnet werden (älteste Schuld zuerst), damit die Tilgungsreihenfolge
    fair ist.
31. Als Admin möchte ich eine Ampel-Anzeige (grün/gelb/rot) je Mitglied und Verpflichtung,
    damit der Status auf einen Blick erkennbar ist.

### Einstellungen & Konfiguration

32. Als Admin möchte ich OG-Stammdaten, Fördersätze und Einsatztypen in einer
    Einstellungsseite konfigurieren, damit ich das System ohne Code-Änderungen anpassen kann.
33. Als Admin möchte ich die Mitgliederliste aus der `config.js` der Stempeluhr als Quelle
    nutzen (gleiche IDs, gleiche Namen), damit beide Apps konsistent bleiben und
    LifeguardClock-Einträge automatisch gematchet werden.
34. Als Admin möchte ich einen Materialbestand mit Nummer, Bezeichnung, Variante und Menge
    separat von Bestellungen pflegen, damit Lagerposten sauber unabhängig von einzelnen
    Sammelbestellungen geführt werden.
35. Als Admin möchte ich Bestandsposten als aktiv, aufgebraucht oder ausgesondert markieren
    können, damit der reale Lagerstatus nachvollziehbar bleibt.

---

## Edge Cases and Failure Cases

- **Menge 0 im Import:** Artikel mit `Menge = 0` werden übersprungen (kein leerer Eintrag).
- **Nur BV-Förderung, keine LV-Förderung:** Parser muss fehlende MITTELVERW.LV-Zeile tolerieren.
- **Kein OG-Anteil:** Mitglied hat keine Stundenverpflichtung — Dashboard zeigt "kein Saldo".
- **Mitglied hat noch keine Stunden geleistet:** Dashboard zeigt 0 h / X h Schuld.
- **Bestellung im Dezember:** Frist läuft bis 31.12. des Folgejahres (Kulanzjahr greift sofort).
- **Gleicher Artikel mehrfach im Import:** Jede Zeile ist eine eigene Position (z. B. verschiedene Größen).
- **Importtext hat abweichende Formatierung:** System gibt klare Fehlermeldung mit Hinweis auf erwartetes Format.
- **WebDAV nicht erreichbar:** Klare Fehlermeldung; lokal zwischengespeicherte Daten werden angezeigt.
- **Mitgliedername in LifeguardClock weicht ab:** Matching über `nutzer`-Feld (Vollname) gegen ID-Lookup; nicht zuordenbare Einträge werden als "unbekannt" markiert.
- **Zwei Sammelbestellungen, Stunden reichen nicht für beide:** Älteste Schuld wird zuerst getilgt; verbleibende Schuld bleibt offen.
- **Alte Schuld bereits getilgt, neue noch offen:** Ampel und Frist richten sich nach der ältesten
  noch offenen Schuld, nicht nach erledigten Alt-Rechnungen.
- **Artikelkatalog wurde später geändert:** Kassenwart-Übersicht nutzt gespeicherte Förder-Snapshots
  aus der Bestellung, damit alte Abschlüsse stabil bleiben.
- **Mengenabweichung wird ignoriert:** Ignorieren dokumentiert den Review-Entscheid, übernimmt
  aber keine gelieferte Menge in die finale Position.
- **Artikel wechselt nach Anprobe den Besteller:** Finale Zuweisung überschreibt bewusst nicht
  den ursprünglichen Wunsch, sondern ergänzt die Lieferung um eine abrechnungsrelevante Endverteilung.
- **Teilmenge wird zurückgeschickt:** Retoure wird explizit gespeichert und darf nicht in Rechnung
  oder Kassenwart als Mitgliedsmenge auftauchen.
- **Teilmenge bleibt bei der OG:** Lagerbestand wird explizit gespeichert und nicht still als Mitglied
  oder Retoure interpretiert.

---

## Non-Functional Requirements

- **Tech-Stack:** Vanilla JS, reines HTML/CSS — kein Framework, kein Build-System (konsistent mit Stempeluhr)
- **Datenhaltung:** JSON-Dateien auf Nextcloud (`/LifeguardOrders/`) via WebDAV
- **Offline-Fähigkeit:** PWA — nach erstem Laden ohne Internetverbindung nutzbar (Daten aus Cache)
- **PDF-Erzeugung:** Im Browser, keine serverseitige Abhängigkeit
- **Kein eigener Server:** Nur WebDAV-Zugriff auf `cloud.goddyhome.de`
- **Nextcloud:** URL `https://cloud.goddyhome.de`, User `martin`
- **Dateistruktur Nextcloud:**
  ```
  /LifeguardOrders/
    artikel.json
    bestellungen.json
    materialbestand.json
    einstellungen.json
  /LifeguardClock/
    lgc_*.json   ← nur lesen
  ```
- **Performance:** Seiten laden in < 2 Sek. bei lokalem Netzwerk

---

## Out of Scope (MVP)

- Self-Service-Portal für Mitglieder (kein Login für Mitglieder)
- Direktanbindung an DLRG-Bundesshop / Materialstelle API
- DATEV- oder Buchhaltungsexport
- E-Mail-Versand von Rechnungen *(explizit als spätere Erweiterung geplant)*
- Multi-User-Login / Rollenverwaltung *(explizit als spätere Erweiterung geplant)*
- Native Mobile App

---

## Assumptions

- Die Mitgliederliste in der Stempeluhr-`config.js` ist aktuell und vollständig.
- BV- und LV-Förderbeträge sind pro Artikel fest (keine prozentualen Sätze).
- Der `nutzer`-Vollname in LifeguardClock-JSONs stimmt mit dem `name`-Feld in `config.js` überein.
- Versandkosten und Eilauftrag-Zuschläge trägt immer die OG (keine Ausnahmen).
- Es gibt keine MwSt.-Ausweisung in der Mitgliedsrechnung (Kleinunternehmer-Regelung oder Verein mit Hinweis "19% MwSt. enthalten").
- Der Abarbeitungsschlüssel (3 h / 10 €) kann sich ändern — er ist konfigurierbar.
- Förderwerte, die beim Abschluss einer Bestellung verwendet wurden, werden als Snapshot in der
  Bestellung gespeichert und später nicht mehr aus dem Live-Katalog rekonstruiert.
- Zwischen Wareneingang und Rechnungsstellung gibt es eine fachliche Anprobe-Phase, in der die
  finale Verteilung von der ursprünglichen Wunschlage abweichen darf.

---

## Open Questions

1. Soll der Import-Parser robust gegen fehlende Spalten sein, oder wird das Format als stabil angesehen?
2. Sollen PDF-Rechnungen lokal gespeichert werden (Download) oder auch auf Nextcloud abgelegt werden?
3. Gibt es eine OG-eigene Förderung die über den "OG übernimmt Rest"-Mechanismus hinausgeht (z. B. fester Pauschalbetrag unabhängig vom BV/LV-Satz)?
4. Wie soll mit Mitgliedern umgegangen werden, die die Ortsgruppe verlassen bevor ihre Stundenschuld getilgt ist?
5. Soll das Dashboard-Startdatum der Stundenerfassung konfigurierbar sein (z. B. "zähle nur Stunden ab Bestelldatum")?

---

## Recommended Next Step

PRD erstellen mit `project-kickoff-prd`, dann Sprint-Issues schneiden mit `plan-sprints-from-prd`.

Kernmodule für den ersten Sprint-Kandidaten:
1. Artikelkatalog + Copy-Paste-Import
2. Sammelbestellung + Mitglieder-Zuweisung
3. PDF-Rechnungserzeugung
4. Kassenwart-Übersicht
5. Einsatzstunden-Dashboard
