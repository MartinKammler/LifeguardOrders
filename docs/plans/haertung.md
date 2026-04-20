# Plan: Härtung & Stabilisierung (Sprints 6–8)

## Zielsetzung

Stabilisierung und Härtung des bestehenden Prototyps, um eine belastbare Grundlage
für produktiven Einsatz im Verein zu schaffen.

Fokus: Sicherheit · Datenintegrität · Wartbarkeit · klare Architektur

---

## Revision 2026-04-19 — Remote-First, Konflikte, Login

Die ursprüngliche Pending-Sync-Richtung reicht für den gewünschten Betrieb nicht mehr aus.
Ab jetzt gelten diese Produktentscheidungen:

- Fachliche Schreibvorgänge nur bei erreichbarer Nextcloud
- Vor jedem Upload Remote-Prüfung (`ETag` / Version)
- Bei Remote-Abweichung: harte Konfliktsperre statt stilles Überschreiben
- App-Login als Vorbereitung auf Mehrnutzerbetrieb
- Audit-Log append-only auf Remote; lokale Kopie nur Cache

Die folgenden Sprintblöcke ersetzen damit die frühere Annahme `local_only | synced | pending`
als Standard-Schreibpfad für fachliche Daten.

---

## Sprint 6 — Sicherheits- & Datenfundament

**Priorität: kritisch**

### 1. Secrets & Zugangsdaten absichern

**Problem:** Nextcloud-Zugangsdaten im Frontend / `localStorage`

- [ ] Entferne alle Default-Zugangsdaten aus dem Code
- [ ] Speichere Passwörter **nicht persistent** (kein localStorage)
- [ ] Nutze stattdessen Session Storage oder Eingabe pro Sitzung
- [ ] Optional vorbereiten: Backend/Proxy für WebDAV

---

### 2. XSS-Schutz (Rendering härten)

**Problem:** Nutzung von `innerHTML` mit potenziell unsicheren Daten

- [ ] Ersetze `innerHTML` durch `textContent` (für Text) bzw. `createElement` + DOM-API
- [ ] Baue zentrale Helper:
  ```js
  function safeText(el, value) { el.textContent = value ?? ''; }
  ```
- [ ] Kritische Felder prüfen: Artikelname, Mitgliedername, Parser-Importe

---

### 3. Zentrale Validierung einführen

**Problem:** Inkonsistente oder fehlerhafte Daten möglich

- [ ] `validation.js` erstellen (Ausbau des bestehenden `validiereWunsch` in sammlung.js)
- [ ] Regeln für Positionen, Beträge, Datumsfelder definieren
- [ ] Validieren bei: Eingabe, Import, vor Speicherung

---

### 4. Förderlogik absichern

**Problem:** Negative Mitgliedskosten möglich

- [ ] In `berechneFoerderung()` prüfen: Summe Förderungen ≤ Gesamt
- [ ] Clamping einführen:
  ```js
  mitglied = Math.max(0, gesamt - foerderSumme);
  ```

---

### 5. Datums-Handling vereinheitlichen

**Problem:** String-Sortierung potenziell fehleranfällig

- [ ] Intern ausschließlich ISO-Format (`YYYY-MM-DD`) — bereits weitgehend so
- [ ] Sortierungen auf `Date`-Vergleich umstellen:
  ```js
  new Date(a).getTime() - new Date(b).getTime()
  ```

---

## Sprint 7 — Architektur & Stabilität

**Priorität: hoch**

### 6. Inline-Skripte aus HTML entfernen

**Problem:** Logik verteilt und schwer wartbar

- [ ] Pro Seite eigenes JS-Modul (bereits teilweise vorhanden: `einstellungen-app.js`, `artikel-app.js`)
- [ ] Verbleibende Seiten (kassenwart, rechnungen, dashboard) in eigene `*-app.js` auslagern
- [ ] HTML enthält nur `<script type="module" src="..."></script>`

---

### 7. Schichtenmodell einführen *(optional)*

> **Hinweis:** Für einen 1-Admin-Vereinsapp mit Vanilla-JS ist ein vollständiges
> Schichtenmodell over-engineering. Nur umsetzen wenn Codebasis deutlich wächst.

Zielstruktur falls gewünscht:
```
src/
 ├── domain/        (Fachlogik)
 ├── application/   (Use Cases)
 ├── infra/         (WebDAV, Storage)
 └── ui/            (Rendering)
```

---

### 8. Storage-Wrapper einführen

**Problem:** Direkte Nutzung von `localStorage` verstreut im Code

- [ ] `storage.js` erstellen:
  ```js
  export function load(key) {
    return JSON.parse(localStorage.getItem(key) || 'null');
  }
  export function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  ```
- [ ] Versionierung einführen: `{ data: ..., version: 3 }`

---

