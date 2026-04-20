# Sprint 08: authz.js & harte Rechteprüfung pro Seite/Aktion

## Sprint Goal

Rollen werden nicht mehr nur durch versteckte Buttons simuliert, sondern zentral in
`src/authz.js` geprüft. `auth-guard.js` blockiert unberechtigte Seitenaufrufe sofort.
Seiten prüfen Schreib-Aktionen vor jedem Speichervorgang.

---

## Produktentscheidungen

- Rechteprüfung erfolgt ausschließlich über `src/authz.js`, nicht verstreut in HTML-Seiten
- Eine unberechtigte Seite führt zu einem Zugriffsverweigert-Screen (nicht zu Login)
- Schreibaktionen werden serverseitig durch den Sync-Status blockiert, clientseitig durch authz
- `user`-Sessions dürfen nur `mitglied.html` sehen — alle anderen Seiten leiten zu `mitglied.html`

---

## Rollenmatrix

### Seiten-Lesezugriff

| Seite                   | admin | finanzen | materialwart | user |
|-------------------------|-------|----------|--------------|------|
| index.html              | ✅    | ✅       | ✅           | ❌   |
| bestellungen.html       | ✅    | ✅       | ✅           | ❌   |
| bestellung-neu.html     | ✅    | ❌       | ❌           | ❌   |
| bestellung-sammeln.html | ✅    | ❌       | ❌           | ❌   |
| bestellung-abgleich.html| ✅    | ❌       | ❌           | ❌   |
| artikel.html            | ✅    | ❌       | ✅           | ❌   |
| materialbestand.html    | ✅    | ❌       | ✅           | ❌   |
| rechnungen.html         | ✅    | ✅       | ❌           | ❌   |
| kassenwart.html         | ✅    | ✅       | ❌           | ❌   |
| dashboard.html          | ✅    | ✅       | ✅           | ❌   |
| einstellungen.html      | ✅    | ❌       | ❌           | ❌   |
| mitglied.html           | ❌    | ❌       | ❌           | ✅   |

### Schreibaktionen

| Aktion                   | admin | finanzen | materialwart | user |
|--------------------------|-------|----------|--------------|------|
| bestellung-schreiben     | ✅    | ❌       | ❌           | ❌   |
| bestellung-abschliessen  | ✅    | ❌       | ❌           | ❌   |
| rechnung-erstellen       | ✅    | ✅       | ❌           | ❌   |
| zahlung-setzen           | ✅    | ✅       | ❌           | ❌   |
| foerderung-aendern       | ✅    | ✅       | ❌           | ❌   |
| artikel-schreiben        | ✅    | ❌       | ✅           | ❌   |
| materialbestand-schreiben| ✅    | ❌       | ✅           | ❌   |
| einstellungen-schreiben  | ✅    | ❌       | ❌           | ❌   |
| nutzer-verwalten         | ✅    | ❌       | ❌           | ❌   |
| zugriff-setzen           | ✅    | ❌       | ❌           | ❌   |

---

## In Scope

| # | Was | Typ |
|---|---|---|
| A | `src/authz.js` — canRead, canWrite, darfAktion, seitenfuerRolle, requireSeite | AFK |
| B | `tests/test_authz.html` — Tests für alle Rollenmatrix-Kombinationen | AFK |
| C | `src/auth-guard.js` — Seiten-Lesezugriff prüfen, `zugriff-verweigert` statt Login | AFK |
| D | `bestellungen.html`, `rechnungen.html`, `kassenwart.html` — Aktionen per authz prüfen | HITL |

---

## Acceptance Criteria

- [x] `canRead(scope, session)` gibt für alle Rollen/Scope-Kombinationen das richtige Ergebnis
- [x] `canWrite(scope, session)` gibt für alle Rollen/Scope-Kombinationen das richtige Ergebnis
- [x] `darfAktion(aktion, session)` gibt für alle Aktions/Rollen-Kombinationen das richtige Ergebnis
- [x] `auth-guard.js` blockiert Funktionssessions, die eine nicht erlaubte Seite aufrufen
- [x] `finanzen` kann `rechnungen.html` und `kassenwart.html` öffnen, nicht aber `einstellungen.html`
- [x] `materialwart` kann `artikel.html` und `materialbestand.html` öffnen, nicht aber `rechnungen.html`
- [x] `user` wird von allen Seiten außer `mitglied.html` ferngehalten
- [x] Alle 11 bestehenden Testseiten bleiben grün (+ 1 neue: test_authz.html, 109 Assertions)

---

## Ergebnis

Abgeschlossen. 109 Assertions in test_authz.html, 12/12 Testseiten grün.
