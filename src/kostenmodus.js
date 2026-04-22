export const KOSTENMODUS_NORMAL = 'normal';
export const KOSTENMODUS_OG_MIT_STUNDEN = 'og_mit_stunden';
export const KOSTENMODUS_OG_OHNE_GEGENLEISTUNG = 'og_ohne_gegenleistung';

export const KOSTENMODI = [
  KOSTENMODUS_NORMAL,
  KOSTENMODUS_OG_MIT_STUNDEN,
  KOSTENMODUS_OG_OHNE_GEGENLEISTUNG,
];

export function normalisiereKostenmodus(value, legacyOgKostenlos = false) {
  if (KOSTENMODI.includes(value)) return value;
  if (legacyOgKostenlos === true) return KOSTENMODUS_OG_MIT_STUNDEN;
  return KOSTENMODUS_NORMAL;
}

export function leseKostenmodus(eintrag) {
  return normalisiereKostenmodus(eintrag?.kostenmodus, eintrag?.ogKostenlos === true);
}

function resolveKostenmodusValue(value, legacyOgKostenlos = false) {
  if (value && typeof value === 'object') return leseKostenmodus(value);
  return normalisiereKostenmodus(value, legacyOgKostenlos);
}

export function istOgMitStunden(value, legacyOgKostenlos = false) {
  return resolveKostenmodusValue(value, legacyOgKostenlos) === KOSTENMODUS_OG_MIT_STUNDEN;
}

export function istOgOhneGegenleistung(value, legacyOgKostenlos = false) {
  return resolveKostenmodusValue(value, legacyOgKostenlos) === KOSTENMODUS_OG_OHNE_GEGENLEISTUNG;
}

export function istOgUebernahme(value, legacyOgKostenlos = false) {
  const modus = resolveKostenmodusValue(value, legacyOgKostenlos);
  return modus === KOSTENMODUS_OG_MIT_STUNDEN || modus === KOSTENMODUS_OG_OHNE_GEGENLEISTUNG;
}

export function erzeugtStundenpflicht(value, legacyOgKostenlos = false) {
  return resolveKostenmodusValue(value, legacyOgKostenlos) === KOSTENMODUS_OG_MIT_STUNDEN;
}

export function kostenmodusLabel(value, legacyOgKostenlos = false) {
  const modus = resolveKostenmodusValue(value, legacyOgKostenlos);
  if (modus === KOSTENMODUS_OG_MIT_STUNDEN) return 'Wache';
  if (modus === KOSTENMODUS_OG_OHNE_GEGENLEISTUNG) return 'OG';
  return 'Normal';
}

export function kostenmodusLangLabel(value, legacyOgKostenlos = false) {
  const modus = resolveKostenmodusValue(value, legacyOgKostenlos);
  if (modus === KOSTENMODUS_OG_MIT_STUNDEN) return 'Wache (gegen Helferstunden)';
  if (modus === KOSTENMODUS_OG_OHNE_GEGENLEISTUNG) return 'OG (ohne Gegenleistung)';
  return 'Normal (selbst zahlt)';
}

export function kostenmodusBadgeKlasse(value, legacyOgKostenlos = false) {
  const modus = resolveKostenmodusValue(value, legacyOgKostenlos);
  if (modus === KOSTENMODUS_OG_MIT_STUNDEN) return 'badge badge-amber';
  if (modus === KOSTENMODUS_OG_OHNE_GEGENLEISTUNG) return 'badge badge-green';
  return 'badge badge-blue';
}
