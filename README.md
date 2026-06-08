# Sportleistung

Lokale React-Anwendung zur Erfassung und Auswertung von Sportleistungen. Profile,
Sportarten und Durchgänge werden ausschließlich im Browser in IndexedDB
gespeichert.

## Entwicklung

```bash
npm ci
npm run dev
```

Vor einer Veröffentlichung sollten alle Prüfungen erfolgreich laufen:

```bash
npm test
npm run lint
npm run build
```

## GitHub Pages

Die Anwendung wird über `.github/workflows/deploy-pages.yml` bei jedem Push auf
`main` geprüft, gebaut und unter folgender Adresse veröffentlicht:

```text
https://acksberg.github.io/Sport/
```

Die SPA verwendet Hash-Routen, damit auch direkte Aufrufe einzelner Ansichten
auf GitHub Pages funktionieren.

### Einmalige Einrichtung

1. Auf GitHub ein leeres öffentliches Repository `AcksBerg/Sport` anlegen.
   Dabei keine README, `.gitignore` oder Lizenzdatei erzeugen lassen.
2. Den aktuellen Projektstand committen und auf `main` pushen.
3. Im Repository unter `Settings > Pages` als Quelle `GitHub Actions`
   auswählen.
4. Den Workflow `Deploy GitHub Pages` abwarten.

Der lokale Git-Remote zeigt bereits auf:

```text
https://github.com/AcksBerg/Sport.git
```

## Standardsportarten pflegen

GitHub Pages stellt ausschließlich statische Dateien bereit. Änderungen am
Standardkatalog werden deshalb versioniert veröffentlicht:

1. Sportdatei unter `public/sports` ergänzen oder ändern.
2. `public/sports/manifest.json` anpassen und bei Änderungen die Version der
   betroffenen Datei erhöhen.
3. Änderungen committen und auf `main` pushen.

Der GitHub-Actions-Workflow validiert den Katalog und veröffentlicht ihn
anschließend gemeinsam mit der Anwendung.
