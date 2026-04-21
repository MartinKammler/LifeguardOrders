import { load, save } from './storage.js';

export const STORAGE_KEY_Z = 'lo_zugriff';
export const NC_PFAD_Z = '/LifeguardOrders/zugriff.json';

export function defaultZugriff() {
  return {
    global: {
      userBestellungGesperrt: false,
      lagerverkaufGesperrt: false,
      grund: '',
      gesetztVon: '',
      gesetztAm: '',
    },
    mitglieder: [],
  };
}

export function normalizeZugriff(data) {
  const raw = data && typeof data === 'object' ? data : {};
  const global = raw.global && typeof raw.global === 'object' ? raw.global : {};
  const mitglieder = Array.isArray(raw.mitglieder) ? raw.mitglieder : [];
  return {
    global: {
      userBestellungGesperrt: global.userBestellungGesperrt === true,
      lagerverkaufGesperrt: global.lagerverkaufGesperrt === true,
      grund: String(global.grund || '').trim(),
      gesetztVon: String(global.gesetztVon || '').trim(),
      gesetztAm: String(global.gesetztAm || '').trim(),
    },
    mitglieder: mitglieder
      .map(entry => ({
        mitgliedId: String(entry?.mitgliedId || '').trim(),
        gesperrt: entry?.gesperrt === true,
        grund: String(entry?.grund || '').trim(),
        gesetztVon: String(entry?.gesetztVon || '').trim(),
        gesetztAm: String(entry?.gesetztAm || '').trim(),
        gesperrtBis: String(entry?.gesperrtBis || '').trim(),
      }))
      .filter(entry => entry.mitgliedId),
  };
}

export async function ladeZugriff(client, storage = { load, save }) {
  if (!client) {
    return { ok: false, error: 'Zugriffsoverlay kann ohne Nextcloud nicht geladen werden.', data: defaultZugriff(), source: 'auth-required' };
  }

  const remote = await client.readJson(NC_PFAD_Z);
  if (!remote.ok) {
    const fehlend = String(remote.error || '').toLowerCase().includes('datei nicht gefunden');
    if (fehlend) {
      const data = defaultZugriff();
      storage.save(STORAGE_KEY_Z, data);
      return { ok: true, data, source: 'default' };
    }
    return {
      ok: false,
      error: remote.error || 'Zugriffsoverlay konnte nicht geladen werden.',
      data: defaultZugriff(),
      source: 'remote-required',
    };
  }

  const data = normalizeZugriff(remote.data);
  storage.save(STORAGE_KEY_Z, data);
  return { ok: true, data, source: 'remote' };
}

export function findeMitgliedsSperre(zugriff, mitgliedId) {
  const normalized = normalizeZugriff(zugriff);
  const globalBlocked = normalized.global.userBestellungGesperrt === true;
  const member = normalized.mitglieder.find(entry => entry.mitgliedId === mitgliedId && entry.gesperrt);
  const memberBlocked = !!member;
  return {
    blocked: globalBlocked || memberBlocked,
    globalBlocked,
    memberBlocked,
    reason: member?.grund || normalized.global.grund || '',
    globalReason: normalized.global.grund || '',
    memberReason: member?.grund || '',
    gesetztVon: member?.gesetztVon || normalized.global.gesetztVon || '',
    gesetztAm: member?.gesetztAm || normalized.global.gesetztAm || '',
    gesperrtBis: member?.gesperrtBis || '',
  };
}
