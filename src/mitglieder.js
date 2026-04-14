/**
 * mitglieder.js
 * Reine Logik rund um die Mitgliederliste.
 *
 * Öffentliche API:
 *   parseMitglieder(text) → { mitglieder[], fehler[] }
 */

/**
 * Parst den Inhalt des defaultUsers-Arrays aus der Stempeluhr-config.js.
 * Extrahiert nur id und name — keine PINs.
 *
 * @param {string} text  Inhalt zwischen den eckigen Klammern von defaultUsers
 * @returns {{ mitglieder: {id, name}[], fehler: string[] }}
 */
export function parseMitglieder(text) {
  const mitglieder = [];
  const fehler     = [];

  if (!text || !text.trim()) return { mitglieder, fehler };

  const idRegex   = /id\s*:\s*['"]([^'"]+)['"]/;
  const nameRegex = /name\s*:\s*['"]([^'"]+)['"]/;

  const eintraege = text
    .split(/\}\s*,?\s*\{/)
    .map(s => s.replace(/^\s*[\[{]/, '').replace(/[\]}]\s*$/, ''));

  for (const eintrag of eintraege) {
    const idMatch   = eintrag.match(idRegex);
    const nameMatch = eintrag.match(nameRegex);
    if (idMatch && nameMatch) {
      mitglieder.push({ id: idMatch[1], name: nameMatch[1] });
    } else if (eintrag.trim()) {
      fehler.push(eintrag.trim().slice(0, 60));
    }
  }

  return { mitglieder, fehler };
}
