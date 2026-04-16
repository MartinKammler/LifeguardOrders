# Sammlung-Erweiterung: OG-Besteller, Menge bearbeiten, OG-kostenlos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei Verbesserungen beim Sammeln von Bestellwünschen: Mengen direkt bearbeiten (±/×), fester Besteller „Ortsgruppe" für OG-eigenen Bedarf, und Kennzeichnung einzelner Wünsche als OG-kostenlos.

**Architecture:** `mergeWuensche` als neue Funktion in `sammlung.js`. `bestellung-sammeln.html` bekommt ±/× Buttons, OG-Eintrag im Mitglieder-Dropdown und eine Checkbox „OG übernimmt Kosten". `berechnung.js` erhält ein optionales `opts`-Objekt mit `ogKostenlos`. `bestellung-abgleich.html` und `pdf.js` leiten `ogKostenlos` von den Wünschen durch die Zuweisung bis in die Rechnung weiter; OG-Wünsche (`__og__`) erzeugen keine Rechnung.

**Tech Stack:** Vanilla JS ES Modules, localStorage, bestehende Testinfrastruktur in `tests/test_*.html`

---

## Projektkontext

### Datenfluss

```
wunsch.mitgliedId / wunsch.ogKostenlos
  → bestellung-sammeln.html (erfassen)
  → bestellung.wuensche[] (gespeichert)
  → berechneZuweisung()  (bestellung-abgleich.html)
  → position.zuweisung[].ogKostenlos
  → erstelleRechnungsDaten() (pdf.js)
  → berechneFoerderung(artikel, menge, { ogKostenlos })
  → eigenanteil = 0 wenn ogKostenlos === true
```

### Konstante OG_ID

Überall wo `__og__` verwendet wird, ist `OG_ID = '__og__'` lokal als Konstante definiert.  
`mitgliedName('__og__')` gibt immer `'Ortsgruppe'` zurück.

### Bestehende Schlüsselfunktionen

- `aggregiereWuensche(wuensche)` — summiert nach artikelNr+variante, **ohne** mitgliedId  
- `berechneFoerderung(artikel, menge)` in `src/berechnung.js:22` — wird in Task 3 erweitert  
- `berechneZuweisung(artikelNr, variante, menge)` in `bestellung-abgleich.html:277` — wird in Task 4 erweitert  
- `bauePositionen()` in `bestellung-abgleich.html:442` — wird in Task 4 angepasst  
- `erstelleRechnungsDaten()` in `src/pdf.js:30` — wird in Task 4 angepasst  
- `betroffeneMitgliederIds()` in `bestellung-abgleich.html:510` — wird in Task 4 gefiltert  
- `tests/test_sammlung.html` nutzt eigenen Runner (`suite/test/assert/assertEqual/assertDeepEqual`)  

---

## Task 1: `src/sammlung.js` — `mergeWuensche`

**Files:**
- Modify: `src/sammlung.js`
- Modify: `tests/test_sammlung.html`

**Ziel:** Neue Funktion `mergeWuensche(wuensche)` die Einträge mit gleicher `mitgliedId + artikelNr + variante` zusammenfasst (Menge summieren). Anders als `aggregiereWuensche` bleibt `mitgliedId` erhalten.

- [ ] **Schritt 1: Failing-Test schreiben**

In `tests/test_sammlung.html`, füge am Ende (vor dem Render-Block, aber nach den bestehenden Tests) ein:

```js
// Import-Zeile oben anpassen:
// import { aggregiereWuensche, exportiereCSV, validiereWunsch, mergeWuensche } from '../src/sammlung.js';
```

Ändere die erste Zeile des `<script type="module">`:
```js
import { aggregiereWuensche, exportiereCSV, validiereWunsch, mergeWuensche } from '../src/sammlung.js';
```

Füge neue Tests ein (vor dem `/* ── Render ──` Block):

