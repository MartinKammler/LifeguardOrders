# Plan: Vereinfachter Umbau Sammelbestellprozess

## Ziel

Das System soll den Sammelbestellprozess fuer die Ortsgruppe vereinfachen:

- Wuensche sammeln
- Bestellung zusammenfassen
- Lieferung abgleichen
- Rechnungen fuer Mitglieder erzeugen
- der Kassiererin eine saubere Uebersicht geben:
  - was wurde bestellt
  - was geht zu Lasten der OG
  - was zahlen Mitglieder

Nicht Ziel:

- keine revisionssichere Buchhaltung
- kein finanzamtsicheres Rechnungssystem
- kein grosses Audit- oder Compliance-Projekt

---

## Leitlinien

- Fachliche Korrektheit geht vor technischer Raffinesse.
- Historische Werte muessen aus gespeicherten Bestell-/Rechnungsdaten kommen, nicht aus spaeter geaenderten Katalogdaten.
- HTML-Seiten bleiben eigenstaendige Seiten; es geht um bessere Modulstruktur, nicht um ein SPA.
- Tests sollen die echten Nutzerablaeufe absichern.

---

## Problem heute

Die groessten Wartungs- und Fehlerrisiken liegen nicht in der Fachlogik selbst, sondern in den grossen Seitenskripten:

- `bestellung-sammeln.html`
- `bestellung-abgleich.html`
- `rechnungen.html`
- `dashboard.html`

Besonders `bestellung-sammeln.html` und `bestellung-abgleich.html` mischen aktuell:

- Laden und Speichern
- Sync-Verhalten
- Formularlogik
- Rendern
- Event-Handler
- Fachentscheidungen

Das macht Aenderungen riskant und erschwert gezielte Tests.

---

## Zielarchitektur

### Seiten als duenne Shells

Jede HTML-Seite soll nur noch enthalten:

- Markup
- Styles
- einen kleinen Einstiegspunkt aus `src/pages/...`

### Feature-Module statt Inline-Seitenskripte

Pro Workflow ein Feature-Verzeichnis:

- `src/pages/bestellung-sammeln.js`
- `src/pages/bestellung-abgleich.js`
- `src/pages/rechnungen.js`
- `src/pages/dashboard.js`

Darunter fachlich geschnittene Module, z. B.:

- `src/features/bestellungen/sammeln/service.js`
- `src/features/bestellungen/sammeln/view.js`
- `src/features/bestellungen/sammeln/state.js`
- `src/features/bestellungen/abgleich/service.js`
- `src/features/rechnungen/service.js`
- `src/features/kassenuebersicht/service.js`

### Klares Prinzip

- `service`: laden, speichern, sync, domaeenbezogene Mutationen
- `state`: abgeleitete Daten und UI-Zustaende
- `view`: Rendern und Event-Bindung

---

## Phasen

## Phase 1: Kleine Seiten zuerst

### Ziel

Die Zielstruktur mit wenig Risiko einfuehren.

### Umfang

- `rechnungen.html` nach `src/pages/rechnungen.js` auslagern
- `dashboard.html` nach `src/pages/dashboard.js` auslagern

### Ergebnis

- Erste stabile Seitenstruktur
- Wiederverwendbare Muster fuer Bootstrapping, Rendern und Events
- Keine Aenderung des Fachverhaltens

### Tests

- bestehende HTML-Tests weiter gruen
- 1-2 neue Node-Tests fuer extrahierte Service-Funktionen

---

## Phase 2: Wunschsammlung entknoten

### Ziel

Der wichtigste Eingabe-Workflow wird beherrschbar.

### Umfang

`bestellung-sammeln.html` aufteilen in:

- Bestellungsdaten laden/speichern
- Artikelsuche und Dropdown
- Wunschliste und Bearbeiten
- Aggregation + CSV

### Sinnvolle Module

- `sammeln-service.js`
- `wunschliste-state.js`
- `artikelsuche-view.js`
- `sammeln-view.js`

### Ergebnis

