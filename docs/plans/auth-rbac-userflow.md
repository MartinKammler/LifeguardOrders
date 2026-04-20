# Plan: Auth, Rollen, Wunschqueue & Mitglieder-Frontend

## Zielsetzung

Das Bestellsystem wird von einem reinen Admin-Werkzeug zu einer Mehrnutzer-App mit:

- Mitgliedslogin über die Stempeluhr
- Funktionslogins für `admin`, `finanzen`, `materialwart`
- harter Rechteprüfung pro Seite und Aktion
- separater Wunschqueue vor der offiziellen Sammelbestellung
- eigenem Dashboard für Mitglieder

Die technische Führungsquelle für normale Mitglieder bleibt die Stempeluhr.
Das Bestellsystem ergänzt darauf nur Rollen, Sperren und fachliche Workflows.

---

## Leitplanken

- `/LifeguardClock/lgc_users.json` ist **read only**
- Das Bestellsystem schreibt niemals in den Datenbestand der Stempeluhr zurück
- `admin`, `finanzen` und `materialwart` authentifizieren sich lokal im Bestellsystem
- Nach einem Funktionslogin ist die handelnde Person verpflichtend
- Rechte werden zentral in `authz.js` geprüft, nicht nur durch versteckte Buttons
- Mitglieder sehen ausschließlich eigene Daten
- Wunschqueue und offizielle Sammelbestellung bleiben getrennte Datenbestände

---

## Phase 1 / Sprint 07 — Auth-Basis

### Ziel

Zwei getrennte Login-Wege und saubere Sessions.

### Arbeitspakete

- `login.html` auf zwei Modi umbauen:
  - `Mitglied`
  - `Funktionslogin`
- `src/stempeluhr-auth.js` einführen
  - lädt `/LifeguardClock/lgc_users.json`
  - prüft PIN kompatibel zur Stempeluhr
  - akzeptiert nur aktive Nutzer
- `src/auth.js` auf lokale Funktionskonten fokussieren
- `src/session.js` erweitern:
  - `authType`
  - `mitgliedId`
  - `funktionId`
  - `actingPersonId`
  - `actingPersonName`
- `src/auth-guard.js` auf getrennte Sessiontypen anpassen

### Abnahmekriterien

- Mitgliedslogin funktioniert nur mit gültiger Stempeluhr-PIN
- Funktionslogin bleibt separat
- Sessions sind eindeutig als `stempeluhr` oder `lokal` markiert

---

## Phase 2 / Sprint 08 — Rollen & Sperren

### Ziel

Echte Autorisierung statt nur Login.

### Arbeitspakete

- `src/authz.js` einführen:
  - `canRead(scope, session)`
  - `canWrite(scope, session)`
  - `requirePermission(...)`
- `/LifeguardOrders/zugriff.json` einführen:
  - globale Sperren
  - individuelle Nutzersperren
  - Gründe und Zeitstempel
- Rollenmatrix hart umsetzen:
  - `user`
  - `materialwart`
  - `finanzen`
  - `admin`
- Seiten und Aktionen absichern:
  - Bestellungen
  - Rechnungen
  - Materialbestand
  - Artikel
  - Einstellungen

### Abnahmekriterien

- `user` kann keine Verwaltungs- oder Schreibaktionen außerhalb des eigenen Self-Service auslösen
- `finanzen` kann fördern, sperren und abrechnen, aber keine Benutzer oder Systemeinstellungen ändern
- `materialwart` kann weder Preisabweichungen noch OG-Förderung finalisieren
- Globale und individuelle Sperren blockieren nur neue Wünsche und neue Lageranfragen

---

## Phase 3 / Sprint 09 — Funktionslogin mit handelnder Person

### Ziel

Funktionskonten bleiben auditierbar auf reale Personen zurückführbar.

### Arbeitspakete

- Nach erfolgreichem Funktionslogin Pflichtschritt:
  - handelnde Person aus Mitgliederliste wählen
- Audit um folgende Felder erweitern:
  - `authType`
  - `sessionRole`
  - `actingPersonId`
  - `actingPersonName`
