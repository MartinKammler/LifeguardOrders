# Wunsch bearbeiten & ogKostenlos-Toggle – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bestehende Wünsche in der Sammelliste können über ein Bearbeiten-Modal vollständig bearbeitet werden (Mitglied, Artikel, Menge, ogKostenlos), und ogKostenlos lässt sich zusätzlich per Quick-Toggle-Button direkt in der Zeile umschalten.

**Architecture:** Alle Änderungen ausschließlich in `bestellung-sammeln.html`. Das Edit-Modal dupliziert das Artikel-Suche-Muster mit eigenen Element-IDs (`*-edit`). Der delegierte Click-Handler auf `wunsch-tbody` (bereits in `init()` einmalig registriert) wird um `bearbeiten` und `og-toggle` erweitert.

**Tech Stack:** Vanilla JS ES Modules, kein Build-Tool, kein npm

---

## File-Struktur

Nur eine Datei wird geändert:

- Modify: `bestellung-sammeln.html`
  - `<style>`: Modal-CSS (overlay, card)
  - HTML: Modal-Markup vor `<script>`
  - `renderWunschliste()`: OG-Toggle-Button + Bearbeiten-Button pro Zeile
  - Neue Hilfsfunktionen: `aktualisiereArtikelListeEdit`, `waehleArtikelEdit`, `schliesseDropdownEdit`
  - Neue Haupt-Logik: `oeffneBearbeitenModal`, `schliesseBearbeitenModal`
  - Neue Listener: inp-artikel-suche-edit (input + blur), btn-bearbeiten-abbrechen, btn-bearbeiten-speichern, keydown Escape
  - `init()` → delegierter Handler erweitert um `og-toggle` + `bearbeiten`

Kein neues src/-Modul, keine neue Testdatei — die Logik ist reines DOM-Interaction, `mergeWuensche` ist bereits getestet.

---

## Task 1: Modal HTML/CSS + Buttons in Tabellenzeile

**Files:**
- Modify: `bestellung-sammeln.html`

- [ ] **Step 1: Modal-CSS in `<style>` einfügen**

Am Ende des bestehenden `<style>`-Blocks (nach `.ao-meta { … }`) einfügen:

```css
/* Edit-Modal */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 500;
  align-items: center;
  justify-content: center;
}
.modal-overlay.open { display: flex; }
.modal-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  width: min(480px, 90vw);
  box-shadow: 0 12px 40px rgba(0,0,0,.6);
}
.modal-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 16px;
}
```

- [ ] **Step 2: Modal-HTML vor `<script type="module">` einfügen**

Direkt vor `<script type="module">` einfügen:

```html
<!-- Modal: Wunsch bearbeiten -->
<div class="modal-overlay" id="modal-bearbeiten">
  <div class="modal-card">
    <p class="modal-title">Wunsch bearbeiten</p>
    <div class="form-grid triple">
      <div class="field">
        <label for="sel-mitglied-edit">Mitglied</label>
        <select id="sel-mitglied-edit"></select>
      </div>
      <div class="field artikel-field-wrap">
        <label for="inp-artikel-suche-edit">Artikel</label>
        <input type="text" id="inp-artikel-suche-edit" placeholder="Suche…" autocomplete="off">
        <div id="artikel-dropdown-edit" class="artikel-dropdown"></div>
        <input type="hidden" id="sel-artikel-id-edit">
      </div>
      <div class="field">
        <label for="inp-menge-edit">Menge</label>
        <input type="number" id="inp-menge-edit" min="1" value="1">
      </div>
    </div>
    <div class="field" style="margin-top:4px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.88rem">
        <input type="checkbox" id="chk-og-kostenlos-edit">
        OG übernimmt Kosten (Mitglied zahlt nichts)
      </label>
    </div>
    <div class="flex gap-8 mt-16" style="justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" id="btn-bearbeiten-abbrechen">Abbrechen</button>
      <button class="btn btn-primary btn-sm" id="btn-bearbeiten-speichern">Speichern</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Tabellenzeile in `renderWunschliste()` erweitern**

In `renderWunschliste()` die letzte `<td>` der Row (aktuell nur der ×-Button) ersetzen.

Von:
```html
      <td style="text-align:right">
        <button class="btn btn-danger btn-sm" data-action="loeschen" data-id="${esc(w.id)}">×</button>
      </td>
```

Zu:
```html
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-ghost btn-sm" data-action="og-toggle" data-id="${esc(w.id)}"
          title="OG übernimmt Kosten ein/aus"
          style="padding:2px 8px;${w.ogKostenlos ? 'color:var(--amber);font-weight:700' : ''}">OG</button>
        <button class="btn btn-ghost btn-sm" data-action="bearbeiten" data-id="${esc(w.id)}"
          style="padding:2px 8px" title="Bearbeiten">✎</button>
        <button class="btn btn-danger btn-sm" data-action="loeschen" data-id="${esc(w.id)}">×</button>
      </td>
