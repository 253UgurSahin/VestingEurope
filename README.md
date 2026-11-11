# Vesting Europa

Een grand-strategyspel in de browser over Europa en de wereld in 1936. Kies een land, bouw je industrie, leid je leger (of laat de generaal het doen), sluit bondgenootschappen en herschrijf de geschiedenis.

## Spelen

Het spel is één statische pagina zonder buildstap. Omdat de kaartdata met `fetch()` wordt geladen, moet je het via een webserver openen (niet via `file://`):

```bash
python3 -m http.server 8000
```

Open daarna http://localhost:8000.

## Wat zit erin

- **Twee kaarten**: Europa (285 provincies, 38 landen) en de wereld (1576 provincies, 175 landen). Elk land heeft een kleur die duidelijk verschilt van zijn buren; rivieren, steden, terrein en **oversteekplaatsen** (zeeroutes met ankers en veertekens) staan op de kaart.
- **Kaartmodi** (toetsen 5–9): politiek, terrein, aanvoer, diplomatie, industrie. Minimap rechtsonder.
- **Leger**: divisies uit bataljons (eigen ontwerpen), frontbreedte, aanvoer, ingraven, bunkers, luchtmacht met missiezones, parachutisten en mariniers.
- **Generaal** (auto-generaal): voert het leger voor je. Hij trekt troepen samen voor een aanval, bewaakt de hoofdstad, breekt uit een omsingeling, belegert vestingen, stuurt niet meer troepen dan de vijand waard is en vecht ook vanuit het land van bondgenoten. Met *Positie* houd je divisies buiten zijn bereik.
- **Diplomatie**: relaties, niet-aanvalsverdrag, doorgangsrecht, bondgenootschap (meevechten, te wapen roepen), lend-lease, fabrieken schenken, divisies uitlenen of schenken.
- **Oorlog en vrede**: oorlogsdoelen, agressie en coalities, oorlogssteun, overgave, vredesconferentie en onderhandelde vrede. Elke vrede toont vooraf wat jij krijgt en wat de ander houdt, ook op de kaart. Sancties: industrie ontmantelen, herstelbetalingen, ontwapening, gedemilitariseerde grens, niet-aanvalsgarantie, bevriend bewind, vazalstaat.
- **Kernwapen**: atoomproject (vanaf 12 fabrieken), kernbom en kernaanval per bommenwerper, met besmetting en een wereldwijde schrikreactie. Grote AI-landen kunnen het laat in het spel ook, met waarschuwing vooraf.
- **Kleine landen**: een bonus die slinkt naarmate je groeit (productie, legerlimiet, reservisten, verdediging op eigen grond, snellere integratie), plus een kansinschatting per land in het keuzescherm.
- **Interface**: topbalk met je grondstoffen en de tijdbediening, panelen voor productie, acties, diplomatie en overzicht, logboek van alle gebeurtenissen, legerpaneel, hoofdmenu met records en de uitdaging van vandaag.

## Sneltoetsen

| Toets | Wat |
|---|---|
| Spatie | Pauze / doorgaan |
| 1–4, + / − | Snelheid |
| P / A / D / O / L | Productie, Acties, Diplomatie, Overzicht, Logboek |
| 5–9 | Kaartmodus |
| Tab | Volgend gevecht of frontstuk |
| Home | Naar je eigen land |
| Shift+1…9 / Alt+1…9 | Legergroep opslaan / selecteren |
| H / F / G | Selectie: halt, naar het front, terug naar de generaal |
| Esc | Annuleren, sluiten, deselecteren |
| ? | Alle sneltoetsen |

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | Het volledige spel (HTML, CSS en JavaScript) |
| `europe.json` / `europe-hd.json` | Kaartdata Europa (standaard / hoge resolutie) |
| `world.json` / `world-hd.json` | Kaartdata wereld (standaard / hoge resolutie) |

Voortgang en instellingen worden lokaal in de browser opgeslagen (`localStorage`).
