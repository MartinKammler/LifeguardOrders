/**
 * audit.js
 * Unveränderlichkeits-Prüfung für Rechnungen und einfaches Aktionsprotokoll.
 *
 * Öffentliche API:
 *   logAktion(action, user, changes) → AuditEintrag
 *   ladeLog()                        → AuditEintrag[]
 *   schreibeAuditEintragRemote(opts) → { ok, entry?, error? }
 *   auditAktion(opts)                → { ok, entry, remote }
 *   istRechnungUnveraendert(a, b)    → boolean
 */

const AUDIT_KEY = 'lo_audit_log';
export const NC_PFAD_AUDIT = '/LifeguardOrders/audit.log.json';
const MAX_LOCAL_AUDIT_EINTRAEGE = 500;

function randomId() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultStorage() {
  return {
    load: key => {
      try {
        return JSON.parse(localStorage.getItem(key) || 'null');
      } catch {
        return null;
      }
    },
    save: (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

/**
 * Baut einen actor-Block aus einem Session-Objekt oder String.
 * @param {string|object|null|undefined} user
 * @returns {object}
 */
function buildActor(user) {
  if (!user || typeof user !== 'object') {
    return {
      userId:           typeof user === 'string' ? user : '',
      userName:         '',
      authType:         '',
      sessionRole:      '',
      actingPersonId:   '',
      actingPersonName: '',
    };
  }
  return {
    userId:           String(user.id           || ''),
    userName:         String(user.name         || ''),
    authType:         String(user.authType     || ''),
    sessionRole:      String(user.rolle        || ''),
    actingPersonId:   String(user.actingPersonId   || ''),
    actingPersonName: String(user.actingPersonName || ''),
  };
}

/**
 * Schreibt einen Audit-Eintrag in localStorage.
 * @param {string}        action   z.B. 'RECHNUNG_ERSTELLT', 'ZAHLUNG_GESETZT'
 * @param {string|object} user     Session-Objekt oder mitgliedId-String
 * @param {object}        changes  Freitextdaten zur Aktion
 * @returns {object}               Der gespeicherte Eintrag
 */
export function logAktion(action, user, changes = {}, meta = {}) {
  const actor = buildActor(user);
  const eintrag = {
    id: randomId(),
    action,
    user: actor.userId,
    timestamp: new Date().toISOString(),
    changes,
    scope: meta.scope || '',
    entityId: meta.entityId || '',
    summary: meta.summary || '',
    actor,
  };
  try {
    const log = ladeLog();
    log.push(eintrag);
    if (log.length > MAX_LOCAL_AUDIT_EINTRAEGE) log.splice(0, log.length - MAX_LOCAL_AUDIT_EINTRAEGE);
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

export async function schreibeAuditEintragRemote({
  client,
  entry,
  remotePath = NC_PFAD_AUDIT,
  storage = defaultStorage(),
}) {
  if (!client) {
    return { ok: false, error: 'Nextcloud nicht konfiguriert.' };
  }

  const meta = await client.head(remotePath);
  let log = [];
  let writeOptions = {};

  if (!meta.ok) {
    if (!meta.missing) {
      return { ok: false, error: meta.error || 'Audit-Log konnte nicht geprüft werden.' };
    }
    writeOptions = { ifNoneMatch: '*' };
  } else {
    const remote = await client.readJson(remotePath);
    if (!remote.ok) {
      return { ok: false, error: remote.error || 'Audit-Log konnte nicht geladen werden.' };
    }
    if (!Array.isArray(remote.data)) {
      return { ok: false, error: 'Audit-Log ist ungültig.' };
    }
    log = remote.data;
    if (meta.etag) {
      writeOptions = { ifMatch: meta.etag };
    }
  }

  const nextLog = [...log, entry];
  const write = await client.writeJson(remotePath, nextLog, writeOptions);
  if (!write.ok) {
    return { ok: false, error: write.error || 'Audit-Log konnte nicht geschrieben werden.' };
  }

  try {
    storage.save(AUDIT_KEY, nextLog.slice(-MAX_LOCAL_AUDIT_EINTRAEGE));
  } catch {
    // Cache darf das Remote-Logging nicht blockieren.
  }
  return { ok: true, entry };
}

export async function auditAktion({
  client,
  user,
  action,
  changes = {},
  scope = '',
  entityId = '',
  summary = '',
  storage = defaultStorage(),
  remotePath = NC_PFAD_AUDIT,
}) {
  const entry = logAktion(action, user, changes, { scope, entityId, summary });
  const remote = await schreibeAuditEintragRemote({
    client,
    entry,
    storage,
    remotePath,
  });
  return { ok: remote.ok, entry, remote };
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
