# Sprint 09: Audit-Anreicherung & Session-Governance

## Sprint Goal

Audit-Einträge werden vollständig auf Funktionskonto + handelnde Person zurückgeführt.
Jede sicherheitsrelevante Aktion ist personell nachvollziehbar, unabhängig davon welche
Seite die Aktion ausgelöst hat.

---

## Ausgangslage

Sprint 07 hat die handelnde Person beim Funktionslogin als Pflichtschritt eingeführt
(`login-app.js`: `ladeHandelndePersonen`, `leseHandelndePerson`, Blocking ohne Auswahl).
Sprint 08 hat die Rollenmatrix in `authz.js` hart umgesetzt.

**Lücke:** `auditAktion()` in `audit.js` nimmt `user` als einfachen String oder `{ id }`.
Session-Metadaten wie `authType`, `rolle`, `actingPersonId`, `actingPersonName` landen
nicht im Audit-Eintrag. Ein Eintrag „ZAHLUNG_GESETZT" von Funktion `finanzen`,
ausgeführt durch Person „Nicole Weber", ist im Log nicht von einem Admin-Eintrag
derselben Aktion unterscheidbar.

---

## Produktentscheidungen

- `auditAktion` wird **session-aware**: übergibst du ein Session-Objekt statt einer
  String-ID, werden alle prüfrelevanten Felder automatisch extrahiert
- Das Audit-Schema bleibt append-only — keine Migration alter Einträge
- Callsites (rechnungen.html, bestellung-abgleich.html usw.) übergeben ab jetzt
  das vollständige `getSession()`-Objekt, nicht `user: getSession().id`
- `logAktion` bekommt Session-Felder als eigenen Block `actor` im Eintrag
  (kein Ändern der bestehenden Felder `action`, `user`, `timestamp`, `changes`)

---

## Neues Audit-Eintragsformat

```js
{
  id:              string,   // UUID
  action:          string,   // z.B. 'ZAHLUNG_GESETZT'
  timestamp:       string,   // ISO
  scope:           string,
  entityId:        string,
  summary:         string,
  changes:         object,

  // Neu in Sprint 09:
  actor: {
    userId:          string,  // session.id (Funktionskonto-ID oder Mitglieds-ID)
    userName:        string,  // session.name
    authType:        string,  // 'lokal' | 'stempeluhr'
    sessionRole:     string,  // session.rolle  ('admin'|'finanzen'|'materialwart'|'user')
    actingPersonId:  string,  // session.actingPersonId  ('' wenn Mitglied)
    actingPersonName:string,  // session.actingPersonName ('' wenn Mitglied)
  },

  // Legacy-Kompatibilität: bleibt erhalten
  user:  string,  // = actor.userId (wird weiter befüllt)
}
```

---

## In Scope

| # | Was | Typ | Blocked By |
|---|---|---|---|
| A | `src/audit.js` — `logAktion` + `auditAktion` um `actor`-Block erweitern | AFK | – |
| B | `tests/test_audit.html` — neue Assertions für `actor`-Block, Rückwärtskompatibilität | AFK | A |
| C | `rechnungen.html` — `user: getSession()` statt `user: getSession().id` | HITL | A |
| D | `bestellung-abgleich.html` — gleiche Callsite-Änderung | HITL | A |
| E | Alle anderen Callsites im Projekt suchen und anpassen | AFK | A |

---

## Technische Details

### A — audit.js

`logAktion(action, user, changes, meta)`:
- `user` darf jetzt entweder ein Session-Objekt `{ id, name, rolle, authType, actingPersonId, actingPersonName }` oder ein einfacher String (Legacy) sein
- Wenn Objekt: `actor`-Block aus Session-Feldern aufbauen, `user`-Feld = `session.id`
- Wenn String: `actor`-Block mit Defaults (`authType: ''`, Rest leer), `user`-Feld = String — Rückwärtskompatibilität

Neue Hilfsfunktion (privat):
```js
function buildActor(user) {
  if (!user || typeof user === 'string') {
    return { userId: user || '', userName: '', authType: '', sessionRole: '', actingPersonId: '', actingPersonName: '' };
  }
  return {
    userId:           user.id           || '',
    userName:         user.name         || '',
    authType:         user.authType     || '',
    sessionRole:      user.rolle        || '',
    actingPersonId:   user.actingPersonId   || '',
    actingPersonName: user.actingPersonName || '',
  };
}
```

`auditAktion({ ..., user })`:
- `user` wird direkt an `logAktion` weitergegeben — kein `.id`-Extrahieren mehr
- Entfernt die Zeile `const userId = typeof user === 'string' ? user : user?.id || '';`

### B — tests/test_audit.html

Neue Test-Gruppen:
1. `logAktion` mit Session-Objekt → `actor`-Block korrekt befüllt
2. `logAktion` mit String → Rückwärtskompatibilität, `actor.userId === string`
3. `logAktion` mit null → kein Fehler, `actor.userId === ''`
4. Funktionssession mit `actingPersonId` → landet in `actor`
5. Mitgliedssession (`authType: 'stempeluhr'`) → `actingPersonId` leer

### C+D+E — Callsites

Suche im Projekt nach `auditAktion({` und `logAktion(` — alle Stellen prüfen:
- `rechnungen.html`: `user: getSession()` (statt `user: getSession()` — schon ein Objekt, aber vorher wurde `.id` extrahiert in `auditAktion`)
- `bestellung-abgleich.html`: gleich
- Andere Stellen falls vorhanden

Da `auditAktion` das Session-Objekt jetzt direkt entgegennimmt und `logAktion` es korrekt
verarbeitet, ist der einzige Callsite-Change: `user: getSession()` bleibt wie es ist.
Die interne Extrahier-Logik fällt weg.

---

## Acceptance Criteria

- [ ] Jeder Audit-Eintrag enthält einen `actor`-Block mit `userId`, `userName`, `authType`, `sessionRole`, `actingPersonId`, `actingPersonName`
- [ ] Rückwärtskompatibilität: `user`-Feld bleibt im Eintrag erhalten
- [ ] String-Input und null in `logAktion` werfen keinen Fehler
- [ ] `test_audit.html` deckt alle neuen Fälle ab, alle alten Tests bleiben grün
- [ ] Keine Callsite übergibt mehr `user?.id` oder `user.id` an `auditAktion`
- [ ] Alle 12 Testseiten bleiben grün

---

## Nicht in Scope

- Keine Audit-Ansicht im UI (kommt Sprint 13)
- Kein Session-Timeout kürzer als 30 Min für `admin`/`finanzen` (kommt Sprint 13)
- Keine Before/After-Felder im `changes`-Block (kommt Sprint 13)
- Kein Login ohne handelnde Person verhindern — ist bereits implementiert (Sprint 07)

---

## Abgrenzung zu Sprint 13

Sprint 13 (Audit & Session-Härtung) baut darauf auf:
- `before`/`after` im `changes`-Block
- kürzere Session-Lebensdauer für `admin`/`finanzen`
- Audit-Ansicht im Admin-UI

Sprint 09 legt nur das Datenfundament (vollständiger `actor`-Block).

---

## Ergebnis

Offen — Sprint geplant.