```js
/* ── Tests: mergeWuensche ──────────────────────────────────── */

suite('mergeWuensche — gleiche Person + gleicher Artikel');

await test('same mitgliedId+artikelNr+variante → Mengen summiert', () => {
  const result = mergeWuensche([
    { id: 'a', mitgliedId: 'martin', artikelNr: 'A001', variante: 'XL', name: 'Shirt', menge: 2 },
    { id: 'b', mitgliedId: 'martin', artikelNr: 'A001', variante: 'XL', name: 'Shirt', menge: 3 },
  ]);
  assertEqual(result.length, 1);
  assertEqual(result[0].menge, 5);
});

await test('same mitgliedId+artikelNr+variante → id des ersten Eintrags behalten', () => {
  const result = mergeWuensche([
    { id: 'first', mitgliedId: 'martin', artikelNr: 'A001', variante: 'XL', name: 'Shirt', menge: 2 },
    { id: 'second', mitgliedId: 'martin', artikelNr: 'A001', variante: 'XL', name: 'Shirt', menge: 1 },
  ]);
  assertEqual(result[0].id, 'first');
});

await test('unterschiedliche Mitglieder, gleicher Artikel → bleiben getrennt', () => {
  const result = mergeWuensche([
    { id: 'a', mitgliedId: 'martin', artikelNr: 'A001', variante: 'M', name: 'Shirt', menge: 1 },
    { id: 'b', mitgliedId: 'dorit',  artikelNr: 'A001', variante: 'M', name: 'Shirt', menge: 1 },
  ]);
  assertEqual(result.length, 2);
});

await test('gleiche Person, unterschiedliche Variante → getrennt', () => {
  const result = mergeWuensche([
    { id: 'a', mitgliedId: 'martin', artikelNr: 'A001', variante: 'M',  name: 'Shirt', menge: 1 },
    { id: 'b', mitgliedId: 'martin', artikelNr: 'A001', variante: 'XL', name: 'Shirt', menge: 1 },
  ]);
  assertEqual(result.length, 2);
});

await test('leeres Array → leeres Array', () => {
  assertDeepEqual(mergeWuensche([]), []);
});

await test('ogKostenlos-Flag bleibt erhalten nach Merge', () => {
  const result = mergeWuensche([
    { id: 'a', mitgliedId: 'martin', artikelNr: 'A001', variante: '', name: 'X', menge: 1, ogKostenlos: true },
    { id: 'b', mitgliedId: 'martin', artikelNr: 'A001', variante: '', name: 'X', menge: 2, ogKostenlos: true },
  ]);
  assertEqual(result[0].ogKostenlos, true);
});
```

- [ ] **Schritt 2: Test im Browser öffnen — `mergeWuensche` not found → FAIL**

Öffne `tests/test_sammlung.html` im Browser. Erwartet: Fehler weil `mergeWuensche` nicht exportiert.

- [ ] **Schritt 3: `mergeWuensche` in `src/sammlung.js` implementieren**

Füge am Ende von `src/sammlung.js` hinzu:

```js
/**
 * Fasst Wünsche mit gleicher mitgliedId + artikelNr + variante zusammen.
 * Die Menge wird summiert. Id, name, ogKostenlos vom ersten Eintrag behalten.
 * Reihenfolge bleibt erhalten (erster Auftritt des Schlüssels bestimmt Position).
 *
 * @param {Array<{id, mitgliedId, artikelNr, variante, name, menge, ogKostenlos?}>} wuensche
 * @returns {Array}
 */
export function mergeWuensche(wuensche) {
  const map = new Map();

  for (const w of wuensche) {
    const key = `${w.mitgliedId}\x00${w.artikelNr}\x00${w.variante}`;
    if (map.has(key)) {
      map.get(key).menge += w.menge;
    } else {
      map.set(key, { ...w });
    }
  }

  return [...map.values()];
}
```

- [ ] **Schritt 4: Test im Browser — alle neuen Tests PASS**

- [ ] **Schritt 5: Commit**

```bash
git add src/sammlung.js tests/test_sammlung.html
git commit -m "feat: mergeWuensche – gleiche Person+Artikel werden zusammengefasst"
```

---

## Task 2: `bestellung-sammeln.html` — ±/× Buttons + Auto-Merge + OG-Besteller + ogKostenlos

**Files:**
- Modify: `bestellung-sammeln.html`

**Ziel:**
1. Wunschliste-Tabelle bekommt − / + / × Buttons statt nur Löschen
2. Beim Hinzufügen: auto-merge wenn gleiche Person+Artikel schon vorhanden
3. Fester Eintrag „Ortsgruppe" ganz oben im Mitglieder-Dropdown
4. Checkbox „OG übernimmt Kosten" im Formular, wird als `ogKostenlos` am Wunsch gespeichert

- [ ] **Schritt 1: Import von `mergeWuensche` ergänzen**

