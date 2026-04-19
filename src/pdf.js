/**
 * pdf.js
 * Rechnungsdaten und PDF-Erzeugung auf Basis eines lokalen PDF-Templates.
 */

import { PDFDocument, StandardFonts, rgb } from '../lib/pdf-lib.esm.min.js';

import { OG_ID, EXTERN_ID } from './konstanten.js';
import {
  berechneFoerderung,
  naechsteRechnungsnummer,
  rechnungsnummerMitLaufnummer,
} from './berechnung.js';

const TEMPLATE_URL = new URL('../Rechnung _Template.pdf', import.meta.url);
const MM_TO_PT = 72 / 25.4;
const PAGE_WIDTH_PT = 595.32;
const PAGE_HEIGHT_PT = 841.92;

let templateBytesPromise = null;

function runde(v) {
  return Math.round((v || 0) * 100) / 100;
}

function eur(v) {
  return Number(v || 0).toFixed(2).replace('.', ',') + ' €';
}

function mm(value) {
  return value * MM_TO_PT;
}

function truncateText(text, font, size, maxWidth, suffix = '…') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;

  const suffixWidth = font.widthOfTextAtSize(suffix, size);
  let result = normalized;
  while (result.length > 1 && font.widthOfTextAtSize(result, size) + suffixWidth > maxWidth) {
    result = result.slice(0, -1).trimEnd();
  }
  return result ? `${result}${suffix}` : suffix;
}

