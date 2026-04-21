/**
 * parse-verkaufsrechnung.js
 * Parst den Text einer DLRG-Materialstelle-Verkaufsrechnung (PDF-Extrakt).
 *
 * Öffentliche API:
 *   parseVerkaufsrechnung(text) → { artikel[], ogKosten[], fehler[] }
 *
 * Erwartetes Zeilenformat (aus PDF-Textextraktion):
 *   {6–10-stellige ArtNr} {Beschreibung} {Menge} {E-Preis} {Betrag} {Steuer A|B}  ← mit Preis
 *   {6–10-stellige ArtNr} {Beschreibung} {Menge} {Steuer A|B}                     ← Bundlekomponente
 *   MITTELVERW. BV  Mittelverwendung Bundesverband  {Menge} STÜCK {-Preis} {-Betrag} C
 *   MITTELVERW. LV  Mittelverwendung Landesverbände {Menge} STÜCK {-Preis} {-Betrag} C
 *   EILAUFTRAG Kosten für Eilauftrag {Menge} {Preis} {Betrag} {Steuer}
 */

/** Preis-String → positive Zahl.  "-44,90" → 44.90,  "1.049,90" → 1049.90 */
function parsePreis(raw) {
  if (!raw) return 0;
  // Tausenderpunkt entfernen, dann Komma als Dezimaltrennzeichen umwandeln
  const cleaned = String(raw).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.').replace(/^-/, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

/**
 * Extracts size variant from description.
 * 1. Trailing "(M)", "( XL )", "( 50 )" at end of string.
 * 2. Last "(SIZE)" anywhere in string (e.g. "(M)- rot -").
 * 3. Bare size token at end of string without parens (PDF-Extrakt-Artefakt).
 */
function extractVariante(name) {
  // 1. Size in parens at end
  const endMatch = name.match(/\s*\(\s*([^)]+?)\s*\)\s*$/);
  if (endMatch) {
    return {
      cleanName: name.slice(0, endMatch.index).trim(),
      variante:  endMatch[1].trim().toUpperCase(),
    };
  }
  // 2. Last paren group that looks like a size anywhere in string
  const sizeRe = /\(\s*(\d{2,3}(?:\/\d{2,3})?|[XSML]{1,2}|[2-6]XL|XXL|XS)\s*\)/gi;
  let lastMatch = null;
  let m;
  while ((m = sizeRe.exec(name)) !== null) lastMatch = m;
  if (lastMatch) {
    const before = name.slice(0, lastMatch.index).trim();
    const after  = name.slice(lastMatch.index + lastMatch[0].length).trim().replace(/^[-\s]+/, '');
    return {
      cleanName: (before + (after ? ' ' + after : '')).trim(),
      variante:  lastMatch[1].trim().toUpperCase(),
    };
  }
  // 3. Bare size token at end (kein Klammern, z. B. "T-Shirt rot JAKO M")
  //    Nicht anwenden wenn das vorherige Token eine Mengenangabe wie VPE ist.
  const bareMatch = name.match(/\s+(XS|XXL|XXXL|[2-9]XL|XL|[SML]|\d{2,3}(?:\/\d{2,3})?)$/);
  if (bareMatch) {
    const before = name.slice(0, bareMatch.index);
    if (/\bVPE$/i.test(before)) {
      return { cleanName: name.trim(), variante: '' };
    }
    return {
      cleanName: before.trim(),
      variante:  bareMatch[1].toUpperCase(),
    };
  }
  return { cleanName: name.trim(), variante: '' };
}

