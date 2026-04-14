/**
 * parser.js
 * Wandelt Tab-getrennten Text einer DLRG-Materialstelle-Auftragsbestätigung
 * in ein strukturiertes Datenmodell um.
 *
 * Öffentliche API:
 *   parseBestellung(text) → { artikel[], ogKosten[], fehler[] }
 */

const OG_KOSTEN_NUMMERN = ['VERSANDKOSTEN', 'EILAUFTRAG'];
const BV_SCHLUESSEL     = 'MITTELVERW. BV';
const LV_SCHLUESSEL     = 'MITTELVERW. LV';

/**
 * Parst einen €-Preisstring wie "69,90 €", "-34,90 €", "0,00 €"
 * und gibt einen positiven Dezimalwert zurück.
 */
function parsePreis(raw) {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[€\s]/g, '')   // € und Whitespace entfernen
    .replace(',', '.')        // Komma → Punkt
    .replace(/^-/, '');       // Vorzeichen entfernen (Förderbeträge sind positiv gespeichert)
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

/**
 * Zerlegt eine Tabellenzeile in ihre Spalten.
 * Unterstützt Tab-Trennung sowie mehrfache Leerzeichen als Fallback.
 */
function splitZeile(zeile) {
  return zeile.split('\t').map(s => s.trim());
}

/**
 * Parst den Tab-getrennten Text einer Auftragsbestätigung.
 *
 * @param {string} text  Rohtextinhalt aus der Zwischenablage
 * @returns {{ artikel: Artikel[], ogKosten: OgKosten[], fehler: Fehler[] }}
 */
export function parseBestellung(text) {
  const artikel  = [];
  const ogKosten = [];
  const fehler   = [];

  const zeilen = text
    .split('\n')
    .map(z => z.trim())
    .filter(z => z.length > 0);

  // Kopfzeile überspringen (enthält "Nr." oder "Artikel Nr.")
  const startIdx = zeilen.findIndex(z => !z.startsWith('Nr.'));

  let letzterArtikel = null;  // Referenz auf den zuletzt hinzugefügten Artikel

  for (let i = startIdx; i < zeilen.length; i++) {
    const teile = splitZeile(zeilen[i]);

    // Mindestens: Nr, ArtikelNr, Bezeichnung, Menge, Einzelpreis
    if (teile.length < 5) continue;

    const [, artikelNr, name, mengeRaw, einzelpreisRaw] = teile;

    const menge = parseInt(mengeRaw, 10);

    // ── BV-Förderung ────────────────────────────────────────────
    if (artikelNr === BV_SCHLUESSEL) {
      if (letzterArtikel && menge > 0) {
        letzterArtikel.bvFoerderung = parsePreis(einzelpreisRaw);
      }
      continue;
    }

    // ── LV-Förderung ────────────────────────────────────────────
    if (artikelNr === LV_SCHLUESSEL) {
      if (letzterArtikel && menge > 0) {
        letzterArtikel.lvFoerderung = parsePreis(einzelpreisRaw);
      }
      continue;
    }

    // ── OG-Kosten (Versand, Eilauftrag) ─────────────────────────
    if (OG_KOSTEN_NUMMERN.includes(artikelNr)) {
      if (menge > 0) {
        ogKosten.push({
          artikelNr,
          name,
          menge,
          einzelpreis: parsePreis(einzelpreisRaw),
        });
      }
      letzterArtikel = null;
      continue;
    }

    // ── Kopfzeile oder unbekannte Nicht-Artikel-Zeile ───────────
    if (isNaN(menge)) continue;

    // ── Menge 0 → überspringen ──────────────────────────────────
    if (menge === 0) {
      letzterArtikel = null;  // damit MITTELVERW.-Zeilen danach ignoriert werden
      continue;
    }

    // ── Normaler Artikel ─────────────────────────────────────────
    const neuerArtikel = {
      artikelNr,
      name,
      menge,
      einzelpreis:  parsePreis(einzelpreisRaw),
      bvFoerderung: 0,
      lvFoerderung: 0,
    };

    artikel.push(neuerArtikel);
    letzterArtikel = neuerArtikel;
  }

  return { artikel, ogKosten, fehler };
}
