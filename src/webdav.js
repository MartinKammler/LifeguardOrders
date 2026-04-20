/**
 * webdav.js
 * Kapselt alle Nextcloud/WebDAV-Zugriffe.
 * Alle anderen Module sprechen ausschließlich über dieses Modul mit der Nextcloud.
 *
 * Öffentliche API (via createWebDavClient):
 *   readJson(path)                    → { ok, data, etag?, lastModified?, error }
 *   head(path)                        → { ok, etag?, lastModified?, missing?, error }
 *   writeJson(path, data, opts?)      → { ok, etag?, lastModified?, conflict?, error }
 *   listFiles(path)                   → { ok, files[], error }
 *   testConnection()                  → { ok, error }
 */

const FEHLERTEXTE = {
  401: 'Authentifizierung fehlgeschlagen — Benutzername oder Passwort prüfen.',
  403: 'Zugriff verweigert.',
  404: 'Datei nicht gefunden.',
  412: 'Datei wurde zwischenzeitlich geändert.',
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

function liesMeta(resp) {
  return {
    etag: resp?.headers?.get?.('etag') || '',
    lastModified: resp?.headers?.get?.('last-modified') || '',
  };
}

function parseXml(xmlText) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(xmlText, 'application/xml');
  }
  throw new Error('XML-Parsing wird in dieser Umgebung nicht unterstützt.');
}

function parseDavHrefDateien(xmlText) {
  try {
    const doc = parseXml(xmlText);
    const parserError = doc.getElementsByTagName('parsererror')[0];
    if (!parserError) {
      const hrefNodes = Array.from(doc.getElementsByTagName('*'))
        .filter(node => String(node.localName || node.nodeName || '').toLowerCase() === 'href');
      if (hrefNodes.length) {
        return hrefNodes
          .map(node => (node.textContent || '').trim())
          .filter(Boolean)
          .filter(href => !href.endsWith('/'));
      }
    }
  } catch {
    // Fallback weiter unten.
  }

  return [...xmlText.matchAll(/<(?:[\w-]+:)?href>([^<]+)<\/(?:[\w-]+:)?href>/g)]
    .map(match => match[1].trim())
    .filter(Boolean)
    .filter(href => !href.endsWith('/'));
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
      return { ok: true, data: JSON.parse(text), ...liesMeta(resp) };
    } catch {
      return { ok: false, error: 'Antwort ist kein gültiges JSON.' };
    }
  }

  async function head(path) {
    const resp = await request('HEAD', path);
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.' };
    if (resp.status === 404) return { ok: false, missing: true, error: fehlerText(resp.status) };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status) };
    return { ok: true, ...liesMeta(resp) };
  }

  async function writeJson(path, data, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (opts.ifMatch != null) headers['If-Match'] = opts.ifMatch;
    if (opts.ifNoneMatch != null) headers['If-None-Match'] = opts.ifNoneMatch;

    const resp = await request('PUT', path, JSON.stringify(data), headers);
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.' };
    if (resp.status === 412) return { ok: false, conflict: true, error: fehlerText(resp.status) };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status) };
    return { ok: true, ...liesMeta(resp) };
  }

  async function listFiles(path) {
    const resp = await request('PROPFIND', path, null, { Depth: '1' });
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.', files: [] };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status), files: [] };

    try {
      const xml = await resp.text();
      return { ok: true, files: parseDavHrefDateien(xml) };
    } catch (error) {
      return { ok: false, error: error.message || 'Antwort ist kein gültiges XML.', files: [] };
    }
  }

  async function testConnection() {
    const resp = await request('PROPFIND', '/', null, { Depth: '0' });
    if (!resp) return { ok: false, error: 'Nextcloud nicht erreichbar.' };
    if (!resp.ok) return { ok: false, error: fehlerText(resp.status) };
    return { ok: true };
  }

  return { readJson, head, writeJson, listFiles, testConnection };
}