```

- [ ] **Step 4: Kurz manuell prüfen**

Browser: `bestellung-sammeln.html` laden, Wunsch hinzufügen → Zeile muss OG-, ✎- und ×-Button zeigen. Modal noch ohne Funktion.

- [ ] **Step 5: Commit**

```bash
git add bestellung-sammeln.html
git commit -m "feat: Wunsch-Tabelle – OG-Toggle + Bearbeiten-Button, Edit-Modal HTML/CSS"
```

---

## Task 2: Edit-Modal Logik + delegierter Handler

**Files:**
- Modify: `bestellung-sammeln.html`

**Kontext:** `bestellung-sammeln.html` importiert bereits `OG_ID`, `esc`, `mergeWuensche`. State-Variablen `wuensche`, `mitglieder`, `artikelListe`, `sortierteArtikel` sind global im Modul. Bestehende Funktionen `eur()`, `artikelLabel()`, `schliesseDropdown()`, `waehleArtikel()`, `aktualisiereArtikelListe()` dienen als Vorlage für die Edit-Varianten.

- [ ] **Step 1: State-Variable `bearbeitenId` deklarieren**

Direkt nach `let sortierteArtikel = [];` einfügen:

```js
let bearbeitenId = null; // ID des aktuell bearbeiteten Wunsches
```

- [ ] **Step 2: Hilfsfunktionen für Edit-Artikel-Suche hinzufügen**

Direkt nach der bestehenden Funktion `schliesseDropdown()` einfügen:

```js
/* ── Artikel-Suche im Edit-Modal ─────────────────────────────── */
function schliesseDropdownEdit() {
  document.getElementById('artikel-dropdown-edit').classList.remove('open');
}

function waehleArtikelEdit(id) {
  const art = artikelListe.find(a => a.id === id);
  if (!art) return;
  document.getElementById('sel-artikel-id-edit').value    = art.id;
  document.getElementById('inp-artikel-suche-edit').value = artikelLabel(art);
  schliesseDropdownEdit();
}

function aktualisiereArtikelListeEdit(suche) {
  const dropdown  = document.getElementById('artikel-dropdown-edit');
  const suchLower = suche.toLowerCase().trim();
  const gefiltert = suchLower
    ? sortierteArtikel.filter(a =>
        (a.name + ' ' + (a.variante || '') + ' ' + (a.artikelNr || ''))
          .toLowerCase().includes(suchLower))
    : [];

  if (!gefiltert.length) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('open');
    return;
  }

  dropdown.innerHTML = gefiltert.map(a => {
    const varianteBadge = a.variante
      ? `<span class="badge badge-blue" style="font-size:.72rem;padding:1px 6px">${esc(a.variante)}</span>`
      : '';
    const preis = a.einzelpreis != null ? eur(a.einzelpreis) : '';
    return `<div class="artikel-option" data-id="${esc(a.id)}">
      <div class="ao-name">${esc(a.name)}${varianteBadge}</div>
      <div class="ao-meta">${esc(a.artikelNr)}${preis ? ' · ' + preis : ''}</div>
    </div>`;
  }).join('');

  dropdown.querySelectorAll('.artikel-option').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      waehleArtikelEdit(el.dataset.id);
    });
  });

  dropdown.classList.add('open');
}
```

- [ ] **Step 3: Listener für Edit-Artikel-Suche registrieren**

Direkt nach den bestehenden `inp-artikel-suche`-Listenern (nach dem `blur`-Handler) einfügen:

```js
document.getElementById('inp-artikel-suche-edit').addEventListener('input', e => {
  aktualisiereArtikelListeEdit(e.target.value);
  document.getElementById('sel-artikel-id-edit').value = '';
});

document.getElementById('inp-artikel-suche-edit').addEventListener('blur', () => {
  setTimeout(schliesseDropdownEdit, 150);
});
```

- [ ] **Step 4: Modal öffnen/schließen/speichern**

Direkt nach den Edit-Artikel-Suche-Listenern einfügen:

```js
/* ── Edit-Modal öffnen / schließen / speichern ───────────────── */
function oeffneBearbeitenModal(id) {
  const w = wuensche.find(w => w.id === id);
  if (!w) return;
  bearbeitenId = id;

  // Mitglied-Select befüllen
  const selMitglied = document.getElementById('sel-mitglied-edit');
  selMitglied.innerHTML =
    `<option value="${OG_ID}">Ortsgruppe (OG-eigener Bedarf)</option>` +
    [...mitglieder].sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  selMitglied.value = w.mitgliedId;

  // Artikel vorbelegen (Suche nach artikelNr + variante)
  const art = artikelListe.find(a =>
    a.artikelNr === w.artikelNr && (a.variante || '') === w.variante);
  if (art) {
    document.getElementById('sel-artikel-id-edit').value    = art.id;
    document.getElementById('inp-artikel-suche-edit').value = artikelLabel(art);
  } else {
    // Artikel nicht mehr im Katalog: Freitext zeigen, ID leer lassen
    document.getElementById('sel-artikel-id-edit').value    = '';
    document.getElementById('inp-artikel-suche-edit').value =
      w.name + (w.variante ? ' ' + w.variante : '');
  }

  document.getElementById('inp-menge-edit').value          = w.menge;
  document.getElementById('chk-og-kostenlos-edit').checked = !!w.ogKostenlos;

  document.getElementById('modal-bearbeiten').classList.add('open');
  selMitglied.focus();
}