- Neue Felder oder Regeln in der Wunschaufnahme werden leichter
- Bugs in Dropdown, Editieren oder Speichern lassen sich isolierter testen

### Tests

- Wunsch anlegen
- Wunsch bearbeiten
- Wunsch mergen
- Bestellung speichern
- Bestellung als bestellt markieren

---

## Phase 3: Abgleich-Workflow entknoten

### Ziel

Die komplexeste Seite wird stabil und aenderbar.

### Umfang

`bestellung-abgleich.html` aufteilen in:

- Rechnungsimport
- Abgleich-Ergebnis
- Aufloesen von Abweichungen
- Abschliessen
- Rechnungserzeugung

### Sinnvolle Module

- `abgleich-service.js`
- `abweichungen-state.js`
- `abgleich-view.js`
- `rechnungen-aus-bestellung-service.js`

### Ergebnis

- Aenderungen an Mengenabweichungen oder Direktuebernahme werden weniger riskant
- Rechnungserzeugung ist nicht mehr eng an die Seite gekoppelt

### Tests

- Rechnung importieren
- Direkt uebernehmen
- Mengenabweichung ignorieren vs. uebernehmen
- Bestellung abschliessen
- Rechnung fuer Mitglied erzeugen

---

## Phase 4: Gemeinsame Auswertung fuer Rechnungen und Kasse

### Ziel

Rechnungen, Kassenwart-Uebersicht und gespeicherte Bestelldaten greifen auf dieselbe fachliche Sicht zu.

### Umfang

- gemeinsamen Service fuer abrechnungsrelevante Positionen schaffen
- Kassenwart und Rechnungen auf dieselbe Ableitung stutzen
- gespeicherte Snapshots als Quelle beibehalten

### Ergebnis

- weniger Risiko fuer widerspruechliche Zahlen
- weniger Doppelinterpretation derselben Daten

### Tests

- dieselbe Position ergibt in Rechnung und Kassenuebersicht konsistente Werte
- `ogKostenlos`
- gespeicherte historische Foerderwerte bleiben stabil

---

## Phase 5: Minimales Ereignisprotokoll statt grosses Audit

### Ziel

Nur das protokollieren, was operativ hilfreich ist.

### Umfang

Kein Revisionsmodell. Stattdessen nur ein schlankes Ereignisprotokoll fuer:

- Bestellung gespeichert
- Bestellung auf `bestellt` gesetzt
- Bestellung abgeschlossen
- Rechnung erzeugt
- Rechnung bezahlt/unbezahlt

### Regeln

- lokal ok
- optional spaeter exportierbar
- rein fuer Nachvollziehbarkeit im Team
- kein Anspruch auf Unveraenderlichkeit gegen Manipulation

### Ergebnis

- einfache Nachvollziehbarkeit bei Rueckfragen
- kein technischer Overhead einer Pseudo-Buchhaltung

---

## Empfohlene Reihenfolge

1. `rechnungen`
2. `dashboard`
3. `bestellung-sammeln`
4. `bestellung-abgleich`
5. gemeinsame Auswertungslogik fuer Rechnung/Kasse
6. optional minimales Ereignisprotokoll

Diese Reihenfolge minimiert Risiko:

- zuerst kleine Seiten
- dann Eingabe-Workflow
- dann komplexester Workflow
- erst danach optionale Protokollierung

---

## Was dabei bewusst nicht gemacht wird

- keine serverseitige Buchhaltung
- keine revisionssicheren Journale
- keine digitale Signatur von Rechnungen
- keine Steuer- oder DATEV-Logik
- kein Umbau zu einer grossen App-Architektur

---

## Definition of Done

Der Umbau ist erfolgreich, wenn:

- die grossen Seitenskripte nicht mehr direkt in HTML liegen
- Rechnungen und Kassenuebersicht dieselben fachlichen Werte liefern
- die Kernablaeufe automatisiert getestet sind
- neue Anpassungen am Sammelbestellprozess ohne Angst vor Seiteneffekten moeglich sind
