# Sprint 10: Wunschqueue

## Sprint Goal

Mitglieder können Wünsche für die nächste Sammelbestellung einreichen.
Wünsche liegen getrennt von `bestellungen.json` in einer eigenen Queue.
Admins sehen offene Wünsche und können sie übernehmen, ablehnen oder teilweise übernehmen.

---

## Ausgangslage

Sprint 09 hat Audit-Einträge mit vollständigen Session-Metadaten ausgestattet.
Sprint 08 hat die Rollenmatrix in `authz.js` hart umgesetzt.
`mitglied.html` ist ein Platzhalter — dieser Sprint füllt ihn mit Leben.

---

## Datenmodell

**`/LifeguardOrders/wuensche.json`** — Array von Wunsch-Objekten:

```
id:               string   — UUID
mitgliedId:       string   — wer möchte es
artikelNr:        string
variante:         string   — '' wenn keine Variante
name:             string   — Bezeichnung
menge:            number   — positive ganze Zahl
status:           enum     — s.u.
erstelltAm:       string   — ISO
geaendertAm:      string   — ISO
geaendertVon:     string   — session.id der letzten Änderung
kommentar:        string   — optionaler Admin-Grund (sichtbar für Mitglied)
mengeUebernommen: number   — bei teilweise_uebernommen: übernommene Menge
bestellungId:     string   — Referenz auf Sammelbestellung wenn uebernommen
```

---

## Statusmodell

```
offen ──────────────→ abgelehnt
offen ──────────────→ storniert       ← auch User (eigener Wunsch)
offen ──────────────→ uebernommen
offen ──────────────→ teilweise_uebernommen

teilweise_uebernommen → uebernommen
teilweise_uebernommen → storniert

abgelehnt ──────────→ offen           ← Admin kann Ablehnung zurücknehmen

uebernommen:     terminal
storniert:       terminal
```

---

## Berechtigungen

| Aktion | admin | finanzen | materialwart | user |
|---|---|---|---|---|
| Wunsch anlegen | ✅ | ❌ | ❌ | ✅ (eigener) |
| Wunsch ändern | ✅ (alle offen/abgelehnt/teilw.) | ❌ | ❌ | ✅ (eigener, nur offen) |
| Wunsch stornieren | ✅ (alle nicht-terminalen) | ❌ | ❌ | ✅ (eigener, nur offen) |
| Wunsch übernehmen | ✅ | ❌ | ❌ | ❌ |
| Admin-Queue sehen | ✅ | ❌ | ❌ | ❌ |
| Eigene Wünsche sehen | ✅ | ❌ | ❌ | ✅ |

---

## In Scope

| # | Was | Typ |
|---|---|---|
| A | `src/wunsch.js` — Datenmodell, Statusmaschine, Filterlogik | AFK |
| B | `tests/test_wunsch.html` — TDD, alle Geschäftsregeln | AFK |
| C | `wuensche.html` — Mitgliederseite: Wunsch anlegen, eigene Liste, stornieren | HITL |
| D | `wunsch-queue.html` — Admin-Queue: Wünsche sehen, übernehmen, ablehnen | HITL |
| E | `mitglied.html` — Link zu wuensche.html einbauen | HITL |
| F | `src/authz.js` — Scopes 'wuensche' und 'wunsch-queue' in Rollenmatrix ergänzen | AFK |

---

## Acceptance Criteria

- [x] `src/wunsch.js` exportiert: `erstelleWunsch`, `validateWunschEintrag`, `istTerminal`, `kannMutieren`, `kannStornieren`, `setzeStatus`, `erlaubteUebergaenge`, `filterFuerMitglied`, `filterAdminQueue`, `normalizeWunsch`, `isValidWuenscheListe`
- [x] Alle Statusübergänge sind in der Statusmaschine definiert; ungültige Übergänge werfen einen Error
- [x] `wuensche.html`: Mitglied kann Wunsch anlegen, eigene Wünsche sehen, stornieren
- [x] `wunsch-queue.html`: Admin sieht offene Queue, kann übernehmen/ablehnen/teilweise übernehmen
- [x] Wünsche werden auf Nextcloud unter `/LifeguardOrders/wuensche.json` gespeichert
- [x] Alle authz-Prüfungen über `authz.js` (kein Rollen-Check in den HTML-Seiten)
- [x] Alle 13 Testseiten grün (12 bestehende + test_wunsch.html)

---

## Nicht in Scope

- Übernahme in offizielle Sammelbestellung (kommt Sprint 11)
- Mitglieder-Dashboard mit Stunden/Förderübersicht (kommt Sprint 11)
- `erledigt`-Status (kommt wenn Bestellung abgeschlossen — Sprint 11+)
- E-Mail-Benachrichtigung bei Status-Änderung

---

## Ergebnis

Abgeschlossen. 77 Assertions in test_wunsch.html, 13/13 Testseiten grün.
