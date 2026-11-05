# Vesting Europa

Een grand-strategyspel in de browser over Europa en de wereld in 1936. Kies een land, bouw je industrie, leid je leger (of laat de generaal het doen) en herschrijf de geschiedenis.

## Spelen

Het spel is één statische pagina zonder buildstap. Omdat de kaartdata met `fetch()` wordt geladen, moet je het via een webserver openen (niet via `file://`):

```bash
python3 -m http.server 8000
```

Open daarna http://localhost:8000.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | Het volledige spel (HTML, CSS en JavaScript) |
| `europe.json` / `europe-hd.json` | Kaartdata Europa (standaard / hoge resolutie) |
| `world.json` / `world-hd.json` | Kaartdata wereld (standaard / hoge resolutie) |

Voortgang en instellingen worden lokaal in de browser opgeslagen (`localStorage`).

## Tests

De tests starten zelf een kleine webserver en spelen het spel in een headless browser. Je hebt Node.js 20 of nieuwer nodig, plus Playwright met Chromium. Het spel zelf heeft geen packages nodig.

```bash
npm install --no-save playwright@1.63.0 && npx playwright install chromium
```

```bash
node --test tests/*.test.js
```
