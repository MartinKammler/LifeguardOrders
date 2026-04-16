# dlrg_bestellsystem

Vanilla-JS-Bestellsystem fuer DLRG-Sammelbestellungen mit Nextcloud/WebDAV, Rechnungen,
Kassenwart-Uebersicht und Einsatzstunden-Dashboard.

## Sync-Verhalten

Schreiboperationen sind lokal-first. Bei einem Nextcloud-Fehler bleiben die Daten lokal erhalten,
der Sync-Status wird als `pending` gespeichert und beim naechsten passenden Schreibzugriff erneut
versucht. Die Startseite zeigt ausstehende Synchronisationen an.

## Tests

```powershell
run-tests.bat
node tests\run-html-tests.mjs
node tests\review-regression.mjs
```
