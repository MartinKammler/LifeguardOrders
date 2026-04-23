import { berechneFoerderung } from './berechnung.js';
import { EXTERN_ID, OG_ID } from './konstanten.js';
import {
  kostenmodusLabel,
  istOgMitStunden,
  istOgOhneGegenleistung,
  leseKostenmodus,
} from './kostenmodus.js';

function runde(v) {
  return Math.round((v || 0) * 100) / 100;
}

function resolveMitgliedName(mitglieder, id) {
  if (id === OG_ID) return 'Ortsgruppe';
  if (id === EXTERN_ID) return 'Extern';
  const mitglied = (mitglieder || []).find(m => m.id === id);
  return mitglied ? mitglied.name : id;
}

export function berechneKassenwartZeilen(bestellungen, artikelListe, mitglieder) {
  const zeilen = [];

  for (const bestellung of (bestellungen || [])) {
    if (bestellung.status !== 'abgeschlossen') continue;
    const jahr = (bestellung.datum || '').slice(0, 4);

    for (const position of (bestellung.positionen || [])) {
      if (position.typ === 'og-kosten') continue;

      const artikel = (artikelListe || []).find(
        a => a.artikelNr === position.artikelNr && (a.variante || '') === (position.variante || '')
      );

      for (const zuweisung of (position.zuweisung || [])) {
        if (zuweisung.menge === 0) continue;

        const quelle = waehleFoerderQuelle(position, artikel);
        const kostenmodus = leseKostenmodus(zuweisung);
        const foerderung = berechneFoerderung(quelle, zuweisung.menge, {
          kostenmodus,
        });

        const rechnung = (bestellung.rechnungen || []).find(r => r.mitgliedId === zuweisung.mitgliedId);

        zeilen.push({
          jahr,
          bestellungId:   bestellung.id,
          bestellungBez:  bestellung.bezeichnung,
          mitgliedId:     zuweisung.mitgliedId,
          mitgliedName:   resolveMitgliedName(mitglieder, zuweisung.mitgliedId),
          artikelName:    position.name,
          variante:       position.variante || '',
          menge:          zuweisung.menge,
          einzelpreis:    position.einzelpreis || 0,
          brutto:         runde((position.einzelpreis || 0) * zuweisung.menge),
          kostenmodus,
          kostenmodusLabel: kostenmodusLabel(kostenmodus),
          bv:             foerderung.bv,
          lv:             foerderung.lv,
          og:             foerderung.og,
          ogMitStunden:   istOgMitStunden(kostenmodus) ? foerderung.og : 0,
          ogOhneGegenleistung: istOgOhneGegenleistung(kostenmodus) ? foerderung.og : 0,
          anteil:         foerderung.mitglied,
          bezahlt:        rechnung?.bezahlt ?? false,
          rechnungNummer: rechnung?.nummer ?? '',
        });
      }
    }
  }

  return zeilen;
}

export function berechneSondermengenZeilen(bestellungen) {
  const zeilen = [];

  for (const bestellung of (bestellungen || [])) {
    if (bestellung.status !== 'abgeschlossen') continue;
    const jahr = (bestellung.datum || '').slice(0, 4);

    for (const position of (bestellung.positionen || [])) {
      if (position.typ !== 'artikel') continue;

      if ((position.retoureMenge || 0) > 0) {
        zeilen.push({
          typ: 'retoure',
          jahr,
          bestellungId: bestellung.id,
          bestellungBez: bestellung.bezeichnung,
          artikelName: position.name,
          variante: position.variante || '',
          menge: position.retoureMenge,
          einzelpreis: position.einzelpreis || 0,
          brutto: runde((position.einzelpreis || 0) * position.retoureMenge),
        });
      }

      if ((position.ogBestandMenge || 0) > 0) {
        zeilen.push({
          typ: 'og-bestand',
          jahr,
          bestellungId: bestellung.id,
          bestellungBez: bestellung.bezeichnung,
          artikelName: position.name,
          variante: position.variante || '',
          menge: position.ogBestandMenge,
          einzelpreis: position.einzelpreis || 0,
          brutto: runde((position.einzelpreis || 0) * position.ogBestandMenge),
        });
      }
    }
  }

  return zeilen;
}

function waehleFoerderQuelle(position, artikel) {
  if (hatGespeicherteFoerderung(position) || !artikel) {
    return {
      einzelpreis:      position.einzelpreis || 0,
      bvFoerderung:     position.bvFoerderung || 0,
      lvFoerderung:     position.lvFoerderung || 0,
      ogFoerderung:     position.ogFoerderung || 0,
      ogUebernimmtRest: !!position.ogUebernimmtRest,
    };
  }

  return artikel;
}

function hatGespeicherteFoerderung(position) {
  return (
    position?.foerderungGespeichert === true ||
    position?.ogUebernimmtRest !== undefined ||
    (position?.ogFoerderung || 0) !== 0 ||
    (position?.bvFoerderung || 0) !== 0 ||
    (position?.lvFoerderung || 0) !== 0
  );
}
