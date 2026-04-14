/**
 * parser.js
 * Wandelt Text einer DLRG-Materialstelle-Auftragsbestätigung
 * in ein strukturiertes Datenmodell um.
 *
 * Unterstützte Formate:
 *  - Tab-getrennt (eine Zeile pro Artikel, alle Spalten mit \t) — für Tests
 *  - Mehrzeilig (echtes DLRG-Kopierformat: Preise auf eigenen Zeilen)
 *
 * Öffentliche API:
 *   parseBestellung(text) → { artikel[], ogKosten[], fehler[] }
 */

const OG_KOSTEN_NUMMERN = ['VERSANDKOSTEN', 'EILAUFTRAG'];
const BV_SCHLUESSEL     = 'MITTELVERW. BV';
const LV_SCHLUESSEL     = 'MITTELVERW. LV';

/** Preis-String → positive Zahl. "-34,90 €" → 34.90 */
function parsePreis(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[€\s]/g, '').replace(',', '.').replace(/^-/, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

/* ── Tab-Format (eine Zeile pro Artikel) ──────────────────────── */

function parseTabFormat(text) {
  const artikel  = [];
  const ogKosten = [];
  const fehler   = [];

  const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean);
  const startIdx = zeilen.findIndex(z => !z.startsWith('Nr.'));
  let letzterArtikel = null;

  for (let i = startIdx; i < zeilen.length; i++) {
    const teile = zeilen[i].split('\t').map(s => s.trim());
    if (teile.length < 5) continue;

    const [, artikelNr, name, mengeRaw, einzelpreisRaw] = teile;
    const menge = parseInt(mengeRaw, 10);

    if (artikelNr === BV_SCHLUESSEL) {
      if (letzterArtikel && menge > 0) letzterArtikel.bvFoerderung = parsePreis(einzelpreisRaw);
      continue;
    }
    if (artikelNr === LV_SCHLUESSEL) {
      if (letzterArtikel && menge > 0) letzterArtikel.lvFoerderung = parsePreis(einzelpreisRaw);
      continue;
    }
    if (OG_KOSTEN_NUMMERN.includes(artikelNr)) {
      if (menge > 0) ogKosten.push({ artikelNr, name, menge, einzelpreis: parsePreis(einzelpreisRaw) });
      letzterArtikel = null;
      continue;
    }
    if (isNaN(menge) || menge === 0) { letzterArtikel = null; continue; }

    const neuerArtikel = { artikelNr, name, menge, einzelpreis: parsePreis(einzelpreisRaw), bvFoerderung: 0, lvFoerderung: 0 };
    artikel.push(neuerArtikel);
    letzterArtikel = neuerArtikel;
  }

  return { artikel, ogKosten, fehler };
}

/* ── Mehrzeiliges Format (echtes DLRG-Kopierformat) ──────────── */
/*
 * Jeder Artikel belegt mehrere Zeilen:
 *   1     12201521     Stoffabzeichen DSA Bronze     20
 *   2,20 €           ← Einzelpreis
 *   25,88 €          ← Netto (ignoriert)
 *   44,00 €          ← Summe  (ignoriert)
 * Danach folgen optional MITTELVERW. BV / LV nach dem gleichen Muster.
 */

const PREIS_ZEILE_RE = /^(-?\d+[,\.]\d+)\s*€\s*$/;

function istPreisZeile(zeile) {
  return PREIS_ZEILE_RE.test(zeile.trim());
}

function parseMultilineFormat(text) {
  const artikel  = [];
  const ogKosten = [];
  const fehler   = [];

  const zeilen = text.split('\n').map(z => z.trim());

  let aktuellerArtikel = null;
  let aktuelleOgKosten = null;
  let gruppe   = null;   // 'artikel' | 'bv' | 'lv' | 'og' | 'skip'
  let preisNr  = 0;      // wie viele Preis-Zeilen dieser Gruppe schon gesehen

  function commitArtikel() {
    if (aktuellerArtikel?.menge > 0) artikel.push({ ...aktuellerArtikel });
    aktuellerArtikel = null;
  }

  for (const zeile of zeilen) {
    if (!zeile) continue;

    // ── Preis-Zeile ──────────────────────────────────────────────
    if (istPreisZeile(zeile) && gruppe) {
      if (preisNr === 0) {
        const preis = parsePreis(zeile);
        if      (gruppe === 'artikel' && aktuellerArtikel) aktuellerArtikel.einzelpreis = preis;
        else if (gruppe === 'bv'      && aktuellerArtikel) aktuellerArtikel.bvFoerderung = preis;
        else if (gruppe === 'lv'      && aktuellerArtikel) aktuellerArtikel.lvFoerderung = preis;
        else if (gruppe === 'og'      && aktuelleOgKosten) aktuelleOgKosten.einzelpreis  = preis;
      }
      preisNr++;
      if (preisNr >= 3) {
        if (gruppe === 'og' && aktuelleOgKosten) {
          ogKosten.push({ ...aktuelleOgKosten });
          aktuelleOgKosten = null;
        }
        gruppe  = null;
        preisNr = 0;
      }
      continue;
    }

    // ── Header-Zeile: beginnt mit Zahl + Leerzeichen ─────────────
    if (!/^\d+\s/.test(zeile)) continue;

    const teile = zeile.split(/\t+|\s{3,}/).map(s => s.trim()).filter(Boolean);
    if (teile.length < 3) continue;

    const artikelNr = teile[1];
    const name      = teile[2] || '';
    const menge     = parseInt(teile[3] ?? '0', 10);

    if (artikelNr === BV_SCHLUESSEL) {
      gruppe  = (aktuellerArtikel && menge > 0) ? 'bv' : 'skip';
      preisNr = 0;
      continue;
    }
    if (artikelNr === LV_SCHLUESSEL) {
      gruppe  = (aktuellerArtikel && menge > 0) ? 'lv' : 'skip';
      preisNr = 0;
      continue;
    }
    if (OG_KOSTEN_NUMMERN.includes(artikelNr)) {
      commitArtikel();
      if (menge > 0) {
        aktuelleOgKosten = { artikelNr, name, menge, einzelpreis: 0 };
        gruppe = 'og';
      } else {
        gruppe = 'skip';
      }
      preisNr = 0;
      continue;
    }

    // Normaler Artikel
    commitArtikel();
    if (!isNaN(menge) && menge > 0) {
      aktuellerArtikel = { artikelNr, name, menge, einzelpreis: 0, bvFoerderung: 0, lvFoerderung: 0 };
      gruppe = 'artikel';
    } else {
      aktuellerArtikel = null;
      gruppe = 'skip';
    }
    preisNr = 0;
  }

  commitArtikel();
  return { artikel, ogKosten, fehler };
}

/* ── Öffentliche API ─────────────────────────────────────────── */

/**
 * Erkennt automatisch das Format und parst die Auftragsbestätigung.
 *
 * @param {string} text
 * @returns {{ artikel[], ogKosten[], fehler[] }}
 */
export function parseBestellung(text) {
  // Mehrzeiliges Format erkennen: gibt es Zeilen, die NUR einen Preis enthalten?
  if (/^\s*-?\d+[,\.]\d+\s*€\s*$/m.test(text)) return parseMultilineFormat(text);
  // Tab-Format: alle Spalten auf einer Zeile durch \t getrennt
  return parseTabFormat(text);
}
