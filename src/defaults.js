/**
 * defaults.js
 * Lädt lokale Fallback-Daten aus data/*.json wenn localStorage leer ist.
 * Ermöglicht browserübergreifende Nutzung ohne erneuten Import.
 */

/**
 * Lädt Artikel-Katalog aus data/artikel.json als Fallback.
 * Gibt leeres Array zurück wenn die Datei nicht vorhanden ist.
 * @returns {Promise<Array>}
 */
export async function ladeDefaultArtikel() {
  try {
    const r = await fetch('./data/artikel.json');
    if (!r.ok) return [];
    const daten = await r.json();
    return Array.isArray(daten) ? daten : [];
  } catch {
    return [];
  }
}

/**
 * Lädt Einstellungen aus data/einstellungen.json als Fallback.
 * Gibt null zurück wenn die Datei nicht vorhanden ist oder leer ist.
 * @returns {Promise<object|null>}
 */
export async function ladeDefaultEinstellungen() {
  try {
    const r = await fetch('./data/einstellungen.json');
    if (!r.ok) return null;
    const daten = await r.json();
    return daten && typeof daten === 'object' ? daten : null;
  } catch {
    return null;
  }
}

/**
 * Lädt Bestellungen aus data/bestellungen.json als Fallback.
 * Gibt leeres Array zurück wenn die Datei nicht vorhanden ist.
 * @returns {Promise<Array>}
 */
export async function ladeDefaultBestellungen() {
  try {
    const r = await fetch('./data/bestellungen.json');
    if (!r.ok) return [];
    const daten = await r.json();
    return Array.isArray(daten) ? daten : [];
  } catch {
    return [];
  }
}

/**
 * Löst einen Download der übergebenen Daten als JSON-Datei aus.
 * @param {any}    daten     - Zu exportierende Daten
 * @param {string} dateiname - Dateiname ohne Pfad, z. B. "artikel.json"
 */
export function downloadAlsJson(daten, dateiname) {
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}