// ── Skip-Patterns: Kopf-/Fußzeilen, Bankdaten, Summenspalten ─────────────────
const SKIP_RE = [
  /^E-Preis$/,
  /^Art\.-Nr\./,
  /^DLRG e\.V\./,
  /Materialstelle \|/,
  /^Tel\.:/,
  /^E-Mail:/,
  /^Kundennummer/,
  /^Rechnungsnummer:/,
  /^Auftragsnummer/,
  /^Rechnungsdatum/,
  /^Fälligkeitsdatum/,
  /^Ihre Referenz/,
  /^Zweitschrift$/,
  /^Summe Netto/,
  /^USt\.-Betrag/,
  /^Summe Brutto/,
  /^Zahlungs/,
  /^Lieferbedingung/,
  /^USt\.-?%/,
  /^USt-IdNr\./,
  /^Volksbank/,
  /^IBAN:/,
  /^BIC:/,
  /^Präsidentin:/,
  /^Vizepräsident/,
  /^Dr\. [A-Z]\. /,       // Vizepräsident-Namensfortsetzung auf Folgezeile
  /^Federation/,           // "Federation (ILS) und der ILS-Europe."
  /^Seite \d+ \/ \d+$/,
  /^Lief\. an/,
  /^DLRG Ortsgruppe/,
  /^\d{5}\s+\w/,
  /^Deutschland$/,
  /^[ABC]\s+\d+\s+\d/,              // USt-Tabellenzeile
  /^[\d.]+,\d+\s+[\d.]+,\d+$/,     // Summenzeile (auch mit Tausenderpunkt)
];

function shouldSkip(line) {
  return SKIP_RE.some(re => re.test(line));
}

// ── Regex-Patterns ────────────────────────────────────────────────────────────

/** Preistoken: deutsches Format mit optionalen Tausendergruppen (1.234,56 oder 44,90) */
const PREIS_TOKEN = '\\d{1,3}(?:\\.\\d{3})*,\\d+';

