# Sprint 11: Verkaufsrechnung-Parser & Abgleich-Verbesserungen

## Sprint Goal

Der Abgleich-Workflow wird produktionsreif: Der DLRG-Verkaufsrechnung-Parser
versteht alle Rechnungsformate aus der Praxis, Variantenerkennung ist robust,
Zuweisungen bei Fuzzy-Matches sind korrekt, und der "wieder öffnen"-Flow
führt den User sauber zurück in den Bearbeitungs- und Abgleich-Workflow.

---

## Ausgangslage

Sprint 10 (Wunschqueue) war abgeschlossen. Beim ersten Praxiseinsatz mit echten
DLRG-Verkaufsrechnungen zeigten sich mehrere Parser- und Abgleich-Bugs sowie ein
UX-Problem beim "Bestellung wieder öffnen"-Flow aus der Anprobe-Ansicht.

---

## Änderungen

### `src/parse-verkaufsrechnung.js` (Parser-Verbesserungen)

**Bundle-Komponenten ignorieren**
Artikel ohne Preis (Bundlekomponenten wie Teilartikel eines Bekleidungspakets)
werden vollständig ignoriert — `commitPending()` ist konditioniert auf `pendingHasPreis`.
Nur Artikel mit Preis landen in `artikel[]`.

**Doppelte Positionen summieren**
Taucht dieselbe artikelNr + variante mehrfach auf der Rechnung auf,
wird die Menge summiert statt der Eintrag überschrieben.

**Gesplittetes Zeilenformat**
Manche T-Shirts werden dreizeilig gedruckt: Artikelzeile, Variante `(3XL)`,
Preiszeile. Neue Regex `PREIS_ABSCHLUSS_RE` und `KEIN_PREIS_ABSCHLUSS_RE`
schließen einen offenen `pendingNr`-Eintrag korrekt ab.

**Bare-Size-Variante**
Wenn die Variante ohne Klammern am Zeilenende steht (PDF-Artefakt, z. B.
`T-Shirt rot JAKO M`), wird sie als Variante extrahiert — außer wenn das
vorangehende Token `VPE` ist (z. B. `VPE 50`, dort ist `50` die Pack-Menge,
keine Variante).

**Seiten- und Zeilenverfolgung**
Seitenmarker `[S${p}]` werden vor jede Seite > 1 eingefügt.
Jeder Artikel bekommt `_seite` und `_zeile` für die Debug-Anzeige
(`S.X/Z.Y`) im Abgleich-UI.

**`extractVariante` – dreistufiger Fallback**
1. Klammer am Zeilenende: `(M)`, `( XL )`, `( 50 )`
2. Letzte Klammer mit Größen-Token irgendwo in der Zeile: `(M)- rot -`
3. Bare-Size-Token am Zeilenende (ohne Klammern), VPE-Guard

---

### `src/abgleich.js`

**Fuzzy-Match nutzt Wunsch-Variante für Zuweisung**
`baueArtikelPosition(position, wuensche, artikelListe, wunschVariante)`:
Für den Artikelkatalog-Lookup wird `position.variante` (Rechnungs-Variante)
genutzt, für `verteileGelieferteMenge` die `wunschVariante` (Bestellsystem-Variante).
Dadurch werden auch nach einem Fuzzy-Match (z. B. `21CM` vs. `''`) die richtigen
Mitglieder zugeordnet.

**Doppelte Rechnungspositionen summieren**
`posMap` summiert `menge` wenn artikelNr + variante bereits vorhanden, statt
den Eintrag zu überschreiben.

---

### `bestellung-abgleich.html`

**Seiten-/Zeilennummer im UI**
Jede Abgleich-Zeile zeigt `S.X/Z.Y` als kleine graue Anmerkung, wenn
die Position eine `_seite`-Referenz hat.

**"Bestellung wieder öffnen" → Sammeln statt Reload**
Nach erfolgreichem Wieder-Öffnen (Status: `bestellt`, `positionen: []`)
wird nicht mehr `location.reload()` ausgeführt, sondern zu
`bestellung-sammeln.html?id=...` navigiert. Der User landet direkt
in der Wunschliste und kann Wünsche anpassen oder sofort zum Abgleich weiter.

---

### `bestellung-sammeln.html`

**Button-Label für bereits bestellte Bestellungen**
Wenn eine Bestellung mit Status `'bestellt'` oder `'anprobe'` in der
Sammeln-Seite geöffnet wird (z. B. nach "wieder öffnen"), wechselt
der Button "Als bestellt markieren" zu **"Weiter zum Abgleich →"**.
Semantisch identische Aktion (speichert + navigiert zu `bestellung-abgleich.html`),
aber der Text macht den nächsten Schritt klar.

**Ungespeicherte Änderungen bewahren**
`beforeunload`-Guard verhindert unbeabsichtigtes Verlassen der Sammeln-Seite,
solange nicht gespeicherte Wünsche existieren (`hatAenderungen`-Flag).

---

## Acceptance Criteria

- [x] Bundle-Komponenten ohne Preis landen nicht in `artikel[]`
- [x] Doppelte Rechnungspositionen werden summiert
- [x] Dreizeiliges Variantenformat (Zeile / Variante / Preis) wird korrekt geparst
- [x] `VPE 50` erzeugt kein false-positive `variante: '50'`
- [x] Fuzzy-gematchte Artikel zeigen die richtigen Mitglieder in der Anprobe
- [x] "Bestellung wieder öffnen" aus Anprobe → User landet in Sammeln zur Bearbeitung
- [x] "Weiter zum Abgleich →" erscheint wenn Status bereits `bestellt`/`anprobe`
- [x] `beforeunload`-Guard schützt ungespeicherte Wünsche in Sammeln
- [x] 48/48 Regressions-Assertions grün

---

## Ergebnis

Abgeschlossen. 48/48 Tests grün.
