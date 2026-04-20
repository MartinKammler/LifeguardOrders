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

/** Preis-String → positive Zahl.  "-44,90" → 44.90 */
function parsePreis(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[€\s]/g, '').replace(',', '.').replace(/^-/, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

/**
 * Extracts size variant from description.
 * Primary: trailing "(M)", "( XL )", "( 50 )" at end of string.
 * Fallback: last "(SIZE)" in string where SIZE is a known size pattern (e.g. "(M)- rot -").
 */
function extractVariante(name) {
  // Primary: size at end of string
  const endMatch = name.match(/\s*\(\s*([^)]+?)\s*\)\s*$/);
  if (endMatch) {
    return {
      cleanName: name.slice(0, endMatch.index).trim(),
      variante:  endMatch[1].trim().toUpperCase(),
    };
  }
  // Fallback: last paren group that looks like a size (1–5 chars: XS/S/M/L/XL/XXL/3XL or 2–3 digit numbers)
  const sizeRe = /\(\s*(\d{2,3}|[XSML]{1,2}|[2-6]XL|XS)\s*\)/gi;
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
  /^Martin\s/,
  /^Ermlandstr\./,
  /^\d{5}\s+\w/,
  /^Deutschland$/,
  /^[ABC]\s+\d+\s+\d/,    // USt-Tabellenzeile
  /^\d+,\d+\s+\d+,\d+$/,  // Summenzeile
];

function shouldSkip(line) {
  return SKIP_RE.some(re => re.test(line));
}

// ── Regex-Patterns ────────────────────────────────────────────────────────────

/** Artikel mit Preis: ArtNr desc… menge E-Preis Betrag A|B */
const ARTIKEL_PREIS_RE = /^(.+?)\s+(\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s+([AB])$/;
/** Artikel ohne Preis (Bundlekomponente): ArtNr desc… menge A|B */
const ARTIKEL_KEIN_PREIS_RE = /^(.+?)\s+(\d+)\s+([AB])$/;
/** Beginnt mit 6–10-stelliger Artikelnummer */
const ARTNR_PREFIX_RE = /^\d{6,10}\s/;
/** MITTELVERW.-Zeile */
const MITTELVERW_RE = /^MITTELVERW\. (BV|LV)\s+.+\s+(\d+)\s+STÜCK\s+(-\d+,\d+)\s+(-\d+,\d+)\s+C$/;
/** EILAUFTRAG-Zeile */
const EILAUFTRAG_RE = /^EILAUFTRAG\s+.+?\s+(\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s+([AB])$/;

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

  function commitPending() {
    if (!pendingNr) return;
    const { cleanName, variante } = extractVariante(pendingDesc);
    const entry = {
      artikelNr:    pendingNr,
      name:         cleanName,
      variante,
      menge:        pendingMenge,
      einzelpreis:  pendingHasPreis ? pendingPreis : 0,
      bvFoerderung: 0,
      lvFoerderung: 0,
    };
    artikel.push(entry);
    letzterArtikel = entry;
    pendingNr       = null;
    pendingDesc     = '';
    pendingMenge    = 0;
    pendingPreis    = 0;
    pendingHasPreis = false;
  }

  const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean);

  for (const zeile of zeilen) {
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
        continue;
      }
      // Ohne Preis (Bundlekomponente)
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
        continue;
      }
    }

    // ── Fortsetzungszeile (Beschreibung mehrzeilig) ───────────────
    if (pendingNr && zeile !== 'Stück') {
      pendingDesc = (pendingDesc + ' ' + zeile).trim();
    }
  }

  commitPending();

  return { artikel, ogKosten, fehler, warnings: [], errors: [] };
}
