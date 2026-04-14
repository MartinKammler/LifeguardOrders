/**
 * webdav.js
 * Kapselt alle Nextcloud/WebDAV-Zugriffe.
 * Alle anderen Module sprechen ausschließlich über dieses Modul mit der Nextcloud.
 *
 * Öffentliche API (via createWebDavClient):
 *   readJson(path)        → { ok, data, error }
 *   writeJson(path, data) → { ok, error }
 *   listFiles(path)       → { ok, files[], error }
 *   testConnection()      → { ok, error }
 */

const FEHLERTEXTE = {
  401: 'Authentifizierung fehlgeschlagen — Benutzername oder Passwort prüfen.',
  403: 'Zugriff verweigert.',
  404: 'Datei nicht gefunden.',
  503: 'Nextcloud nicht erreichbar — Server antwortet nicht.',
};

function fehlerText(status) {
  return FEHLERTEXTE[status] || `Serverfehler (HTTP ${status}).`;
}

function basicAuth(user, pass) {
  return 'Basic ' + btoa(`${user}:${pass}`);
}

/**
 * Baut die WebDAV-URL für einen Pfad.
 * Nextcloud WebDAV-Endpunkt: /remote.php/dav/files/<user>/<pfad>
 */
function davUrl(baseUrl, user, path) {
  const base = baseUrl.replace(/\/$/, '');
  const p    = path.startsWith('/') ? path : '/' + path;
  return `${base}/remote.php/dav/files/${user}${p}`;
}

/**
 * Erstellt einen WebDAV-Client mit den angegebenen Zugangsdaten.
 *
 * @param {{ url, user, pass }} creds   Nextcloud-Zugangsdaten
 * @param {Function}            fetchFn fetch-Funktion (Standard: globalThis.fetch); für Tests mockbar
 * @returns {{ readJson, writeJson, listFiles, testConnection }}
 */
export function createWebDavClient(creds, fetchFn = globalThis.fetch) {
  const { url, user, pass } = creds;
  const auth = basicAuth(user, pass);

  async function request(method, path, body, extraHeaders = {}) {
    const fullUrl = davUrl(url, user, path);
    try {
      const resp = await fetchFn(fullUrl, {
        method,
        headers: { Authorization: auth, ...extraHeaders },
        body,
      });
      return resp;
    } catch (err) {
      return null; // Netzwerkfehler
    }
  }

  async function readJson(path) {
    const resp = await request('GET', path);
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.' };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status) };
    try {
      const text = await resp.text();
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, error: 'Antwort ist kein gültiges JSON.' };
    }
  }

  async function writeJson(path, data) {
    const resp = await request('PUT', path, JSON.stringify(data), {
      'Content-Type': 'application/json',
    });
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.' };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status) };
    return { ok: true };
  }

  async function listFiles(path) {
    const resp = await request('PROPFIND', path, null, { Depth: '1' });
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.', files: [] };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status), files: [] };

    const xml   = await resp.text();
    const hrefs = [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/g)]
      .map(m => m[1].trim())
      .filter(href => !href.endsWith('/'));  // Verzeichnis-Eintrag entfernen

    return { ok: true, files: hrefs };
  }

  async function testConnection() {
    const resp = await request('PROPFIND', '/', null, { Depth: '0' });
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.' };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status) };
    return { ok: true };
  }

  return { readJson, writeJson, listFiles, testConnection };
}
