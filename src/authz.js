import { isFunctionSession, isMemberSession } from './session.js';

// ---------------------------------------------------------------------------
// Rollenmatrizen als konstante Datenstrukturen
// ---------------------------------------------------------------------------

const READ_SCOPES = {
  admin:       ['bestellungen', 'rechnungen', 'kassenwart', 'artikel', 'materialbestand', 'einstellungen', 'dashboard'],
  finanzen:    ['bestellungen', 'rechnungen', 'kassenwart', 'dashboard'],
  materialwart:['bestellungen', 'artikel', 'materialbestand', 'dashboard'],
  user:        ['mitglied'],
};

const WRITE_SCOPES = {
  admin:       ['bestellungen', 'rechnungen', 'kassenwart', 'artikel', 'materialbestand', 'einstellungen'],
  finanzen:    ['rechnungen', 'kassenwart'],
  materialwart:['artikel', 'materialbestand'],
  user:        [],
};

const AKTIONS_ROLLEN = {
  'bestellung-schreiben':       ['admin'],
  'bestellung-abschliessen':    ['admin'],
  'rechnung-erstellen':         ['admin', 'finanzen'],
  'zahlung-setzen':             ['admin', 'finanzen'],
  'foerderung-aendern':         ['admin', 'finanzen'],
  'artikel-schreiben':          ['admin', 'materialwart'],
  'materialbestand-schreiben':  ['admin', 'materialwart'],
  'einstellungen-schreiben':    ['admin'],
  'nutzer-verwalten':           ['admin'],
  'zugriff-setzen':             ['admin'],
};

const SEITEN_ROLLEN = {
  'index.html':               ['admin', 'finanzen', 'materialwart'],
  'bestellungen.html':        ['admin', 'finanzen', 'materialwart'],
  'bestellung-neu.html':      ['admin'],
  'bestellung-sammeln.html':  ['admin'],
  'bestellung-abgleich.html': ['admin'],
  'artikel.html':             ['admin', 'materialwart'],
  'materialbestand.html':     ['admin', 'materialwart'],
  'rechnungen.html':          ['admin', 'finanzen'],
  'kassenwart.html':          ['admin', 'finanzen'],
  'dashboard.html':           ['admin', 'finanzen', 'materialwart'],
  'einstellungen.html':       ['admin'],
  'mitglied.html':            ['user'],
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