function schliesseBearbeitenModal() {
  bearbeitenId = null;
  document.getElementById('modal-bearbeiten').classList.remove('open');
}

document.getElementById('btn-bearbeiten-abbrechen').addEventListener('click', schliesseBearbeitenModal);

document.getElementById('btn-bearbeiten-speichern').addEventListener('click', () => {
  if (!bearbeitenId) return;

  const mitgliedId  = document.getElementById('sel-mitglied-edit').value;
  const artikelId   = document.getElementById('sel-artikel-id-edit').value;
  const menge       = parseInt(document.getElementById('inp-menge-edit').value, 10);
  const ogKostenlos = document.getElementById('chk-og-kostenlos-edit').checked;

  const artikel = artikelListe.find(a => a.id === artikelId);
  if (!artikel) {
    alert('Bitte einen gültigen Artikel aus der Suche auswählen.');
    return;
  }
  if (!mitgliedId) {
    alert('Bitte ein Mitglied auswählen.');
    return;
  }
  if (isNaN(menge) || menge < 1) {
    alert('Menge muss mindestens 1 sein.');
    return;
  }

  // Bestehenden Wunsch aktualisieren, dann mergen (falls Edit einen Duplikat erzeugt)
  wuensche = wuensche.map(w => {
    if (w.id !== bearbeitenId) return w;
    return {
      ...w,
      mitgliedId,
      artikelNr:  artikel.artikelNr,
      variante:   artikel.variante || '',
      name:       artikel.name,
      menge,
      ogKostenlos,
    };
  });
  wuensche = mergeWuensche(wuensche);

  schliesseBearbeitenModal();
  renderWunschliste();
});

// Escape-Taste schließt Modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') schliesseBearbeitenModal();
});
```

- [ ] **Step 5: Delegierten Handler in `init()` erweitern**

Im bestehenden `wunsch-tbody` click-Handler (in `init()`) den Aktions-Block erweitern.

Von:
```js
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
```

Zu:
```js
    if (action === 'loeschen') {
      wuensche = wuensche.filter(w => w.id !== id);
    } else if (action === 'plus') {
      wuensche = wuensche.map(w => w.id === id ? { ...w, menge: w.menge + 1 } : w);
    } else if (action === 'minus') {
      wuensche = wuensche.map(w => {
        if (w.id !== id) return w;
        return w.menge > 1 ? { ...w, menge: w.menge - 1 } : null;
      }).filter(Boolean);
    } else if (action === 'og-toggle') {
      wuensche = wuensche.map(w => w.id === id ? { ...w, ogKostenlos: !w.ogKostenlos } : w);
    } else if (action === 'bearbeiten') {
      oeffneBearbeitenModal(id);
      return; // kein renderWunschliste() — Modal übernimmt nach Speichern
    }
    renderWunschliste();
```

- [ ] **Step 6: Manuell testen**

Testschritte:
1. Seite laden, einen Wunsch hinzufügen
2. **OG-Button** klicken → Badge "OG-kostenlos" erscheint, OG-Button wird amber/fett; nochmals klicken → Badge weg
3. **✎-Button** klicken → Modal öffnet sich mit vorausgefülltem Mitglied, Artikel, Menge, ogKostenlos-Checkbox
4. Artikel über Suche ändern, Menge ändern, ogKostenlos umschalten → Speichern → Tabelle aktualisiert
5. **Merge-Test:** Zwei Wünsche mit gleichem Mitglied+Artikel eingeben (z. B. Max, Artikel A, je 2) → nur 1 Zeile mit Menge 4. Dann ✎ → Menge auf 10 setzen → gespeichert korrekt.
6. **Abbrechen** + **Escape** schließen Modal ohne Änderung
7. Artikel im Modal-Feld leeren + Speichern → Alert "Bitte gültigen Artikel auswählen"

- [ ] **Step 7: Commit**

```bash
git add bestellung-sammeln.html
git commit -m "feat: Wunsch bearbeiten – Modal-Logik + ogKostenlos-Toggle pro Zeile"
```

---

## Self-Review

**Spec-Coverage:**
- "die Positionen der Sammlung bearbeiten können" → Task 2 (Edit-Modal, alle Felder editierbar) ✅
- "für jeden Artikel die Option OG übernimmt Kosten" → Task 1 (OG-Toggle-Button) + Task 2 (Checkbox im Modal) ✅

**Placeholder-Scan:** Keine "TBD"/"TODO", alle Schritte mit vollständigem Code. ✅

**Typ-Konsistenz:**
- `bearbeitenId` (Task 2) nur im Edit-Modal-Block verwendet ✅
- Element-IDs `*-edit` konsistent in allen Schritten ✅
- `OG_ID`, `esc`, `mergeWuensche` bereits importiert ✅
- `sortierteArtikel` in `aktualisiereArtikelListeEdit` → wird in `befuelleSelects()` befüllt, das vor dem Modal-Open aufgerufen wurde ✅