/** Artikel mit Preis: ArtNr desc… menge E-Preis Betrag A|B */
const ARTIKEL_PREIS_RE    = new RegExp(`^(.+?)\\s+(\\d+)\\s+(${PREIS_TOKEN})\\s+(${PREIS_TOKEN})\\s+([AB])$`);
/** Artikel ohne Preis (Bundlekomponente): ArtNr desc… menge A|B */
const ARTIKEL_KEIN_PREIS_RE = /^(.+?)\s+(\d+)\s+([AB])$/;
/** Beginnt mit 6–10-stelliger Artikelnummer */
const ARTNR_PREFIX_RE = /^\d{6,10}\s/;
/** MITTELVERW.-Zeile */
const MITTELVERW_RE   = new RegExp(`^MITTELVERW\\. (BV|LV)\\s+.+\\s+(\\d+)\\s+STÜCK\\s+(-${PREIS_TOKEN})\\s+(-${PREIS_TOKEN})\\s+C$`);
/** EILAUFTRAG-Zeile */
const EILAUFTRAG_RE   = new RegExp(`^EILAUFTRAG\\s+.+?\\s+(\\d+)\\s+(${PREIS_TOKEN})\\s+(${PREIS_TOKEN})\\s+([AB])$`);
/** Preis-Abschlusszeile nach gesplitteter Artikelzeile: menge E-Preis Betrag A|B */
const PREIS_ABSCHLUSS_RE = new RegExp(`^(\\d+)\\s+(${PREIS_TOKEN})\\s+(${PREIS_TOKEN})\\s+([AB])$`);
/** Kein-Preis-Abschluss nach gesplitteter Bundlezeile: menge A|B */
const KEIN_PREIS_ABSCHLUSS_RE = /^(\d+)\s+([AB])$/;

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseVerkaufsrechnung(text) {
  if (!text || !text.trim()) {
    return { artikel: [], ogKosten: [], fehler: ['Kein Text übergeben'], warnings: [], errors: [] };
  }

  const artikel  = [];
  const ogKosten = [];
  const fehler   = [];

  let letzterArtikel = null;

  // Zwischenspeicher für gerade gelesenen Artikel (kann Fortsetzungszeilen haben)
  let pendingNr       = null;
  let pendingDesc     = '';
  let pendingMenge    = 0;
  let pendingPreis    = 0;
  let pendingHasPreis = false;
  let pendingSeite    = 1;
  let pendingZeile    = 0;

  let aktuelleSeite   = 1;
  let aktuelleZeile   = 0;

  function commitPending() {
    if (!pendingNr) return;
    if (pendingHasPreis) {
      const { cleanName, variante } = extractVariante(pendingDesc);
      const entry = {
        artikelNr:    pendingNr,
        name:         cleanName,
        variante,
        menge:        pendingMenge,
        einzelpreis:  pendingPreis,
        bvFoerderung: 0,
        lvFoerderung: 0,
        _seite:       pendingSeite,
        _zeile:       pendingZeile,
      };
      artikel.push(entry);
      letzterArtikel = entry;
    }
    pendingNr       = null;
    pendingDesc     = '';
    pendingMenge    = 0;
    pendingPreis    = 0;
    pendingHasPreis = false;
  }

  const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean);

  for (const zeile of zeilen) {
    // ── Seiten-Marker ([S2], [S3] …) ─────────────────────────────
    const seitenMatch = zeile.match(/^\[S(\d+)\]$/);
    if (seitenMatch) { aktuelleSeite = parseInt(seitenMatch[1]); aktuelleZeile = 0; continue; }

    aktuelleZeile++;
    if (shouldSkip(zeile)) continue;

    // ── MITTELVERW. BV / LV ──────────────────────────────────────
    const mvMatch = zeile.match(MITTELVERW_RE);
    if (mvMatch) {
      commitPending();
      const typ   = mvMatch[1];
      const preis = parsePreis(mvMatch[3]);
      if (letzterArtikel) {
        if (typ === 'BV') letzterArtikel.bvFoerderung = preis;
        else              letzterArtikel.lvFoerderung = preis;
      }
      continue;
    }

    // ── EILAUFTRAG ───────────────────────────────────────────────
    const eiMatch = zeile.match(EILAUFTRAG_RE);
    if (eiMatch) {
      commitPending();
      letzterArtikel = null;
      ogKosten.push({
        artikelNr:   'EILAUFTRAG',
        name:        'Kosten für Eilauftrag',
        menge:       parseInt(eiMatch[1], 10),
        einzelpreis: parsePreis(eiMatch[2]),
      });
      continue;
    }

    // ── Neue Artikelzeile (beginnt mit ArtNr) ────────────────────
    if (ARTNR_PREFIX_RE.test(zeile)) {
      // Mit Preis versuchen
      const wpMatch = zeile.match(ARTIKEL_PREIS_RE);
      if (wpMatch) {
        commitPending();
        const full   = wpMatch[1];
        const artNr  = (full.match(/^(\d{6,10})/) || [])[1] || '';
        pendingNr       = artNr;
        pendingDesc     = full.slice(artNr.length).trim();
        pendingMenge    = parseInt(wpMatch[2], 10);
        pendingPreis    = parsePreis(wpMatch[3]);
        pendingHasPreis = true;
        pendingSeite    = aktuelleSeite;
        pendingZeile    = aktuelleZeile;
        continue;
      }
      // Ohne Preis (Bundlekomponente, einzeilig)
      const npMatch = zeile.match(ARTIKEL_KEIN_PREIS_RE);
      if (npMatch) {
        commitPending();
        const full  = npMatch[1];
        const artNr = (full.match(/^(\d{6,10})/) || [])[1] || '';
        pendingNr       = artNr;
        pendingDesc     = full.slice(artNr.length).trim();
        pendingMenge    = parseInt(npMatch[2], 10);
        pendingPreis    = 0;
        pendingHasPreis = false;
        pendingSeite    = aktuelleSeite;
        pendingZeile    = aktuelleZeile;
        continue;
      }
      // Beschreibung über mehrere Zeilen gesplittet (Preis/Menge folgen später)
      commitPending();
      const artNr = (zeile.match(/^(\d{6,10})/) || [])[1] || '';
      pendingNr   = artNr;
      pendingDesc = zeile.slice(artNr.length).trim();
      pendingSeite = aktuelleSeite;
      pendingZeile = aktuelleZeile;
      continue;
    }

    // ── Preis-Abschlusszeile nach gesplitteter Artikelzeile ───────
    if (pendingNr) {
      const paMatch = zeile.match(PREIS_ABSCHLUSS_RE);
      if (paMatch) {
        pendingMenge    = parseInt(paMatch[1], 10);
        pendingPreis    = parsePreis(paMatch[2]);
        pendingHasPreis = true;
        continue;
      }
      const kpMatch = zeile.match(KEIN_PREIS_ABSCHLUSS_RE);
      if (kpMatch) {
        pendingMenge    = parseInt(kpMatch[1], 10);
        pendingHasPreis = false;
        continue;
      }
    }

    // ── Fortsetzungszeile (Beschreibung mehrzeilig) ───────────────
    if (pendingNr && zeile.toLowerCase() !== 'stück') {
      pendingDesc = (pendingDesc + ' ' + zeile).trim();
    }
  }

  commitPending();

  return { artikel, ogKosten, fehler, warnings: [], errors: [] };
}