Zeile 234 (aktueller Import):
```js
import { aggregiereWuensche, exportiereCSV, validiereWunsch } from './src/sammlung.js';
```
Ersetzen durch:
```js
import { aggregiereWuensche, exportiereCSV, validiereWunsch, mergeWuensche } from './src/sammlung.js';
```

- [ ] **Schritt 2: OG_ID Konstante + mitgliedName-Funktion anpassen**

Direkt nach den `let`-Deklarationen (nach Zeile 251, vor `function uuid()`):
```js
const OG_ID = '__og__';
```

Funktion `mitgliedName` (Zeile 264) ersetzen:
```js
function mitgliedName(id) {
  if (id === OG_ID) return 'Ortsgruppe';
  const m = mitglieder.find(m => m.id === id);
  return m ? m.name : id;
}
```

- [ ] **Schritt 3: OG-Eintrag im Mitglieder-Dropdown**

In `befuelleSelects()`, die Zeile die `selMitglied.innerHTML` setzt (Zeile 423):
```js
// ALT:
selMitglied.innerHTML = '<option value="">– bitte wählen –</option>' +
  [...mitglieder].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');

// NEU:
selMitglied.innerHTML = '<option value="">– bitte wählen –</option>' +
  `<option value="${OG_ID}">Ortsgruppe (OG-eigener Bedarf)</option>` +
  [...mitglieder].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
```

- [ ] **Schritt 4: Checkbox ins HTML-Formular einfügen**

Im HTML, direkt nach dem `<div class="mt-8">` Block mit dem Hinzufügen-Button (nach Zeile 182, in `#wunsch-formular`):

Suche diesen Block:
```html
      <div class="mt-8">
        <button class="btn btn-primary btn-sm" id="btn-hinzufuegen">+ Hinzufügen</button>
        <span id="wunsch-fehler" class="text-sm" style="color:var(--red);margin-left:10px;display:none"></span>
      </div>
```

Ersetze durch:
```html
      <div class="field" style="grid-column:span 3;margin-top:4px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.88rem">
          <input type="checkbox" id="chk-og-kostenlos">
          OG übernimmt Kosten (Mitglied zahlt nichts)
        </label>
      </div>
      <div class="mt-8">
        <button class="btn btn-primary btn-sm" id="btn-hinzufuegen">+ Hinzufügen</button>
        <span id="wunsch-fehler" class="text-sm" style="color:var(--red);margin-left:10px;display:none"></span>
      </div>
```

- [ ] **Schritt 5: `ogKostenlos` beim Hinzufügen lesen + auto-merge**

Im `btn-hinzufuegen` Click-Handler, das `neuerWunsch`-Objekt (ab Zeile 465):
```js
// ALT:
  const neuerWunsch = {
    id:         uuid(),
    mitgliedId,
    artikelNr:  artikel.artikelNr,
    variante:   artikel.variante || '',
    name:       artikel.name,
    menge:      isNaN(menge) ? 1 : menge,
  };

// NEU:
  const neuerWunsch = {
    id:          uuid(),
    mitgliedId,
    artikelNr:   artikel.artikelNr,
    variante:    artikel.variante || '',
    name:        artikel.name,
    menge:       isNaN(menge) ? 1 : menge,
    ogKostenlos: document.getElementById('chk-og-kostenlos').checked,
  };
```

Nach `wuensche = [...wuensche, neuerWunsch];` (Zeile 481), ersetze durch:
```js
  wuensche = mergeWuensche([...wuensche, neuerWunsch]);
```

Am Ende des Handlers, wo das Formular zurückgesetzt wird (nach `inp-menge`), ergänze:
```js
  document.getElementById('chk-og-kostenlos').checked = false;
```

- [ ] **Schritt 6: ±/× Buttons in `renderWunschliste`**

Die Tabellen-Render-Funktion in `renderWunschliste()` (Zeilen 296–315). Ersetze den gesamten `tbody.innerHTML`-Block und den Event-Handler-Block:

