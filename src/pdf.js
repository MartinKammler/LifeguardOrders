/**
 * pdf.js
 * PDF-Erzeugung für Mitglieds-Rechnungen via jsPDF (window.jspdf.jsPDF).
 * jsPDF muss als <script> vor dem Modul geladen sein:
 *   <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
 */

import { OG_ID } from './konstanten.js';
import { berechneFoerderung, naechsteRechnungsnummer } from './berechnung.js';

/* ── Hilfsfunktionen ────────────────────────────────────────── */

function runde(v) { return Math.round((v || 0) * 100) / 100; }

function eur(v) {
  return Number(v || 0).toFixed(2).replace('.', ',') + ' €';
}

/* ── Rechnungsdaten berechnen ───────────────────────────────── */

/**
 * Erstellt ein Rechnungs-Datenobjekt für ein Mitglied.
 *
 * @param {object}   bestellung     Bestellungs-Objekt mit positionen[]
 * @param {string}   mitgliedId
 * @param {object}   einstellungen  Einstellungen (stundenRate, og-Daten)
 * @param {object[]} artikelListe   Aktueller Artikelkatalog (für OG-Förderung)
 * @param {object[]} alleRechnungen Alle bisher existierenden Rechnungen (für Nummerierung)
 * @returns {object|null}           Rechnung oder null wenn kein Anteil
 */
export function erstelleRechnungsDaten(bestellung, mitgliedId, einstellungen, artikelListe, alleRechnungen) {
  if (mitgliedId === OG_ID) return null;
  const meinePositionen = [];

  for (const pos of (bestellung.positionen || [])) {
    if (pos.typ === 'og-kosten') continue;
    const zuw = (pos.zuweisung || []).find(z => z.mitgliedId === mitgliedId);
    if (!zuw || zuw.menge === 0) continue;

    // Artikel aus Katalog für vollständige Förderberechnung (inkl. OG-Anteil)
    const katalogArtikel = (artikelListe || []).find(
      a => a.artikelNr === pos.artikelNr && (a.variante || '') === (pos.variante || '')
    );

    let eigenanteil, ogAnteilPos;
    if (katalogArtikel) {
      const f  = berechneFoerderung(katalogArtikel, zuw.menge, { ogKostenlos: zuw.ogKostenlos || false });
      eigenanteil = f.mitglied;
      ogAnteilPos = f.og;
    } else {
      // Fallback: OG-Anteil unbekannt (0), da nicht in Positionen gespeichert
      const ep = pos.einzelpreis || 0;
      const bv = runde((pos.bvFoerderung || 0) * zuw.menge);
      const lv = runde((pos.lvFoerderung || 0) * zuw.menge);
      const og = runde((pos.ogFoerderung || 0) * zuw.menge);
      eigenanteil = runde(ep * zuw.menge - bv - lv - og);
      ogAnteilPos = og;
    }

    meinePositionen.push({
      name:        pos.name,
      variante:    pos.variante || '',
      artikelNr:   pos.artikelNr,
      menge:       zuw.menge,
      einzelpreis: pos.einzelpreis || 0,
      eigenanteil,
      ogAnteil:    ogAnteilPos,
    });
  }

  if (!meinePositionen.length) return null;

  const gesamtbetrag = runde(meinePositionen.reduce((s, p) => s + p.eigenanteil, 0));
  const ogAnteil     = runde(meinePositionen.reduce((s, p) => s + p.ogAnteil,    0));

  const sr = einstellungen?.stundenRate || { stunden: 3, euro: 10 };
  const erwartetEinsatzstunden = ogAnteil > 0
    ? Math.ceil(ogAnteil / sr.euro * sr.stunden)
    : 0;

  const datum  = new Date();
  const nummer = naechsteRechnungsnummer(alleRechnungen, datum);

  return {
    id:                    crypto.randomUUID(),
    nummer,
    datum:                 datum.toISOString().slice(0, 10),
    mitgliedId,
    positionen:            meinePositionen,
    gesamtbetrag,
    ogAnteil,
    erwartetEinsatzstunden,
    bezahlt:               false,
    bezahltDatum:          null,
    bestellungId:          bestellung.id,
    bestellungBezeichnung: bestellung.bezeichnung,
  };
}

/* ── PDF erzeugen ───────────────────────────────────────────── */

/**
 * Erzeugt eine PDF-Rechnung und löst den Download aus.
 *
 * @param {object} rechnung       Rechnung-Objekt aus erstelleRechnungsDaten
 * @param {string} mitgliedName   Anzeigename des Mitglieds
 * @param {object} einstellungen  Einstellungen (og-Stammdaten, Bankdaten)
 */
