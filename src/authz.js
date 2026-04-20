import { isFunctionSession, isMemberSession } from './session.js';

// ---------------------------------------------------------------------------
// Rollenmatrizen als konstante Datenstrukturen
// ---------------------------------------------------------------------------

const READ_SCOPES = {
  admin:       ['bestellungen', 'rechnungen', 'kassenwart', 'artikel', 'materialbestand', 'einstellungen', 'dashboard', 'wuensche', 'wunsch-queue'],
  finanzen:    ['bestellungen', 'rechnungen', 'kassenwart', 'materialbestand', 'dashboard'],
  materialwart:['bestellungen', 'materialbestand', 'dashboard'],
  user:        ['mitglied', 'wuensche'],
};

const WRITE_SCOPES = {
  admin:       ['bestellungen', 'rechnungen', 'kassenwart', 'artikel', 'materialbestand', 'einstellungen', 'wuensche', 'wunsch-queue'],
  finanzen:    ['rechnungen', 'kassenwart'],
  materialwart:['materialbestand'],
  user:        ['wuensche'],
};

const AKTIONS_ROLLEN = {
  'bestellung-schreiben':       ['admin'],
  'bestellung-abschliessen':    ['admin'],
  'rechnung-erstellen':         ['admin', 'finanzen'],
  'zahlung-setzen':             ['admin', 'finanzen'],
  'foerderung-aendern':         ['admin', 'finanzen'],
  'artikel-schreiben':          ['admin'],
  'materialbestand-schreiben':  ['admin', 'materialwart'],
  'lagerverkauf-finalisieren':  ['admin', 'finanzen'],
  'lageranfrage-freigeben':     ['admin', 'finanzen'],
  'einstellungen-schreiben':    ['admin'],
  'nutzer-verwalten':           ['admin'],
  'zugriff-setzen':             ['admin'],
  'wunsch-uebernehmen':         ['admin'],
  'wunsch-ablehnen':            ['admin'],
  'wunsch-schreiben':           ['admin', 'user'],
};

const SEITEN_ROLLEN = {
  'index.html':               ['admin', 'finanzen', 'materialwart'],
  'bestellungen.html':        ['admin', 'finanzen', 'materialwart'],
  'bestellung-neu.html':      ['admin'],
  'bestellung-sammeln.html':  ['admin'],
  'bestellung-abgleich.html': ['admin'],
  'artikel.html':             ['admin'],
  'materialbestand.html':     ['admin', 'finanzen', 'materialwart'],
  'rechnungen.html':          ['admin', 'finanzen'],
  'kassenwart.html':          ['admin', 'finanzen'],
  'dashboard.html':           ['admin', 'finanzen', 'materialwart'],
  'einstellungen.html':       ['admin'],
  'wunsch-queue.html':        ['admin'],
  'mitglied.html':            ['user'],
  'wuensche.html':            ['user'],
};

// ---------------------------------------------------------------------------
// Hilfsfunktion
// ---------------------------------------------------------------------------

function getRolle(session) {
  if (!session) return null;
  return session.rolle || null;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

export function canRead(scope, session) {
  const rolle = getRolle(session);
  if (!rolle) return false;
  const erlaubteScopes = READ_SCOPES[rolle];
  if (!erlaubteScopes) return false;
  return erlaubteScopes.includes(scope);
}

export function canWrite(scope, session) {
  const rolle = getRolle(session);
  if (!rolle) return false;
  const erlaubteScopes = WRITE_SCOPES[rolle];
  if (!erlaubteScopes) return false;
  return erlaubteScopes.includes(scope);
}

export function darfAktion(aktion, session) {
  const rolle = getRolle(session);
  if (!rolle) return false;
  const erlaubteRollen = AKTIONS_ROLLEN[aktion];
  if (!erlaubteRollen) return false;
  return erlaubteRollen.includes(rolle);
}

export function requireSeite(page, session) {
  const rolle = getRolle(session);
  if (!rolle) return { erlaubt: false };

  const erlaubteRollen = SEITEN_ROLLEN[page];
  if (!erlaubteRollen) {
    // Unbekannte Seite: nur admin darf
    return { erlaubt: rolle === 'admin' };
  }
  return { erlaubt: erlaubteRollen.includes(rolle) };
}
