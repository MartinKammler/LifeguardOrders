# Sprint 01: Fundament & Artikelkatalog ✅ ABGESCHLOSSEN

## Sprint Goal

Admin kann die App öffnen, Nextcloud-Zugangsdaten hinterlegen, die Mitgliederliste importieren,
den Artikelkatalog aufbauen (manuell, per Auftragsbestätigung und per Produktseite mit Größen)
und hat damit die vollständige Grundlage für alle folgenden Sprints.

---

## Ergebnis

| Modul/Seite | Status | Tests |
|---|---|---|
| `src/webdav.js` | ✅ | 19/19 |
| `src/parser.js` | ✅ | 39/39 |
| `src/berechnung.js` | ✅ | 22/22 |
| `src/mitglieder.js` | ✅ | 8/8 |
| `einstellungen.html` | ✅ | manuell |
| `artikel.html` | ✅ | manuell |
| `index.html` | ✅ | manuell |

## Nachträgliche Erweiterungen (über ursprünglichen Scope hinaus)

- Parser: 3 Formate (Tab, mehrzeilig, Produktseite) statt 1
- Produktseite: alle Varianten/Größen automatisch erkennen (strukturell, nicht regex-basiert)
- LV-Förderung aus Produktseite parsen
- `variante`-Feld in Artikelkatalog eingeführt
- Deduplizierung nach `artikelNr + variante`
