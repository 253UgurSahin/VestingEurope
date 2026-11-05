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
