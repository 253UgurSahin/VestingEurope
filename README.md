# Vesting Europa

Een grand-strategyspel in de browser over Europa en de wereld in 1936. Kies een land, bouw je industrie, leid je leger (of laat de generaal het doen) en herschrijf de geschiedenis.

## Spelen

Het spel is een statische pagina zonder buildstap: gewone HTML, CSS en JavaScript-bestanden. Omdat de kaartdata met `fetch()` wordt geladen, moet je het via een webserver openen (niet via `file://`):

```bash
python3 -m http.server 8000
```

Open daarna http://localhost:8000.

## Toetsenbord

| Toets | Wat het doet |
|---|---|
| Tab | Naar de kaart en langs de knoppen |
| Pijltjes (op de kaart) | Naar de buurprovincie in die richting; de provincie wordt voorgelezen |
| Enter (op de kaart) | Zoals klikken: land kiezen, eigen divisies selecteren of een bevel geven |
| + en − | In- en uitzoomen rond de gekozen provincie |
| Spatie | Pauze / doorgaan (op een knop: de knop indrukken) |
| 1 tot 4 | Snelheid |
| M | Geluid aan of uit |
| Escape | Selectie of paneel sluiten |

## Eigen spel

Na het kiezen van een land staan op het startscherm twee knoppen naast het niveau: **Jouw voordeel** (geen, standaard, groot) en **AI** (zwakker, standaard, sterker). Ze passen de waarden van het gekozen niveau aan: geen voordeel zet productie, legerlimiet en gevechtskracht van jouw land op 1; groot voegt er 0,3, 0,3 en 0,2 aan toe; de AI krijgt 20% minder of 25% meer productie. Een spel met groot voordeel of een zwakkere AI telt niet mee voor beste scores en onderscheidingen voor een niveau. De uitdaging van de dag blijft voor iedereen gelijk en gebruikt de opties niet.

## Een spel als bestand bewaren

In het Overzicht staat **Bewaar als bestand**: dat downloadt je spel als een `.json`-bestand. Op het startscherm laadt **Spel laden uit bestand** zo'n bestand weer, ook op een ander apparaat of nadat de browser zijn gegevens heeft gewist. Bestanden groter dan 5 MB en bestanden van een andere versie worden geweigerd met een melding. Downloads werken niet binnen een pagina op claude.ai (daar zijn ze geblokkeerd), wel op een eigen webserver of lokaal.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | De pagina: laadt de stijl en de scripts |
| `style.css` | Alle opmaak |
| `js/kaart.js` | Kaartdata laden (gewoon en scherp) |
| `js/regels.js` | Spelregels, spelstand, tijd, economie, luchtmacht en gevechten |
| `js/oorlog.js` | Oorlogsverloop, vrede, politiek, doelen, score en onderscheidingen |
| `js/ai.js` | De computerlanden, zeeroutes en speciale acties |
| `js/tekenen.js` | De kaart tekenen, camera, muis/aanraking en symbolen |
| `js/interface.js` | Geluid, meldingen, de balk, de wachtrij en de panelen |
| `js/start.js` | Laden, opslaan, de hoofdlus en het opstarten |
| `fonts/` | De lettertypes Barlow en Barlow Condensed (SIL Open Font License) |
| `europe.json` / `europe-hd.json` | Kaartdata Europa (standaard / hoge resolutie) |
| `world.json` / `world-hd.json` | Kaartdata wereld (standaard / hoge resolutie) |

De scripts worden in deze volgorde geladen en delen één scope: een script mag bij het laden alleen iets gebruiken uit zichzelf of uit een eerder script.

Voortgang en instellingen worden lokaal in de browser opgeslagen (`localStorage`).

## Tests

De tests starten zelf een kleine webserver en spelen het spel in een headless browser. Je hebt Node.js 20 of nieuwer nodig, plus Playwright met Chromium. Het spel zelf heeft geen packages nodig.

```bash
npm install --no-save playwright@1.63.0 && npx playwright install chromium
```

```bash
node --test tests/*.test.js
```
