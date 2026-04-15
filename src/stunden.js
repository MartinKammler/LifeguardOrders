/**
 * stunden.js
 * Einsatzstunden-Auswertung und Schuldenverrechnung.
 *
 * Öffentliche API:
 *   berechneStunden(logEintraege, einsatztypen, mitglieder?) → { stundenMap, unbekannt }
 *   verechneSchuld(mitgliedId, bestellungen, geleisteteStunden, einstellungen)
 *     → { gesamtSchuldStunden, restSchuldStunden, verrechnungen }
 *   ampelStatus(restSchuld, frist, heute?) → 'gruen' | 'gelb' | 'rot'
 *   schuldFrist(bestellungDatum) → Date (31.12. Bestelljahr + 1)
 */

/**
 * Summiert Einsatzstunden aus Stempeluhr-Logs pro Mitglied.
 *
 * Erwartet ein flaches Array von Log-Einträgen mit:
 *   { userId, typ, dauer_ms }
 * Einträge ohne dauer_ms (= kein Stop-Event) werden ignoriert.
 *
 * @param {object[]} logEintraege  Alle Log-Einträge (aus lgc_*.json zusammengeführt)
 * @param {string[]} einsatztypen  Zählende Typen (z.B. ['wachdienst', 'sanitaetsdienst'])
 * @param {object[]} mitglieder    Optional: bekannte Mitglieder; unbekannte IDs → unbekannt[]
 * @returns {{ stundenMap: Map<string, number>, unbekannt: string[] }}
 */
export function berechneStunden(logEintraege, einsatztypen, mitglieder = []) {
  const stundenMap  = new Map();
  const typenSet    = new Set((einsatztypen || []).map(t => t.toLowerCase().trim()));
  const bekannteIds = mitglieder.length ? new Set(mitglieder.map(m => m.id)) : null;
  const unbekannt   = new Set();

  for (const entry of (logEintraege || [])) {
    if (!entry.dauer_ms || entry.dauer_ms <= 0) continue;

    const typ = (entry.typ || entry.type || '').toLowerCase().trim();
    if (!typenSet.has(typ)) continue;

    const userId = entry.userId || entry.user_id || '';
    if (!userId) continue;

    if (bekannteIds && !bekannteIds.has(userId)) {
      unbekannt.add(userId);
      continue;
    }

    const stunden = entry.dauer_ms / 3_600_000;
    stundenMap.set(userId, (stundenMap.get(userId) || 0) + stunden);
  }

  return { stundenMap, unbekannt: [...unbekannt] };
}

/**
 * Verrechnet geleistete Stunden eines Mitglieds gegen seine Schulden
 * (chronologisch, älteste Schuld zuerst).
 *
 * @param {string}   mitgliedId
 * @param {object[]} bestellungen        Alle Bestellungen
 * @param {number}   geleisteteStunden   Tatsächlich geleistete Stunden
 * @param {object}   einstellungen       Einstellungen (stundenRate)
 * @returns {{ gesamtSchuldStunden, restSchuldStunden, verrechnungen[] }}
 */
export function verechneSchuld(mitgliedId, bestellungen, geleisteteStunden, einstellungen) {
  const sr = einstellungen?.stundenRate || { stunden: 3, euro: 10 };

  // Alle Stundenschulden sammeln (nur abgeschlossene Bestellungen mit Rechnungen)
  const schulden = [];
  for (const b of (bestellungen || [])) {
    for (const r of (b.rechnungen || [])) {
      if (r.mitgliedId !== mitgliedId) continue;
      const schuldStunden = r.erwartetEinsatzstunden || 0;
      if (schuldStunden <= 0) continue;
      schulden.push({
        rechnungId:     r.id,
        rechnungNummer: r.nummer,
        rechnungDatum:  r.datum,
        bestellungDatum: b.datum,
        schuldStunden,
      });
    }
  }

  // Älteste zuerst
  schulden.sort((a, b) => a.rechnungDatum.localeCompare(b.rechnungDatum));

  if (!schulden.length) {
    return { gesamtSchuldStunden: 0, restSchuldStunden: 0, verrechnungen: [] };
  }

  const gesamtSchuldStunden = schulden.reduce((s, d) => s + d.schuldStunden, 0);
  let verbleibend = geleisteteStunden;
  let restSchuldStunden = 0;
  const verrechnungen = [];

  for (const d of schulden) {
    const getilgt = Math.min(verbleibend, d.schuldStunden);
    const offen   = d.schuldStunden - getilgt;
    verbleibend  -= getilgt;
    restSchuldStunden += offen;

    verrechnungen.push({
      rechnungNummer: d.rechnungNummer,
      rechnungDatum:  d.rechnungDatum,
      schuldStunden:  d.schuldStunden,
      getilgtStunden: getilgt,
      offenStunden:   offen,
    });
  }

  return { gesamtSchuldStunden, restSchuldStunden, verrechnungen };
}

/**
 * Bestimmt den Ampelstatus anhand offener Stundenschuld und Frist.
 *
 * @param {number} restSchuld  Offene Stunden
 * @param {Date}   frist       Abarbeitungsfrist
 * @param {Date}   [heute]     Referenzdatum (Standard: heute)
 * @returns {'gruen' | 'gelb' | 'rot'}
 */
export function ampelStatus(restSchuld, frist, heute = new Date()) {
  if (restSchuld <= 0) return 'gruen';
  const fristDate  = frist instanceof Date ? frist : new Date(frist);
  const heuteMitte = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  return fristDate >= heuteMitte ? 'gelb' : 'rot';
}

/**
 * Berechnet die Abarbeitungsfrist: 31.12. des Bestelljahres + 1 Kulanzjahr.
 *
 * @param {string} bestellungDatum  ISO-Datum der Bestellung (z.B. "2025-03-15")
 * @returns {Date}
 */
export function schuldFrist(bestellungDatum) {
  const jahr = parseInt((bestellungDatum || '').slice(0, 4), 10);
  if (!jahr || isNaN(jahr)) return new Date(new Date().getFullYear() + 1, 11, 31);
  return new Date(jahr + 1, 11, 31); // 31.12.(jahr+1)
}
