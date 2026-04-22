# Review Findings: Anprobe-Teilabschluss

Stand: 2026-04-22

## 1. Kostenmodus-Änderung invalidiert bestehende Rechnung aktuell nicht

Priorität: hoch

Problem:
- Eine Änderung des `kostenmodus` ändert den Rechnungsbetrag.
- Der Teilabschluss und eine bereits erzeugte Rechnung werden dabei aktuell nicht zurückgesetzt.

Technischer Hinweis:
- Der Kostenmodus ist in der Änderungs-Signatur bzw. Invalidierung noch nicht durchgängig berücksichtigt.
- Dadurch bleibt ein Besteller trotz geänderter Kostenlogik auf `abgeschlossen`, und eine vorhandene Rechnung bleibt bestehen.

Risiko:
- Rechnung kann fachlich falsch sein, obwohl UI weiter `abgeschlossen` zeigt.

## 2. Teilabschluss pro Besteller ist noch nicht vollständig isoliert

Priorität: mittel

Problem:
- Der Teilabschluss prüft zwar nur Positionen, in denen ein Besteller vorkommt.
- Die Validierung läuft aber auf der ganzen Position und summiert alle Zuweisungen.
- Fehler anderer Besteller auf derselben Position können damit den Teilabschluss blockieren.

Risiko:
- Ein Besteller kann nicht abgeschlossen werden, obwohl seine eigene Teilmenge fachlich korrekt ist.

## 3. Letzte Kacheländerung kann bei Reload verloren gehen

Priorität: mittel

Problem:
- Autosave läuft nur auf `change`.
- Wenn ein Feld noch Fokus hat und direkt neu geladen oder verlassen wird, kann die letzte Eingabe verloren gehen.
- Die `beforeunload`-Warnung greift aktuell nur, wenn bereits ein Save läuft.

Risiko:
- Nutzer glaubt, eine letzte Änderung sei gespeichert, obwohl sie nie im WebDAV ankam.

## Empfohlene Reihenfolge

1. Kostenmodus-Änderung sauber in Teilabschluss-/Rechnungs-Invalidierung einbeziehen
2. Teilvalidierung pro Besteller wirklich bestellerisoliert machen
3. Autosave für Anprobe-Kacheln gegen Reload/Fokusverlust robuster machen