```js
  // Tabelle
  const tbody = document.getElementById('wunsch-tbody');
  tbody.innerHTML = wuensche.map(w => `
    <tr>
      <td>${esc(mitgliedName(w.mitgliedId))}</td>
      <td>
        ${esc(w.name)}
        ${w.ogKostenlos ? '<span class="badge badge-amber" style="font-size:.72rem;margin-left:4px;vertical-align:middle">OG-kostenlos</span>' : ''}
      </td>
      <td><span class="badge badge-blue">${esc(w.variante) || '–'}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-ghost btn-sm" data-action="minus" data-id="${esc(w.id)}" title="Menge verringern" style="padding:2px 8px">−</button>
        <span style="display:inline-block;min-width:20px;text-align:center">${w.menge}</span>
        <button class="btn btn-ghost btn-sm" data-action="plus"  data-id="${esc(w.id)}" title="Menge erhöhen"   style="padding:2px 8px">+</button>
      </td>
      <td style="text-align:right">
        <button class="btn btn-danger btn-sm" data-action="loeschen" data-id="${esc(w.id)}" title="Entfernen">×</button>
      </td>
    </tr>`).join('');

  // Delegierter Event-Handler (einmal auf tbody)
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id     = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'loeschen') {
      wuensche = wuensche.filter(w => w.id !== id);
    } else if (action === 'plus') {
      wuensche = wuensche.map(w => w.id === id ? { ...w, menge: w.menge + 1 } : w);
    } else if (action === 'minus') {
      wuensche = wuensche.map(w => {
        if (w.id !== id) return w;
        return w.menge > 1 ? { ...w, menge: w.menge - 1 } : null;
      }).filter(Boolean);
    }
    renderWunschliste();
  });
```

**Hinweis:** Delegierter Listener wird bei jedem `renderWunschliste`-Aufruf neu auf dem neu erstellten `tbody`-Inhalt registriert. Da `tbody` selbst nicht ersetzt wird (nur sein `innerHTML`), ist das korrekt — alte Handler werden durch den innerHTML-Reset entfernt.

- [ ] **Schritt 7: Manuell testen**

1. Öffne `bestellung-sammeln.html` (neue Bestellung)
2. „Ortsgruppe" erscheint ganz oben im Dropdown
3. Füge denselben Artikel zweimal für dasselbe Mitglied hinzu → wird zusammengeführt, Menge erhöht
4. Verwende −/+ um Menge zu ändern; bei 1 und − verschwindet der Eintrag
5. × löscht den Eintrag
6. Hake „OG übernimmt Kosten" und füge Artikel hinzu → Badge „OG-kostenlos" erscheint in der Zeile

- [ ] **Schritt 8: Commit**

```bash
git add bestellung-sammeln.html
git commit -m "feat: Sammlung – OG-Besteller, ±-Buttons, ogKostenlos-Checkbox, Auto-Merge"
```

---

## Task 3: `src/berechnung.js` — `berechneFoerderung` mit `ogKostenlos`

**Files:**
- Modify: `src/berechnung.js`
- Modify: `tests/test_berechnung.html`

**Ziel:** `berechneFoerderung` akzeptiert ein optionales drittes Argument `{ ogKostenlos: bool }`. Wenn `ogKostenlos === true`: `mitglied = 0`, OG übernimmt den gesamten Eigenanteil (gesamt − bv − lv).

- [ ] **Schritt 1: Failing-Test schreiben**

In `tests/test_berechnung.html`, füge am Ende der bestehenden Tests (vor der Zusammenfassungszeile) ein:

```js
// ogKostenlos
assert('ogKostenlos: mitglied = 0', (() => {
  const artikel = { einzelpreis: 20, bvFoerderung: 5, lvFoerderung: 0, ogFoerderung: 0, ogUebernimmtRest: false };
  const res = berechneFoerderung(artikel, 1, { ogKostenlos: true });
  return res.mitglied === 0;
})());

assert('ogKostenlos: og = gesamt - bv - lv', (() => {
  const artikel = { einzelpreis: 20, bvFoerderung: 5, lvFoerderung: 3, ogFoerderung: 0, ogUebernimmtRest: false };
  const res = berechneFoerderung(artikel, 1, { ogKostenlos: true });
  // gesamt=20, bv=5, lv=3 → og=12
  return res.og === 12;
})());

assert('ogKostenlos: gesamt bleibt korrekt', (() => {
  const artikel = { einzelpreis: 10, bvFoerderung: 2, lvFoerderung: 0, ogFoerderung: 0, ogUebernimmtRest: false };
  const res = berechneFoerderung(artikel, 2, { ogKostenlos: true });
  return res.gesamt === 20;
})());

assert('ohne opts: Verhalten unverändert', (() => {
  const artikel = { einzelpreis: 10, bvFoerderung: 2, lvFoerderung: 0, ogFoerderung: 0, ogUebernimmtRest: false };
  const res = berechneFoerderung(artikel, 1);
  return res.mitglied === 8 && res.og === 0;
})());
```

