# Sprint 07: Mitgliedslogin, Rollenbasis & Zugriffsoverlay

## Sprint Goal

Das Bestellsystem bekommt die technische Basis für den Mehrnutzerbetrieb:

- Mitgliedslogin über die Stempeluhr
- Funktionslogin bleibt separat
- Sessions unterscheiden sauber zwischen Mitglied und Funktion
- ein Zugriffsoverlay für globale und individuelle Sperren wird vorbereitet

---

## Produktentscheidungen

- Mitgliedslogin nutzt `/LifeguardClock/lgc_users.json`
- Das Bestellsystem liest die Stempeluhr-Daten nur, es schreibt nie zurück
- Nur aktive Stempeluhr-Nutzer dürfen sich als Mitglied anmelden
- `admin`, `finanzen` und `materialwart` bleiben lokale Funktionskonten
- Rechteprüfung folgt im nächsten Sprint zentral über `authz.js`

---

## In Scope

| # | Was | Typ | Blocked By |
|---|---|---|---|
| A | `src/stempeluhr-auth.js` — Login gegen `lgc_users.json`, PIN-Prüfung wie in der Stempeluhr | AFK | Sprint 06 |
| B | `login.html` — Standard-Mitgliedslogin plus Umschalter für Funktionslogin | HITL | A |
| C | `src/session.js` / `src/auth-guard.js` — Sessiontypen `stempeluhr` und `lokal` | AFK | A |
| D | `zugriff.json` vorbereiten — globale und individuelle Sperren | AFK | C |
| E | Grundlegende Nutzerführung für gesperrte Mitglieder | HITL | D |

---

## Acceptance Criteria

- [ ] Mitgliedslogin funktioniert mit gültiger Stempeluhr-PIN
- [ ] Ungültige oder nicht aktive Stempeluhr-Nutzer werden sauber abgewiesen
- [ ] Funktionslogin bleibt verfügbar, aber klar vom Mitgliedslogin getrennt
- [ ] Session enthält `authType` und je nach Loginweg die passenden Identitätsfelder
- [ ] `zugriff.json` kann globale und individuelle Sperren beschreiben
- [ ] Gesperrte Mitglieder sehen den Sperrhinweis, können aber keine neuen Wünsche anlegen

---

## Nicht-Ziel dieses Sprints

- Noch keine vollständige Rechteprüfung pro Seite/Aktion
- Noch keine Wunschqueue
- Noch kein Mitglieder-Dashboard
- Noch keine Materialwart-Freigabefälle

---

## Ergebnis

Geplant. Dieser Sprint ist die Brücke zwischen dem bisherigen App-Login und dem späteren
Mehrnutzerbetrieb mit Rollen, Wunschqueue und Mitglieder-Dashboard.
