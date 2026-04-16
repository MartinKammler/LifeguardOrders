/**
 * audit.js
 * Unveränderlichkeits-Prüfung für Rechnungen und einfaches Aktionsprotokoll.
 *
 * Öffentliche API:
 *   logAktion(action, user, changes) → AuditEintrag
 *   ladeLog()                        → AuditEintrag[]
 *   istRechnungUnveraendert(a, b)    → boolean
 */

const AUDIT_KEY = 'lo_audit_log';

/**
 * Schreibt einen Audit-Eintrag in localStorage.
 * @param {string} action    z.B. 'RECHNUNG_ERSTELLT', 'ZAHLUNG_GESETZT'
 * @param {string} user      mitgliedId des ausführenden Nutzers
 * @param {object} changes   Freitextdaten zur Aktion
 * @returns {object}         Der gespeicherte Eintrag
 */
export function logAktion(action, user, changes = {}) {
  const eintrag = {
    action,
    user,
    timestamp: new Date().toISOString(),
    changes,
  };
  try {
    const log = ladeLog();
    log.push(eintrag);
    // Maximal 500 Einträge behalten (FIFO)
    if (log.length > 500) log.splice(0, log.length - 500);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
  } catch {
    // Logging darf niemals die App blockieren
  }
  return eintrag;
}

/**
 * Lädt alle gespeicherten Audit-Einträge.
 * @returns {object[]}
 */
export function ladeLog() {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Prüft ob zwei Rechnungs-Objekte inhaltlich identisch sind
 * (vergleicht die prüfrelevanten Felder: nummer, gesamtbetrag, positionen).
 * @param {object} a  Original-Rechnung
 * @param {object} b  Zu prüfende Version
 * @returns {boolean}
 */
export function istRechnungUnveraendert(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.nummer       !== b.nummer)       return false;
  if (a.gesamtbetrag !== b.gesamtbetrag) return false;
  if (JSON.stringify(a.positionen) !== JSON.stringify(b.positionen)) return false;
  return true;
}