- [ ] **Schritt 2: Test im Browser — FAIL** (Tests für `ogKostenlos` schlagen fehl)

- [ ] **Schritt 3: `berechneFoerderung` in `src/berechnung.js` erweitern**

Ersetze die gesamte Funktion (Zeilen 22–37):

```js
/**
 * Berechnet alle Förderanteile für eine zugewiesene Position.
 *
 * @param {object} artikel        Artikel-Objekt aus artikel.json
 * @param {number} menge          Zugewiesene Menge (für dieses Mitglied)
 * @param {{ ogKostenlos?: boolean }} [opts]
 * @returns {{ bv, lv, og, mitglied, gesamt }}  Alle Beträge in €
 */
export function berechneFoerderung(artikel, menge, opts = {}) {
  const gesamt = runde(artikel.einzelpreis * menge);
  const bv     = runde(artikel.bvFoerderung * menge);
  const lv     = runde(artikel.lvFoerderung * menge);

  if (opts.ogKostenlos) {
    const og = runde(gesamt - bv - lv);
    return { bv, lv, og, mitglied: 0, gesamt };
  }

  let og;
  if (artikel.ogUebernimmtRest) {
    og = runde(artikel.einzelpreis * menge - bv - lv);
  } else {
    og = runde((artikel.ogFoerderung || 0) * menge);
  }

  const mitglied = Math.max(0, runde(gesamt - bv - lv - og));

  return { bv, lv, og, mitglied, gesamt };
}
```

- [ ] **Schritt 4: Test im Browser — alle PASS**

- [ ] **Schritt 5: Commit**

```bash
git add src/berechnung.js tests/test_berechnung.html
git commit -m "feat: berechneFoerderung – ogKostenlos-Option (Mitgliedanteil = 0)"
```

---

## Task 4: `bestellung-abgleich.html` + `src/pdf.js` — OG-Besteller + ogKostenlos durchleiten

**Files:**
- Modify: `bestellung-abgleich.html`
- Modify: `src/pdf.js`

**Ziel:**
- `__og__`-Wünsche erzeugen keine Rechnung (`betroffeneMitgliederIds` filtert `OG_ID` heraus)
- `ogKostenlos` wird von Wünschen über `berechneZuweisung` → `bauePositionen` → `erstelleRechnungsDaten` → `berechneFoerderung` durchgeleitet
- `mitgliedName` in `bestellung-abgleich.html` kennt `OG_ID`

- [ ] **Schritt 1: `OG_ID` Konstante + `mitgliedName` anpassen**

In `bestellung-abgleich.html`, direkt nach den `let`-Deklarationen am Anfang des `<script>`-Blocks, füge hinzu:

```js
const OG_ID = '__og__';
```

Finde die `mitgliedName`-Funktion (ca. Zeile 245 — suche `function mitgliedName`). Ersetze sie:

```js
function mitgliedName(id) {
  if (id === OG_ID) return 'Ortsgruppe';
  const e = einstellungen?.mitglieder || [];
  const m = e.find(m => m.id === id);
  return m ? m.name : id;
}
```

- [ ] **Schritt 2: `betroffeneMitgliederIds` filtert `__og__` heraus**

Finde `betroffeneMitgliederIds()` (Zeile 510). Ändere die Zeile `if (z.menge > 0) ids.add(z.mitgliedId);`:

```js
function betroffeneMitgliederIds() {
  const ids = new Set();
  for (const p of (bestellung.positionen || [])) {
    if (p.typ === 'og-kosten') continue;
    for (const z of (p.zuweisung || [])) {
      if (z.menge > 0 && z.mitgliedId !== OG_ID) ids.add(z.mitgliedId);
    }
  }
  return [...ids];
}
```

- [ ] **Schritt 3: `berechneZuweisung` gibt `ogKostenlos` aus den Wünschen zurück**

Finde `berechneZuweisung` (Zeile 277). Im `.map`-Aufruf der `zugeteilt`-Variable:

```js
// ALT:
  const zugeteilt = relevant.map(w => ({
    mitgliedId: w.mitgliedId,
    name: mitgliedName(w.mitgliedId),
    wunschMenge: w.menge,
    zugeteiltMenge: Math.floor(geliefertMenge * w.menge / totalWunsch),
  }));

// NEU:
  const zugeteilt = relevant.map(w => ({
    mitgliedId:    w.mitgliedId,
    name:          mitgliedName(w.mitgliedId),
    wunschMenge:   w.menge,
    zugeteiltMenge: Math.floor(geliefertMenge * w.menge / totalWunsch),
    ogKostenlos:   w.ogKostenlos || false,
  }));
```