function formatDeDatum(isoDatum) {
  return new Date(isoDatum).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function sanitisiereDateiname(text) {
  return String(text || 'rechnung')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_');
}

function wrapText(text, font, size, maxWidth) {
  const quelltext = String(text || '').trim();
  if (!quelltext) return [''];

  const zeilen = [];
  const abschnitte = quelltext.split(/\r?\n/);
  for (const abschnitt of abschnitte) {
    const woerter = abschnitt.split(/\s+/).filter(Boolean);
    if (!woerter.length) {
      zeilen.push('');
      continue;
    }

    let zeile = woerter[0];
    for (const wort of woerter.slice(1)) {
      const kandidat = `${zeile} ${wort}`;
      if (font.widthOfTextAtSize(kandidat, size) <= maxWidth) {
        zeile = kandidat;
      } else {
        zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }

  return zeilen;
}

function drawTextTopPt(page, text, x, yTop, opts = {}) {
  const {
    font,
    size = 10,
    color = rgb(0, 0, 0),
    align = 'left',
    maxWidth = null,
    lineHeight = size * 1.2,
    maxLines = Infinity,
  } = opts;

  const width = maxWidth == null ? null : maxWidth;
  const basisZeilen = width == null ? String(text || '').split(/\r?\n/) : wrapText(text, font, size, width);
  const zeilen = basisZeilen.slice(0, maxLines);
  zeilen.forEach((zeile, index) => {
    const textWidth = font.widthOfTextAtSize(zeile, size);
    const drawX = align === 'right'
      ? x - textWidth
      : align === 'center'
        ? x - textWidth / 2
        : x;
    page.drawText(zeile, {
      x: drawX,
      y: PAGE_HEIGHT_PT - yTop - index * lineHeight,
      size,
      font,
      color,
    });
  });
}

function drawLineTopPt(page, x1, yTop, x2, opts = {}) {
  page.drawLine({
    start: { x: x1, y: PAGE_HEIGHT_PT - yTop },
    end: { x: x2, y: PAGE_HEIGHT_PT - yTop },
    thickness: opts.thickness || 0.6,
    color: opts.color || rgb(0.78, 0.78, 0.78),
  });
}

async function ladeTemplateBytes() {
  if (!templateBytesPromise) {
    templateBytesPromise = fetch(TEMPLATE_URL).then(async response => {
      if (!response.ok) {
        throw new Error(`Rechnungstemplate konnte nicht geladen werden (${response.status}).`);
      }
      return response.arrayBuffer();
    });
  }
  return templateBytesPromise;
}

async function erzeugePdfBytes(rechnung, mitgliedName, einstellungen) {
  const templateBytes = await ladeTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page1 = pdfDoc.getPages()[0];
  const og = einstellungen?.og || {};

  const grey = rgb(0.35, 0.35, 0.35);
  const lightGrey = rgb(0.72, 0.72, 0.72);

  const X_LEFT = mm(25);
  const X_RIGHT = PAGE_WIDTH_PT - mm(20);
  const FOOTER_PAGE_Y = mm(289);
  const DATE_BOX_X = mm(150);
  const DATE_BOX_RIGHT = PAGE_WIDTH_PT - mm(20);
  const DATE_TEXT_Y = mm(93.5);
  const X_RECIPIENT_MAX = mm(100);
  const X_ORDER_MAX = X_RIGHT;
  const TABLE_SHIFT_X = mm(5);
  const C_NR = 56.69 + TABLE_SHIFT_X;
  const C_NAME = 79.37 + TABLE_SHIFT_X;
  const C_GR = 385.51 + TABLE_SHIFT_X;
  const C_MNG = 433.70 + TABLE_SHIFT_X;
  const C_EA = 538.58 + TABLE_SHIFT_X - mm(5);
  const DESC_MAX_W = 295;
  const PAGE1_HEADER_Y = 266 + mm(15);
  const PAGE1_ROW0_Y = 285 + mm(15);
  const PAGE1_BOTTOM = mm(272);
  const FOLLOW_HEADER_Y = mm(30);
  const FOLLOW_ROW0_Y = mm(37);
  const FOLLOW_BOTTOM = PAGE_HEIGHT_PT - mm(25);
  const ROW_STEP = 17;
  const SUMMARY_GAP = 18;
  const SUMMARY_LINE_GAP = mm(4);
  const PAYMENT_GAP = mm(20);
  const PAYMENT_GAP_COMPACT = mm(10);
  const GREETING_GAP = mm(20);
  const GREETING_GAP_COMPACT = mm(10);
  const PAYMENT_BLOCK_HEIGHT = 58;
  const GREETING_BLOCK_HEIGHT = 42;
  const SUMMARY_BLOCK_HEIGHT = rechnung.ogAnteil > 0 ? 42 : 14;
  const SUBTOTAL_BLOCK_HEIGHT = 14;
  const FOLLOW_CARRY_Y = FOLLOW_ROW0_Y + 4;
  const FOLLOW_ROW0_WITH_CARRY_Y = FOLLOW_ROW0_Y + 20;

  page1.drawRectangle({
    x: mm(20),
    y: PAGE_HEIGHT_PT - mm(275),
    width: mm(90),
    height: mm(40),
    color: rgb(1, 1, 1),
  });

  function zeichneTabellenkopf(page, headerY) {
    drawTextTopPt(page, 'Pos.', C_NR, headerY, { font: helveticaBold, size: 8, color: lightGrey });
    drawTextTopPt(page, 'Bezeichnung', C_NAME, headerY, { font: helveticaBold, size: 8, color: lightGrey });
    drawTextTopPt(page, 'Gr.', C_GR, headerY, { font: helveticaBold, size: 8, color: lightGrey });
    drawTextTopPt(page, 'Menge', C_MNG, headerY, { font: helveticaBold, size: 8, color: lightGrey });
    drawTextTopPt(page, 'Eigenanteil', C_EA, headerY, { font: helveticaBold, size: 8, color: lightGrey, align: 'right' });
    drawLineTopPt(page, C_NR, headerY + 6, C_EA, { color: rgb(0.7, 0.7, 0.7), thickness: 0.5 });
  }

  function zeichnePositionszeilen(page, positionen, startIndex, row0Y, bottomLimit) {
    let index = startIndex;
    let y = row0Y;

    while (index < positionen.length) {
      if (y + ROW_STEP > bottomLimit) break;
      const position = positionen[index];
      const beschreibung = truncateText(position.name, helvetica, 9, DESC_MAX_W);

      drawTextTopPt(page, `${index + 1}.`, C_NR, y, { font: helvetica, size: 9 });
      drawTextTopPt(page, beschreibung, C_NAME, y, { font: helvetica, size: 9 });
      drawTextTopPt(page, truncateText(position.variante || '–', helvetica, 9, 34), C_GR, y, { font: helvetica, size: 9 });
      drawTextTopPt(page, String(position.menge), C_MNG, y, { font: helvetica, size: 9 });
      drawTextTopPt(page, eur(position.eigenanteil), C_EA, y, { font: helvetica, size: 9, align: 'right' });

      index += 1;
      y += ROW_STEP;
    }

    return { nextIndex: index, nextY: y };
  }

  function maxZeilen(row0Y, bottomLimit, reserveHeight = 0) {
    return Math.max(0, Math.floor((bottomLimit - reserveHeight - row0Y) / ROW_STEP));
  }

  function calcFooterUnderSummary(summaryBottomY, compact = false) {
    const paymentGap = compact ? PAYMENT_GAP_COMPACT : PAYMENT_GAP;
    const greetingGap = compact ? GREETING_GAP_COMPACT : GREETING_GAP;
    const paymentY = summaryBottomY + paymentGap;
    const grussY = paymentY + PAYMENT_BLOCK_HEIGHT + greetingGap;
    const bottomY = grussY + GREETING_BLOCK_HEIGHT;
    return { paymentY, grussY, bottomY, compact };
  }

  function calcFooterOnOwnPage(compact = false) {
    const paymentGap = compact ? PAYMENT_GAP_COMPACT : PAYMENT_GAP;
    const paymentY = FOLLOW_HEADER_Y;
    const grussY = paymentY + PAYMENT_BLOCK_HEIGHT + paymentGap;
    const bottomY = grussY + GREETING_BLOCK_HEIGHT;
    return { paymentY, grussY, bottomY, compact };
  }

  function drawSummenZeile(page, startY, label, amount) {
    const summaryY = startY + SUMMARY_GAP;
    drawLineTopPt(page, C_NR, summaryY - SUMMARY_LINE_GAP, C_EA, { color: rgb(0.7, 0.7, 0.7), thickness: 0.5 });
    drawTextTopPt(page, label, C_NAME, summaryY, { font: helveticaBold, size: 10 });
    drawTextTopPt(page, eur(amount), C_EA, summaryY, { font: helveticaBold, size: 10, align: 'right' });
    return { summaryY, bottomY: summaryY + 12 };
  }

  function drawZwischensumme(page, startY, amount) {
    return drawSummenZeile(page, startY, 'Zwischensumme', amount);
  }

  function drawUebertrag(page, amount) {
    drawTextTopPt(page, 'Übertrag', C_NAME, FOLLOW_CARRY_Y, { font: helveticaBold, size: 9 });
    drawTextTopPt(page, eur(amount), C_EA, FOLLOW_CARRY_Y, { font: helveticaBold, size: 9, align: 'right' });
    return FOLLOW_ROW0_WITH_CARRY_Y;
  }

  function drawSummary(page, startY) {
    const { summaryY } = drawSummenZeile(page, startY, 'Eigenanteil gesamt', rechnung.gesamtbetrag);
    let bottomY = summaryY + 12;
    if (rechnung.ogAnteil > 0) {
      const infoY = summaryY + 18;
      drawTextTopPt(
        page,
        `OG-Förderanteil: ${eur(rechnung.ogAnteil)} → ${rechnung.erwartetEinsatzstunden} Einsatzstunden erwartet`,
        X_LEFT,
        infoY,
        { font: helvetica, size: 8.5, color: grey, maxWidth: X_RIGHT - X_LEFT }
      );
      const fristJahr = new Date(rechnung.datum).getFullYear() + 1;
      drawTextTopPt(page, `Abarbeitungsfrist: bis 31. Dezember ${fristJahr}`, X_LEFT, infoY + 14, {
        font: helvetica,
        size: 8.5,
        color: grey,
      });
      bottomY = infoY + 24;
    }

    return { summaryY, bottomY };
  }

  function drawFooter(page, layout) {
    const paymentY = layout.paymentY;
    const paymentX = mm(25);
    const faellig = new Date(rechnung.datum);
    faellig.setDate(faellig.getDate() + 30);

    drawTextTopPt(page, `Bitte überweisen Sie ${eur(rechnung.gesamtbetrag)} bis zum ${formatDeDatum(faellig.toISOString().slice(0, 10))} auf:`, paymentX, paymentY, {
      font: helveticaBold,
      size: 8.5,
      maxWidth: X_RIGHT - paymentX,
    });
    if (og.iban) {
      drawTextTopPt(page, `IBAN: ${og.iban}`, paymentX, paymentY + 16, { font: helvetica, size: 8.5, color: grey });
    }
    if (og.bic) {
      drawTextTopPt(page, `BIC: ${og.bic}`, paymentX, paymentY + 30, { font: helvetica, size: 8.5, color: grey });
    }
    if (og.bank) {
      drawTextTopPt(page, `Bank: ${og.bank}`, paymentX, paymentY + 44, { font: helvetica, size: 8.5, color: grey });
    }
    drawTextTopPt(page, truncateText(`Verwendungszweck: ${rechnung.nummer} ${mitgliedName}`, helveticaBold, 8.5, X_RIGHT - paymentX), paymentX, paymentY + 58, {
      font: helveticaBold,
      size: 8.5,
    });

    const grussY = layout.grussY;
    drawTextTopPt(page, 'Mit freundlichen Grüßen', paymentX, grussY, {
      font: helvetica,
      size: 11,
      color: grey,
    });
    drawTextTopPt(page, og.finanzen || 'Finanzen', paymentX, grussY + 18, {
      font: helvetica,
      size: 11,
      color: grey,
    });
  }

  drawTextTopPt(page1, 'RECHNUNG', mm(25), mm(20), { font: helveticaBold, size: 20 });
  drawTextTopPt(page1, rechnung.nummer, mm(25), mm(30), { font: helvetica, size: 11, color: grey });
  drawTextTopPt(page1, formatDeDatum(rechnung.datum), DATE_BOX_RIGHT, DATE_TEXT_Y, {
    font: helvetica,
    size: 11,
    color: grey,
    align: 'right',
    maxWidth: DATE_BOX_RIGHT - DATE_BOX_X,
  });

  drawTextTopPt(page1, 'An:', mm(25), mm(55), { font: helvetica, size: 8.5, color: lightGrey });
  drawTextTopPt(page1, truncateText(mitgliedName, helvetica, 10.5, X_RECIPIENT_MAX - X_LEFT), mm(25), mm(61), {
    font: helvetica,
    size: 10.5,
  });
  drawTextTopPt(page1, truncateText(`Bestellung: ${rechnung.bestellungBezeichnung}`, helvetica, 11, X_ORDER_MAX - mm(25)), mm(25), DATE_TEXT_Y, {
    font: helvetica,
    size: 11,
    color: grey,
  });

  drawLineTopPt(page1, C_NR, PAGE1_HEADER_Y - 17, C_EA);
  zeichneTabellenkopf(page1, PAGE1_HEADER_Y);

  const reserveSummary = SUMMARY_GAP + SUMMARY_BLOCK_HEIGHT;
  const reserveSubtotal = SUMMARY_GAP + SUBTOTAL_BLOCK_HEIGHT;
  const planCache = new Map();

  function capacityForPage({ istErsteSeite, hatUebertrag, istLetzteSeite }) {
    const row0Y = istErsteSeite
      ? PAGE1_ROW0_Y
      : hatUebertrag
        ? FOLLOW_ROW0_WITH_CARRY_Y
        : FOLLOW_ROW0_Y;
    const bottomLimit = istErsteSeite ? PAGE1_BOTTOM : FOLLOW_BOTTOM;
    const reserve = istLetzteSeite ? reserveSummary : reserveSubtotal;
    return maxZeilen(row0Y, bottomLimit, reserve);
  }

  function verteileZeilenAufSeiten(rest, istErsteSeite = true, hatUebertrag = false) {
    const key = `${rest}:${istErsteSeite}:${hatUebertrag}`;
    if (planCache.has(key)) return planCache.get(key);

    const lastCapacity = capacityForPage({ istErsteSeite, hatUebertrag, istLetzteSeite: true });
    const splitCapacity = capacityForPage({ istErsteSeite, hatUebertrag, istLetzteSeite: false });

    if (rest <= lastCapacity) {
      const result = [{ istErsteSeite, hatUebertrag, anzahl: rest, istLetzteSeite: true }];
      planCache.set(key, result);
      return result;
    }

    let result = null;
    const maxCount = Math.min(splitCapacity, rest - 2);
    for (let anzahl = maxCount; anzahl >= 1; anzahl -= 1) {
      const folgeplan = verteileZeilenAufSeiten(rest - anzahl, false, true);
      if (folgeplan) {
        result = [{ istErsteSeite, hatUebertrag, anzahl, istLetzteSeite: false }, ...folgeplan];
        break;
      }
    }

    planCache.set(key, result);
    return result;
  }

  const seitenplan = verteileZeilenAufSeiten(rechnung.positionen.length, true, false);
  if (!seitenplan) {
    throw new Error('Rechnungspositionen konnten nicht auf PDF-Seiten verteilt werden.');
  }

  let currentPage = page1;
  let nextIndex = 0;
  let nextY = PAGE1_ROW0_Y;
  let letzteTabellenSeite = page1;
  let letzteTabellenSeiteBottom = PAGE1_BOTTOM;
  let laufendeSumme = 0;

  for (let i = 0; i < seitenplan.length; i += 1) {
    const seite = seitenplan[i];
    const uebertragVorSeite = laufendeSumme;
    const row0Y = seite.istErsteSeite
      ? PAGE1_ROW0_Y
      : seite.hatUebertrag
        ? FOLLOW_ROW0_WITH_CARRY_Y
        : FOLLOW_ROW0_Y;
    const bottomLimit = seite.istErsteSeite ? PAGE1_BOTTOM : FOLLOW_BOTTOM;
    const reserve = seite.istLetzteSeite ? reserveSummary : reserveSubtotal;

    currentPage = i === 0 ? page1 : pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
    if (!seite.istErsteSeite) {
      zeichneTabellenkopf(currentPage, FOLLOW_HEADER_Y);
      if (seite.hatUebertrag) {
        drawUebertrag(currentPage, uebertragVorSeite);
      }
    }

    const startIndex = nextIndex;
    ({ nextIndex, nextY } = zeichnePositionszeilen(
      currentPage,
      rechnung.positionen,
      startIndex,
      row0Y,
      bottomLimit - reserve
    ));

    laufendeSumme += rechnung.positionen
      .slice(startIndex, nextIndex)
      .reduce((summe, position) => summe + Number(position.eigenanteil || 0), 0);

    if (!seite.istLetzteSeite) {
      drawZwischensumme(currentPage, nextY, laufendeSumme);
    }

    letzteTabellenSeite = currentPage;
    letzteTabellenSeiteBottom = bottomLimit;
  }

  const summaryLayout = drawSummary(letzteTabellenSeite, nextY);
  const footerLayoutNormal = calcFooterUnderSummary(summaryLayout.bottomY, false);
  const footerLayoutCompact = calcFooterUnderSummary(summaryLayout.bottomY, true);

  if (footerLayoutNormal.bottomY <= letzteTabellenSeiteBottom) {
    drawFooter(letzteTabellenSeite, footerLayoutNormal);
  } else if (footerLayoutCompact.bottomY <= letzteTabellenSeiteBottom) {
    drawFooter(letzteTabellenSeite, footerLayoutCompact);
  } else {
    currentPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
    drawFooter(currentPage, calcFooterOnOwnPage(false));
  }

  const alleSeiten = pdfDoc.getPages();
  if (alleSeiten.length > 1) {
    for (let index = 1; index < alleSeiten.length; index += 1) {
      drawTextTopPt(alleSeiten[index], `Seite ${index + 1} von ${alleSeiten.length}`, X_RIGHT, FOOTER_PAGE_Y, {
        font: helvetica,
        size: 8.5,
        color: grey,
        align: 'right',
      });
    }
  }

  return pdfDoc.save();
}

function ladeDateiHerunter(bytes, dateiname) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ── Rechnungsdaten berechnen ───────────────────────────────── */

/**
 * Erstellt ein Rechnungs-Datenobjekt für ein Mitglied.
 *
 * @param {object}   bestellung
 * @param {string}   mitgliedId
 * @param {object}   einstellungen
 * @param {object[]} artikelListe
 * @param {object[]} alleRechnungen
 * @param {{ nummer?: string, laufnummer?: number|string, datum?: string|Date }} [opts]
 * @returns {object|null}
 */
export function erstelleRechnungsDaten(bestellung, mitgliedId, einstellungen, artikelListe, alleRechnungen, opts = {}) {
  if (mitgliedId === OG_ID) return null;
  const meinePositionen = [];

  for (const pos of (bestellung.positionen || [])) {
    if (pos.typ === 'og-kosten') continue;
    const zuweisungen = (pos.zuweisung || []).filter(z => z.mitgliedId === mitgliedId && z.menge > 0);
    if (!zuweisungen.length) continue;

    for (const zuw of zuweisungen) {
      const katalogArtikel = (artikelListe || []).find(
        a => a.artikelNr === pos.artikelNr && (a.variante || '') === (pos.variante || '')
      );

      let eigenanteil;
      let ogAnteilPos;
      if (katalogArtikel) {
        const f = berechneFoerderung(katalogArtikel, zuw.menge, { ogKostenlos: zuw.ogKostenlos || false });
        eigenanteil = f.mitglied;
        ogAnteilPos = f.og;
      } else {
        const ep = pos.einzelpreis || 0;
        const bv = runde((pos.bvFoerderung || 0) * zuw.menge);
        const lv = runde((pos.lvFoerderung || 0) * zuw.menge);
        const og = runde((pos.ogFoerderung || 0) * zuw.menge);
        eigenanteil = Math.max(0, runde(ep * zuw.menge - bv - lv - og));
        ogAnteilPos = og;
      }

      meinePositionen.push({
        name: pos.name,
        variante: pos.variante || '',
        artikelNr: pos.artikelNr,
        menge: zuw.menge,
        einzelpreis: pos.einzelpreis || 0,
        eigenanteil,
        ogAnteil: ogAnteilPos,
      });
    }
  }

  if (!meinePositionen.length) return null;

  const gesamtbetrag = runde(meinePositionen.reduce((summe, position) => summe + position.eigenanteil, 0));
  const ogAnteil = runde(meinePositionen.reduce((summe, position) => summe + position.ogAnteil, 0));

  const sr = einstellungen?.stundenRate || { stunden: 3, euro: 10 };
  const erwartetEinsatzstunden = (ogAnteil > 0 && mitgliedId !== EXTERN_ID)
    ? Math.ceil(ogAnteil / sr.euro * sr.stunden)
    : 0;

  const datum = opts.datum instanceof Date
    ? opts.datum
    : opts.datum
      ? new Date(opts.datum)
      : new Date();

  const nummer = opts.nummer
    || (opts.laufnummer != null
      ? rechnungsnummerMitLaufnummer(datum, opts.laufnummer)
      : naechsteRechnungsnummer(alleRechnungen, datum));

  return {
    id: crypto.randomUUID(),
    nummer,
    datum: datum.toISOString().slice(0, 10),
    mitgliedId,
    positionen: meinePositionen,
    gesamtbetrag,
    ogAnteil,
    erwartetEinsatzstunden,
    bezahlt: false,
    bezahltDatum: null,
    bestellungId: bestellung.id,
    bestellungBezeichnung: bestellung.bezeichnung,
  };
}

/* ── PDF erzeugen ───────────────────────────────────────────── */

/**
 * Erzeugt eine PDF-Rechnung auf Basis des Templates und löst den Download aus.
 *
 * @param {object} rechnung
 * @param {string} mitgliedName
 * @param {object} einstellungen
 * @returns {Promise<void>}
 */
export async function druckePDF(rechnung, mitgliedName, einstellungen) {
  const pdfBytes = await erzeugePdfBytes(rechnung, mitgliedName, einstellungen);
  const dateiname = `${rechnung.nummer}_${sanitisiereDateiname(mitgliedName)}.pdf`;
  ladeDateiHerunter(pdfBytes, dateiname);
}
