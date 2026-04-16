# Arbeitspakete: Vereinfachter Umbau Sammelbestellprozess

## Ziel

Diese Arbeitspakete zerlegen den vereinfachten Umbauplan in konkrete, greifbare Schritte.

Fokus:

- Seitenskripte aus HTML auslagern
- Sammelbestellprozess stabiler machen
- Rechnungen und Kassenuebersicht fachlich konsistent halten
- Tests fuer die Kernablaeufe erweitern

Kein Ziel:

- Buchhaltungssystem
- revisionssicheres Audit
- komplexes Compliance-Logging

---

## Reihenfolge

1. AP-00 Sicherheitsnetz fuer Refactorings
2. AP-01 Seiten-Bootstrap und Modulstruktur
3. AP-02 `rechnungen` aus HTML auslagern
4. AP-03 `dashboard` aus HTML auslagern
5. AP-04 `bestellung-sammeln` fachlich aufteilen
6. AP-05 `bestellung-sammeln` komplett auf Seitenmodul umstellen
7. AP-06 `bestellung-abgleich` fachlich aufteilen
8. AP-07 `bestellung-abgleich` komplett auf Seitenmodul umstellen
9. AP-08 gemeinsame Abrechnungslogik fuer Rechnung und Kassenuebersicht
10. AP-09 Kernflow-Regressionen ausbauen
11. AP-10 optionales Minimal-Protokoll

---

## AP-00 Sicherheitsnetz fuer Refactorings

### Ziel

Vor dem groesseren Umbau die wichtigsten Kernflows testseitig absichern.

### Umfang

- bestehende Tests sichten
- fehlende Regressionen fuer Kernflows identifizieren
- 2-4 neue Tests vor dem Refactoring ergaenzen

### Beispiele

- Rechnung erzeugen aus abgeschlossener Bestellung
- Zahlungsstatus setzen
- Bestellung speichern und wieder laden
- Abweichung `uebernehmen` vs. `ignorieren`

### Ergebnis

Refactorings laufen gegen ein belastbareres Netz statt gegen Hoffnung.

### Akzeptanz

- `run-tests.bat` bleibt gruen
- neue Tests schlagen bei offensichtlichen Flow-Bruechen an

---

## AP-01 Seiten-Bootstrap und Modulstruktur

### Ziel

Eine einheitliche Struktur schaffen, in die die Seiten spaeter sauber verschoben werden koennen.

### Umfang

- `src/pages/` einfuehren
- einfache Konvention fuer `initPage()` oder gleichwertigen Einstieg festlegen
- optionale kleine Helfer fuer DOM-Zugriff und Statusanzeigen schaffen

### Ergebnis

Ein gemeinsames Muster fuer alle spaeter ausgelagerten Seiten.

### Akzeptanz

- neue Struktur ist im Repo angelegt
- mindestens eine kleine Demo- oder triviale Seite nutzt das Muster

### Abhaengigkeiten

- keine

---

## AP-02 `rechnungen` aus HTML auslagern

### Ziel

Die kleinere Mutations-Seite zuerst modularisieren.

### Umfang

- Inline-Skript aus `rechnungen.html` entfernen
- `src/pages/rechnungen.js` anlegen
- Rechnungsdaten-Laden, Rendern und Zahlungsstatus logisch trennen

### Zielmodule

- `src/pages/rechnungen.js`
- `src/features/rechnungen/service.js`
- `src/features/rechnungen/view.js`

### Ergebnis

Rechnungsseite ist einfacher lesbar und aenderbar.

### Akzeptanz

- Zahlungsstatus funktioniert unveraendert
- PDF-Download funktioniert unveraendert
- HTML-Testseite bleibt gruen

### Abhaengigkeiten

- AP-01

---

## AP-03 `dashboard` aus HTML auslagern

### Ziel

Die zweite kleinere Seite nach demselben Muster umstellen.

### Umfang

- Inline-Skript aus `dashboard.html` entfernen
- `src/pages/dashboard.js` anlegen
- Log-Laden, Stundenberechnung und Rendering trennen

### Zielmodule

- `src/pages/dashboard.js`
- `src/features/dashboard/service.js`
- `src/features/dashboard/view.js`

### Ergebnis

Dashboard-Aenderungen betreffen nicht mehr einen grossen Seitenskript-Block.

### Akzeptanz

- Ampellogik unveraendert
- unbekannte Nutzer werden weiter angezeigt
- HTML-Tests bleiben gruen

### Abhaengigkeiten

- AP-01

---

## AP-04 `bestellung-sammeln` fachlich aufteilen

### Ziel

Den groessten Eingabe-Workflow intern schneiden, bevor die Seite formal ausgelagert wird.

### Umfang

- Artikelsuche als eigenes UI-Modul abgrenzen
- Wunschlisten-Operationen kapseln
- Laden/Speichern/Sync fuer die Seite in einen Service ziehen

### Zielmodule

- `src/features/bestellungen/sammeln/service.js`
- `src/features/bestellungen/sammeln/wunschliste-state.js`
- `src/features/bestellungen/sammeln/artikelsuche-view.js`

### Ergebnis

Die Seite hat intern klare Bausteine, auch wenn sie noch nicht vollstaendig auf `src/pages/...` umgestellt ist.

### Akzeptanz

- Wunsch hinzufuegen funktioniert
- Wunsch bearbeiten funktioniert
- Wunsch mergen funktioniert
- Bestellung speichern funktioniert

### Abhaengigkeiten

- AP-00
- sinnvoll nach AP-01

---

## AP-05 `bestellung-sammeln` komplett auf Seitenmodul umstellen

### Ziel

Die Wunschsammlung als duenne HTML-Shell betreiben.