- [ ] **Schritt 4: `bauePositionen` gibt `ogKostenlos` in der Zuweisung weiter**

In `bauePositionen()` (Zeile 442), alle vier Stellen wo `zuweisung: zuw.map(z => ...)` steht.

Es gibt zwei solche Stellen (exakte Matches + Mengenabweichungen). Ersetze beide:

```js
// ALT:
zuweisung: zuw.map(z => ({ mitgliedId: z.mitgliedId, menge: z.zugeteiltMenge, ogAnteil: 0 })),

// NEU:
zuweisung: zuw.map(z => ({ mitgliedId: z.mitgliedId, menge: z.zugeteiltMenge, ogAnteil: 0, ogKostenlos: z.ogKostenlos || false })),
```

- [ ] **Schritt 5: `src/pdf.js` — OG-Besteller rausfiltern + `ogKostenlos` übergeben**

In `src/pdf.js`, in `erstelleRechnungsDaten` (Zeile 30):

Direkt nach der Zeile `export function erstelleRechnungsDaten(bestellung, mitgliedId, ...)` als erste Prüfung:

```js
export function erstelleRechnungsDaten(bestellung, mitgliedId, einstellungen, artikelListe, alleRechnungen) {
  if (mitgliedId === '__og__') return null;   // OG-Bedarf erzeugt keine Rechnung

  const meinePositionen = [];
  ...
```

Dann in der Stelle wo `berechneFoerderung` aufgerufen wird (Zeile 45):

```js
// ALT:
      const f  = berechneFoerderung(katalogArtikel, zuw.menge);

// NEU:
      const f  = berechneFoerderung(katalogArtikel, zuw.menge, { ogKostenlos: zuw.ogKostenlos || false });
```

- [ ] **Schritt 6: Manuell testen**

1. Bestellung mit OG-Wunsch (Mitglied = „Ortsgruppe") anlegen und speichern
2. Bestellung abschließen (Abgleich)
3. Im Rechnungen-Bereich: „Ortsgruppe" erscheint NICHT unter den Rechnungsempfängern
4. Bestellung mit einem normalen Mitglied und `ogKostenlos = true` anlegen
5. Rechnung erzeugen → Eigenanteil des Mitglieds = 0,00 €

- [ ] **Schritt 7: Commit**

```bash
git add bestellung-abgleich.html src/pdf.js
git commit -m "feat: OG-Besteller erzeugt keine Rechnung; ogKostenlos bis in Rechnungsbetrag durchgeleitet"
```

---

## Self-Review

### Spec-Coverage

| Anforderung | Task | Status |
|---|---|---|
| Gleiche Person + Artikel → Menge summieren | Task 1 (mergeWuensche) + Task 2 (auto-merge on add) | ✅ |
| +/− Buttons in Wunschliste | Task 2 | ✅ |
| × Löschen-Button | Task 2 | ✅ |
| Fester Besteller „Ortsgruppe" | Task 2 (Dropdown) + Task 4 (keine Rechnung) | ✅ |
| Artikel als kostenlos kennzeichnen (OG zahlt) | Task 2 (Checkbox) + Task 3 (Berechnung) + Task 4 (Durchleitung) | ✅ |

### Datenmodell-Änderungen

Neue Felder auf `wunsch`-Objekten:
- `ogKostenlos: boolean` (default: false, optional — alte Daten ohne das Feld funktionieren weiterhin)

Neue Felder auf `zuweisung`-Objekten in `position.zuweisung[]`:
- `ogKostenlos: boolean` (default: false, optional)

Beide Felder sind additiv und breaking-change-frei (alter Code und alte Daten bleiben kompatibel).

### Abhängigkeiten zwischen Tasks

```
Task 1 (sammlung.js)
  ↓
Task 2 (bestellung-sammeln.html)  ←── nutzt mergeWuensche aus Task 1
  
Task 3 (berechnung.js)            ←── unabhängig
  ↓
Task 4 (abgleich + pdf.js)        ←── nutzt neues opts-Param aus Task 3
```

Tasks 1→2 müssen in Reihe. Tasks 3→4 müssen in Reihe. Tasks 2 und 3 können parallel.