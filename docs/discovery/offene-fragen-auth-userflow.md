# Offene Fragen: Auth, Rollen, Wunschqueue & Mitglieder-Frontend

Diese Punkte sind bereits fachlich angerissen, aber noch nicht vollständig festgezogen.
Sie sind nicht alle blocker für Sprint 07, sollten aber vor der jeweiligen Umsetzung
bewusst entschieden werden.

## Auth & Session

- Soll es für `admin` und `finanzen` eine kürzere Session-Lebensdauer geben als für `materialwart`?
- Soll das bestehende 30-Minuten-Timeout für alle Funktionskonten gleich bleiben?

## Funktionslogin

- Soll die zuletzt gewählte handelnde Person pro Funktionskonto kurzzeitig vorausgewählt werden?

## Zugriffsoverlay

- Exaktes JSON-Schema von `zugriff.json`
- Braucht es neben `gesperrt` noch zusätzliche User-Flags wie
  `darfFoerderungNutzen` oder `nurLesen`?

## Wunschqueue

- Exaktes JSON-Schema von `wuensche.json`
- Wie werden Teilübernahmen intern verknüpft:
  - nur pro Wunschposition
  - oder zusätzlich direkt mit offizieller Bestellposition?
- Sollen Mitglieder pro Wunsch eine freie Notiz mitsenden können?
- Sollen Admin-Änderungsgründe für Mitglieder immer sichtbar sein oder nur optional?

## Mitglieder-Dashboard

- Sollen `Rechnungen` und `Lagerausgaben` in einem gemeinsamen Block bleiben
  oder später getrennt werden?
- Welche Statusbezeichnungen sind für Mitglieder am verständlichsten:
  eher technisch (`uebernommen`) oder eher alltagssprachlich (`In Vereinsbestellung übernommen`)?

## Materialwart-Flow

- Wie genau sieht der Freigabefall bei Förderwunsch aus:
  eigener Datensatz
  oder Statuswechsel an einer Lagerausgabe?
- Soll der Materialwart einen Kommentar für Admin/Finanzen mitsenden müssen?

## Audit & Governance

- Soll die Audit-Ansicht später nur für `admin` sichtbar sein oder auch für `finanzen`?
- Welche Audit-Felder sollen im UI filterbar sein:
  Rolle, handelnde Person, Mitglied, Bestellung, Zeitraum?