### Umfang

- Inline-Skript aus `bestellung-sammeln.html` entfernen
- `src/pages/bestellung-sammeln.js` als Einstieg nutzen
- vorhandene Feature-Module anbinden

### Ergebnis

Die Seite selbst enthaelt nur noch Markup, Styles und Modul-Einstieg.

### Akzeptanz

- Seite funktioniert fachlich wie vorher
- HTML-Testseite bleibt gruen
- Kernlogik liegt nicht mehr direkt in HTML

### Abhaengigkeiten

- AP-04

---

## AP-06 `bestellung-abgleich` fachlich aufteilen

### Ziel

Den komplexesten Workflow in kontrollierbare Bausteine zerlegen.

### Umfang

- Import und Parser-Anstoss trennen
- Abgleichszustand und Aufloesungen kapseln
- Abschluss und Rechnungserzeugung in Service-Funktionen ziehen

### Zielmodule

- `src/features/bestellungen/abgleich/service.js`
- `src/features/bestellungen/abgleich/state.js`
- `src/features/bestellungen/abgleich/view.js`
- `src/features/rechnungen/erzeugung-aus-bestellung.js`

### Ergebnis

Mengenabweichungen, Direktuebernahme und Rechnungslogik sind nicht mehr quer ueber die Seite verteilt.

### Akzeptanz

- Rechnung importieren funktioniert
- Direkt uebernehmen funktioniert
- Bestellung abschliessen funktioniert
- Rechnungserzeugung funktioniert

### Abhaengigkeiten

- AP-00
- sinnvoll nach AP-01

---

## AP-07 `bestellung-abgleich` komplett auf Seitenmodul umstellen

### Ziel

Auch die komplexeste Seite als duenne Shell betreiben.

### Umfang

- Inline-Skript aus `bestellung-abgleich.html` entfernen
- `src/pages/bestellung-abgleich.js` anbinden
- Feature-Module verbinden

### Ergebnis

Der Abgleich ist technisch besser lesbar und testbarer.

### Akzeptanz

- bestehende Regressionen bleiben gruen
- keine fachliche Regression in Abschluss oder Rechnungserzeugung

### Abhaengigkeiten

- AP-06

---

## AP-08 Gemeinsame Abrechnungslogik fuer Rechnung und Kassenuebersicht

### Ziel

Rechnungen und Kassenwart-Uebersicht sollen dieselben gespeicherten Daten gleich interpretieren.

### Umfang

- gemeinsame Ableitung fuer abrechnungsrelevante Positionen schaffen
- `rechnungen` und `kassenwart` auf dieselbe fachliche Quelle umstellen
- gespeicherte Snapshots als Wahrheit beibehalten

### Zielmodule

- `src/features/abrechnung/projektion.js`
- optional `src/features/abrechnung/service.js`

### Ergebnis

Weniger Risiko fuer widerspruechliche Zahlen in Rechnung und Kassenansicht.

### Akzeptanz

- `ogKostenlos` konsistent
- gespeicherte Foerderwerte konsistent
- Kassenwart- und Rechnungslogik liefern dieselbe fachliche Sicht

### Abhaengigkeiten

- AP-02 sinnvoll
- nicht blockiert durch AP-05/AP-07, aber fachlich anschliessend sinnvoll

---

## AP-09 Kernflow-Regressionen ausbauen

### Ziel

Die fuer den Alltag wichtigen End-to-End-Ablaufe direkt absichern.

### Umfang

Neue Regressionen fuer:

- Wunsch anlegen
- Bestellung speichern
- Bestellung als bestellt markieren
- Rechnung importieren
- Bestellung abschliessen
- Rechnung erzeugen
- Zahlungsstatus setzen
- Kassenwart-Zeile korrekt

### Ergebnis

Die taeglichen Sammelbestellablaeufe sind automatisiert abgesichert.

### Akzeptanz

- neue Regressionen laufen lokal im bestehenden Test-Setup
- Refactorings koennen gegen diese Flows geprueft werden

### Abhaengigkeiten

- kann teilweise frueher starten
- vollstaendiger Nutzen nach AP-05 bis AP-08

---

## AP-10 Optionales Minimal-Protokoll

### Ziel

Nur einfache Nachvollziehbarkeit fuer das Team, ohne Anspruch auf Revisionssicherheit.

### Umfang

- kleines Ereignisprotokoll fuer:
  - Bestellung gespeichert
  - Bestellung auf `bestellt` gesetzt
  - Bestellung abgeschlossen
  - Rechnung erzeugt
  - Rechnung bezahlt/unbezahlt
- optional einfache Exportfunktion

### Ergebnis

Rueckfragen lassen sich leichter beantworten, ohne ein grosses Audit-System zu bauen.

### Akzeptanz

- Protokoll blockiert nie den Workflow
- keine neue fachliche Komplexitaet fuer den normalen Ablauf

### Abhaengigkeiten

- sinnvoll erst nach AP-02 bis AP-08

---

## Empfohlene Schnitte fuer echte Umsetzung

Wenn die Pakete spaeter in Tickets oder kleine Commits zerlegt werden, dann bevorzugt so:

- ein Paket = eine Seite oder ein klarer fachlicher Baustein
- keine gleichzeitige Grossbaustelle auf `bestellung-sammeln` und `bestellung-abgleich`
- gemeinsame Abrechnungslogik erst nach den ersten Seiten-Refactorings

---

## Minimaler Startpunkt

Wenn nur ein sehr kleiner Einstieg gewollt ist, dann zuerst:

1. AP-00
2. AP-01
3. AP-02

Damit ist die neue Struktur eingefuehrt, ohne den Kernworkflow sofort anzufassen.
