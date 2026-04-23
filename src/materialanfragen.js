function err(fehler) { return { ok: false, fehler }; }
const OK = { ok: true };

import { leseKostenmodus } from './kostenmodus.js';

export const MATERIAL_ANFRAGE_STATUS = ['offen', 'abgerechnet', 'abgelehnt'];

function leer(value) {
  return value == null || !String(value).trim();
}

function istNichtNegativeGanzeZahl(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function istPositiveGanzeZahl(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function uuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `mreq_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function normalisiereMaterialanfrage(anfrage) {
  const kostenmodus = leseKostenmodus(anfrage);
  return {
    id: String(anfrage?.id || uuid()),
    status: MATERIAL_ANFRAGE_STATUS.includes(anfrage?.status) ? anfrage.status : 'offen',
    materialId: String(anfrage?.materialId || '').trim(),
    nummer: String(anfrage?.nummer || '').trim(),
    bezeichnung: String(anfrage?.bezeichnung || '').trim(),
    variante: String(anfrage?.variante || '').trim().toUpperCase(),
    menge: istPositiveGanzeZahl(anfrage?.menge) ? anfrage.menge : 1,
    mitgliedId: String(anfrage?.mitgliedId || '').trim(),
    mitgliedName: String(anfrage?.mitgliedName || '').trim(),
    hinweis: String(anfrage?.hinweis || '').trim(),
    foerderwunsch: anfrage?.foerderwunsch === true,
    angelegtAm: String(anfrage?.angelegtAm || nowIso()),
    angelegtVonRolle: String(anfrage?.angelegtVonRolle || '').trim(),
    angelegtVonName: String(anfrage?.angelegtVonName || '').trim(),
    entscheidung: ['normal', 'og_mit_stunden', 'og_ohne_gegenleistung', 'og', 'abgelehnt'].includes(anfrage?.entscheidung) ? anfrage.entscheidung : '',
    entschiedenAm: String(anfrage?.entschiedenAm || '').trim(),
    entschiedenVonRolle: String(anfrage?.entschiedenVonRolle || '').trim(),
    entschiedenVonName: String(anfrage?.entschiedenVonName || '').trim(),
    bestellungId: String(anfrage?.bestellungId || '').trim(),
    rechnungId: String(anfrage?.rechnungId || '').trim(),
    rechnungsnummer: String(anfrage?.rechnungsnummer || '').trim(),
    kostenmodus,
  };
}

export function validateMaterialanfrage(anfrage) {
  if (!anfrage || typeof anfrage !== 'object') return err('materialanfrage muss ein Objekt sein');
  if (leer(anfrage.materialId)) return err('materialId darf nicht leer sein');
  if (leer(anfrage.nummer)) return err('nummer darf nicht leer sein');
  if (leer(anfrage.bezeichnung)) return err('bezeichnung darf nicht leer sein');
  if (!istPositiveGanzeZahl(anfrage.menge)) return err('menge muss eine positive ganze Zahl sein');
  if (leer(anfrage.mitgliedId)) return err('mitgliedId darf nicht leer sein');
  if (anfrage.status != null && !MATERIAL_ANFRAGE_STATUS.includes(anfrage.status)) {
    return err('status ist ungültig');
  }
  return OK;
}

export function sortiereMaterialanfragen(anfragen) {
  return [...(anfragen || [])].sort((a, b) =>
    String(b.angelegtAm || '').localeCompare(String(a.angelegtAm || ''))
  );
}