export function druckePDF(rechnung, mitgliedName, einstellungen) {
  if (!window.jspdf?.jsPDF) {
    alert('jsPDF nicht geladen. Bitte Internetverbindung prüfen und Seite neu laden.');
    return;
  }
  const jsPDF = window.jspdf.jsPDF;
  const doc   = new jsPDF({ unit: 'mm', format: 'a4' });
  const og    = einstellungen?.og || {};

  const PL  = 20;   // linker Rand
  const PR  = 190;  // rechter Rand (x-Koordinate)
  const C_NR   = PL;
  const C_NAME = PL + 8;
  const C_GR   = PL + 116;
  const C_MNG  = PL + 133;
  const C_EA   = PR;
  let y = 18;

  function font(size, style = 'normal', r = 0, g = 0, b = 0) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(r, g, b);
  }

  // ── Absender (oben rechts) ──────────────────────────────────
  font(8.5, 'normal', 120, 120, 120);
  [
    og.name    || '',
    og.strasse || '',
    `${og.plz || ''} ${og.ort || ''}`.trim(),
    og.email   || '',
  ].filter(Boolean).forEach((z, i) => doc.text(z, PR, y + i * 5, { align: 'right' }));

  // ── Titel ────────────────────────────────────────────────────
  y = 46;
  font(20, 'bold');
  doc.text('RECHNUNG', PL, y);

  y += 8;
  font(11, 'normal', 60, 60, 60);
  doc.text(rechnung.nummer, PL, y);
  doc.text(rechnung.datum, PR, y, { align: 'right' });

  // ── Empfänger ────────────────────────────────────────────────
  y += 13;
  font(8.5, 'normal', 130, 130, 130);
  doc.text('An:', PL, y);
  y += 5;
  font(10.5, 'bold');
  doc.text(mitgliedName, PL, y);

  // ── Bestellung ───────────────────────────────────────────────
  y += 9;
  font(8.5, 'normal', 130, 130, 130);
  doc.text(`Bestellung: ${rechnung.bestellungBezeichnung}`, PL, y);

  // ── Trennlinie ───────────────────────────────────────────────
  y += 7;
  doc.setDrawColor(200, 200, 200);
  doc.line(PL, y, PR, y);
  y += 6;

  // ── Tabellenkopf ─────────────────────────────────────────────
  font(8, 'bold', 140, 140, 140);
  doc.text('Pos.',          C_NR, y);
  doc.text('Bezeichnung',   C_NAME, y);
  doc.text('Gr.',           C_GR, y);
  doc.text('Menge',         C_MNG, y);
  doc.text('Eigenanteil',   C_EA, y, { align: 'right' });

  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.line(PL, y, PR, y);
  y += 5;

  // ── Positionen ───────────────────────────────────────────────
  font(9, 'normal');

  rechnung.positionen.forEach((p, i) => {
    const maxW   = C_GR - C_NAME - 2;
    const zeilen = doc.splitTextToSize(p.name, maxW);

    doc.text(String(i + 1) + '.', C_NR, y);
    doc.text(zeilen[0], C_NAME, y);
    doc.text(p.variante || '–', C_GR, y);
    doc.text(String(p.menge), C_MNG, y);
    doc.text(eur(p.eigenanteil), C_EA, y, { align: 'right' });
    y += 6;

    // Zweite+ Zeile des Namens (bei sehr langen Bezeichnungen)
    for (let j = 1; j < zeilen.length && j < 3; j++) {
      font(8.5, 'normal', 130, 130, 130);
      doc.text(zeilen[j], C_NAME, y);
      font(9, 'normal');
      y += 5;
    }
  });

  // ── Summe ────────────────────────────────────────────────────
  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.line(PL, y, PR, y);
  y += 6;

  font(10, 'bold');
  doc.text('Eigenanteil gesamt', C_NAME, y);
  doc.text(eur(rechnung.gesamtbetrag), C_EA, y, { align: 'right' });

  // ── OG-Anteil & Einsatzstunden ───────────────────────────────
  if (rechnung.ogAnteil > 0) {
    y += 10;
    font(8.5, 'normal', 100, 100, 100);
    doc.text(
      `OG-Förderanteil: ${eur(rechnung.ogAnteil)} → ${rechnung.erwartetEinsatzstunden} Einsatzstunden erwartet`,
      PL, y
    );
    const fristJahr = new Date(rechnung.datum).getFullYear() + 1;
    y += 5;
    doc.text(`Abarbeitungsfrist: bis 31. Dezember ${fristJahr}`, PL, y);
  }

  // ── Bankverbindung ───────────────────────────────────────────
  y += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(PL, y, PR, y);
  y += 7;

  const faellig = new Date(rechnung.datum);
  faellig.setDate(faellig.getDate() + 30);
  const faelligStr = faellig.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  font(8.5, 'bold');
  doc.text(`Bitte überweisen Sie ${eur(rechnung.gesamtbetrag)} bis zum ${faelligStr} auf:`, PL, y);
  y += 6;
  font(8.5, 'normal', 40, 40, 40);
  if (og.iban) { doc.text(`IBAN: ${og.iban}`, PL, y); y += 5; }
  if (og.bic)  { doc.text(`BIC:  ${og.bic}`,  PL, y); y += 5; }
  if (og.bank) { doc.text(`Bank: ${og.bank}`, PL, y); y += 5; }
  y += 2;
  font(8.5, 'bold');
  doc.text(`Verwendungszweck: ${rechnung.nummer} ${mitgliedName}`, PL, y);

  // ── Footer ───────────────────────────────────────────────────
  const footerY = 282;
  doc.setDrawColor(200, 200, 200);
  doc.line(PL, footerY - 4, PR, footerY - 4);
  font(7.5, 'normal', 130, 130, 130);
  const footerTeile = [
    og.name,
    og.amtsgericht ? `AG ${og.amtsgericht}` : null,
    og.steuernr    ? `StNr ${og.steuernr}`  : null,
    og.vorstand1   ? `1. Vors.: ${og.vorstand1}` : null,
    og.finanzen    ? `Finanzen: ${og.finanzen}`   : null,
  ].filter(Boolean);
  doc.text(footerTeile.join(' · '), 105, footerY, { align: 'center' });

  // ── Download ─────────────────────────────────────────────────
  const dateiname = `${rechnung.nummer}_${mitgliedName.replace(/\s+/g, '_')}.pdf`;
  doc.save(dateiname);
}