### 9. Sync-Strategie auf Remote-First umstellen (Nextcloud)

**Problem:** Inkonsistente Zustände und stille Überschreibungen

- [ ] `src/webdav.js` um `ETag`/Remote-Metadaten erweitern
- [ ] `src/sync.js` auf Zustände umstellen: `synced` | `conflict` | `offline-readonly` | `auth-required`
- [ ] Vor jedem Upload Remote-Version prüfen
- [ ] Schreiben bei Konflikt oder Remote-Ausfall sperren
- [ ] Startseite und Fachseiten zeigen Konflikt-/Remote-Status sichtbar an

---

### 10. Parser robuster machen

- [ ] Rückgabe erweitern:
  ```js
  { data: [...], warnings: [...], errors: [...] }
  ```
- [ ] Import-Vorschau einbauen
- [ ] Tests mit echten Beispieldaten ergänzen

---

## Sprint 8 — Produktionsfähigkeit

**Priorität: mittel**

### 11. Rechnungen und Änderungen remote auditierbar machen

- [ ] Snapshot speichern (keine nachträgliche Änderung der Positionsdaten)
- [ ] Eindeutige Rechnungsnummer sicherstellen (Race-Condition-Schutz)
- [ ] Remote-Audit-Log append-only führen
- [ ] Audit-Einträge immer mit aktuellem App-Nutzer anreichern
- [ ] Kritische Aktionen bei Audit-Write-Fehler abbrechen

---

### 12. App-Login und Rollenmodell vorbereiten

> **Hinweis:** Im Frontend-Only-Betrieb dient das App-Login der Nutzerzuordnung,
> Rollensteuerung und Auditierung, nicht einer harten technischen Zugriffskontrolle.

Minimalmodell: Admin · Kassenwart · Verwaltung · Leser

- [ ] `benutzer.json` einführen
- [ ] Login-Seite + Session-Guard bauen
- [ ] Rollenstruktur definieren
- [ ] UI- und Aktionsrechte vorbereiten

---

### 13. Konflikt-UX und Nachvollziehbarkeit

- [ ] Konfliktdialoge statt `alert()`/`confirm()` für kritische Speicherpfade
- [ ] Aktionen bei Konflikt:
  ```js
  { action: "REMOTE_RELOAD" | "EXPORT_LOCAL_COPY" | "ABORT_SAVE", user: "Martin", timestamp: "...", scope: "bestellungen" }
  ```
- [ ] Kein Auto-Merge für fachliche Kerndaten in Phase 1

---

### 14. Test-Setup einführen *(optional)*

> **Hinweis:** Die bestehenden HTML-Testseiten sind wartungsarm und funktionieren.
> Umstieg auf Vitest/Jest nur wenn das Projekt deutlich wächst.

- [ ] `package.json`
- [ ] Vitest oder Jest
- [ ] Bestehende Logik-Tests migrieren

---

### 15. Linting & Formatierung *(optional)*

> **Hinweis:** Sinnvoll bei Team-Entwicklung, für Solo-Projekt niedrige Priorität.

- [ ] ESLint
- [ ] Prettier
- [ ] Pre-commit Hook

---

## Erwartetes Ergebnis nach Sprint 6–8

- ✅ Keine sensiblen Daten persistent im Frontend
- ✅ Stabile Datenvalidierung
- ✅ Deutlich reduzierte XSS-Angriffsfläche
- ✅ Remote-first Sync ohne stille Überschreibungen
- ✅ Harte Konfliktsperre bei parallelen Änderungen
- ✅ App-Login als Vorbereitung für Mehrnutzerbetrieb
- ✅ Remote-Audit für abrechnungsrelevante Aktionen
- ✅ Saubere Architektur-Basis
- ✅ Testbare Kernlogik
- ✅ Bereit für Backend-Erweiterung

---

## Anschlussplanung Mehrnutzerbetrieb

Die Härtung aus Sprint 6 bildet nur die technische Grundlage. Der eigentliche
Mehrnutzer-Ausbau mit Mitgliedslogin über die Stempeluhr, lokalem Funktionslogin,
Rollenprüfung, Wunschqueue und Mitglieder-Dashboard ist separat geplant in:

- `docs/plans/auth-rbac-userflow.md`
- `docs/sprints/sprint-07.md`
- `docs/discovery/offene-fragen-auth-userflow.md`

Diese Trennung ist bewusst: Erst Datenintegrität und Konfliktsperre, danach
Mehrnutzerbetrieb auf belastbarer Basis.

---

## Empfehlung zum weiteren Ausbau

**Option A – Lightweight** (empfohlen für kleinen Verein):
Frontend + Nextcloud, Remote-first Schreiblogik, App-Login, kein eigener Server

**Option B – Professionell**:
Kleines Backend (FastAPI / Node.js), Auth + API + zentrale Persistenz