- Login ohne handelnde Person verhindern

### Abnahmekriterien

- `admin`, `finanzen` und `materialwart` kommen nicht ohne handelnde Person in die App
- Audit zeigt Funktionskonto plus handelnde Person

---

## Phase 4 / Sprint 10 — Wunschqueue

### Ziel

Mitgliederwünsche werden getrennt von der offiziellen Sammelbestellung erfasst.

### Arbeitspakete

- `/LifeguardOrders/wuensche.json` einführen
- Mitgliederseite für Wunschabgabe bauen
- Statusmodell umsetzen:
  - `offen`
  - `teilweise_uebernommen`
  - `uebernommen`
  - `abgelehnt`
  - `storniert`
  - `erledigt`
- User darf bis Übernahme:
  - ändern
  - stornieren
- Admin darf Wünsche im Auftrag des Mitglieds ändern
  - mit Audit
  - optionalem Kurzgrund
- Admin-Queue:
  - offene Wünsche sehen
  - übernehmen
  - ablehnen
  - teilweise übernehmen

### Abnahmekriterien

- Wünsche liegen getrennt von `bestellungen.json`
- Nur Admin übernimmt Wünsche in die offizielle Sammelbestellung
- User sieht Status und Hinweis auf Admin-Änderungen

---

## Phase 5 / Sprint 11 — Mitglieder-Dashboard

### Ziel

Eigenes, datensparsames Frontend für normale Mitglieder.

### Arbeitspakete

- Dashboard für `user` aufbauen
- Vier Blöcke:
  1. Meine Wünsche
  2. Meine laufenden Bestellungen
  3. Meine Förderung / Stunden
  4. Meine Rechnungen / Lagerausgaben
- Nur eigene Daten
- Sperrhinweise sichtbar anzeigen
- Hinweise bei Admin-Änderungen am Wunsch zeigen

### Abnahmekriterien

- User sieht ausschließlich eigene Daten
- Status ist fachlich verständlich statt nur technisch

---

## Phase 6 / Sprint 12 — Materialwart-Flow

### Ziel

Lagerarbeit sauber von Förder- und Finanzentscheidungen trennen.

### Arbeitspakete

- Lagerausgaben in zwei Fälle trennen:
  - ungefördert direkt erfassbar
  - Förderung/Preisabweichung nur als Freigabefall
- Statusmodell für Lagerfälle ergänzen:
  - `offen`
  - `freigabe_noetig`
  - `abrechnen`
  - `og-gefoerdert`
  - `abgelehnt`
- `finanzen` oder `admin` treffen Abrechnungsentscheid
- `materialwart` bleibt auf Katalogpreis festgelegt

### Abnahmekriterien

- Materialwart kann keine Förderung oder Preisabweichung finalisieren
- Finanzen/Admin übernehmen die abrechnungswirksame Freigabe

---

## Phase 7 / Sprint 13 — Audit & Session-Härtung

### Ziel

Governance für den Mehrnutzerbetrieb nachziehen.

### Arbeitspakete

- Audit weiter ausbauen:
  - `before/after`
  - optional `reason`
  - klare Zuordnung zu Rolle und handelnder Person
- Session-Timeout für Funktionslogins
- optional kürzere Session-Lebensdauer für `admin` und `finanzen`
- Audit-Ansicht für Admin/Finanzen

### Abnahmekriterien

- Kritische Aktionen sind personell nachvollziehbar
- Funktionssessions laufen nicht unbegrenzt

---

## Empfohlene Reihenfolge

1. Auth-Basis
2. Rollen & Sperren
3. Funktionslogin mit handelnder Person
4. Wunschqueue
5. Mitglieder-Dashboard
6. Materialwart-Flow
7. Audit & Session-Härtung

---

## Warum diese Reihenfolge

- Erst Identität
- dann Rechte
- dann Wunschprozess
- dann Mitglieder-Frontend
- danach Lager-Sonderfälle
- zum Schluss Governance-Polish
