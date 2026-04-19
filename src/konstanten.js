/**
 * konstanten.js
 * Projekt-weite Konstanten.
 */

/**
 * Virtuelle Mitglieds-ID für Ortsgruppen-eigenen Bedarf.
 * Wünsche mit dieser ID erzeugen keine Mitgliedsrechnung.
 */
export const OG_ID = '__og__';

/**
 * Virtuelle Mitglieds-ID für externe Besteller außerhalb der eigenen OG.
 * Diese Besteller können Rechnungen erhalten, sind aber kein Teil der
 * internen Mitglieder- und Stundenlogik.
 */
export const EXTERN_ID = '__extern__';
