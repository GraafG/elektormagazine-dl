# elektormagazine-dl

*[English](README.md)*

Download je Elektor Magazine edities als PDF zodat je ze offline kunt lezen — op je e-reader, tablet, of in het vliegtuig.

Vereist een actief Elektor lidmaatschap (GREEN of GOLD) met toegang tot het magazine archief.

## Hoe werkt het?

Elektor biedt leden directe PDF-downloads aan per editie. Deze tool gebruikt Puppeteer om:

1. In te loggen op je Elektor account
2. Het magazine archief te doorlopen per jaar
3. Voor elke editie de PDF download link te vinden
4. De PDF direct te downloaden

Het archief bestaat uit twee aparte sites met elk hun eigen edities:

| Site | Taal | Archief | Edities |
|---|---|---|---|
| [elektormagazine.com](https://www.elektormagazine.com/magazine-archive) | Engels | 1974-heden | ~540 |
| [elektormagazine.nl](https://www.elektormagazine.nl/magazine-archive) | Nederlands | 1961-heden | ~660 |

De PDFs worden opgeslagen per taal en jaar:

```
output/
  en/                          <- Engelse edities
    2026/
      Elektor 01.pdf
      Elektor 03.pdf
    2025/
      Elektor 01.pdf
      Elektor 03.pdf
      ...
      Elektor 12.pdf
    ...
    1974/
      Elektor 12.pdf
  nl/                          <- Nederlandse edities
    2026/
      Elektor 01.pdf
      Elektor 03.pdf
    2025/
      Elektor 01.pdf
      ...
    ...
    1961/
      Elektor 04.pdf
```

De editienummers komen overeen met Elektors eigen nummeringssysteem. Recente edities zijn tweemaandelijks (01, 03, 05, 07, 09, 11), oudere edities zijn maandelijks (01-12). Sommige bonus- of speciale edities hebben een afwijkend nummer.

Een volledige download is ongeveer 27 GB (~11 GB Engels, ~16 GB Nederlands).

## Vereisten

- **Node.js** v18 of hoger — [nodejs.org](https://nodejs.org/)
- **Een Chromium-gebaseerde browser** (een van de volgende):
  - Google Chrome
  - Microsoft Edge
  - Brave
  - Chromium

### Browserpad vinden

Je hebt het volledige pad naar je browser nodig:

| OS | Browser | Pad |
|---|---|---|
| Windows | Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Windows | Edge | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| macOS | Chrome | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| macOS | Edge | `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` |
| Linux | Chrome | `/usr/bin/google-chrome` |
| Linux | Chromium | `/usr/bin/chromium-browser` |

## Installatie

1. Clone de repository en installeer dependencies:
   ```
   git clone https://github.com/GraafG/elektormagazine-dl.git
   cd elektormagazine-dl
   npm install
   ```

2. Kopieer het voorbeeld-configuratiebestand:
   ```
   cp .env.example .env
   ```

3. Vul je Elektor e-mail, wachtwoord en browserpad in in `.env`.

## Gebruik

Download alle edities (Engels + Nederlands):

```
npm run download
```

Download alleen de nieuwste editie:

```
npm run download -- --latest
```

Download alleen de Engelse edities:

```
npm run download -- --en
```

Download alleen de Nederlandse edities:

```
npm run download -- --nl
```

Combinaties zijn ook mogelijk:

```
npm run download -- --latest --nl
```

De tool zal:
- Een browservenster openen en automatisch inloggen op beide sites
- Het volledige archief doorlopen (~1200 edities), of alleen de nieuwste met `--latest`
- PDFs opslaan in de `./output` map, gesorteerd per taal (`en`/`nl`) en jaar
- Eerder gedownloade edities overslaan (herstart veilig mogelijk)
- Automatisch opnieuw inloggen als de sessie verloopt

Een volledige download van beide archieven duurt ongeveer 60-70 minuten. Voer het script opnieuw uit om nieuwe edities op te halen — bestaande bestanden worden overgeslagen.

## Configuratie

Alle instellingen staan in het `.env` bestand:

| Variabele | Omschrijving | Standaard |
|---|---|---|
| `ELEKTOR_EMAIL` | Je Elektor e-mailadres | (verplicht) |
| `ELEKTOR_PASSWORD` | Je Elektor wachtwoord | (verplicht) |
| `BROWSER_PATH` | Volledig pad naar een Chromium browser | (verplicht) |
| `OUTPUT_DIR` | Map voor gedownloade PDFs | `./output` |

## Engels vs. Nederlands

Elektor publiceert twee aparte edities:

- **Engels** (`en/`) — Internationaal, beschikbaar via [elektormagazine.com](https://www.elektormagazine.com). Archief terug tot 1974.
- **Nederlands** (`nl/`) — Nederlandse editie, beschikbaar via [elektormagazine.nl](https://www.elektormagazine.nl). Archief terug tot 1961.

De edities zijn **niet identiek** — ze bevatten deels andere artikelen. Met een Elektor GREEN of GOLD lidmaatschap heb je toegang tot beide archieven. Standaard downloadt de tool beide; gebruik `--en` of `--nl` om slechts een van de twee te downloaden.

## Problemen oplossen

- **Inloggen mislukt** — Controleer je e-mail en wachtwoord in `.env`. Test of je kunt inloggen op [elektormagazine.com](https://www.elektormagazine.com/account/login).
- **"Missing BROWSER_PATH"** — Vul het volledige pad naar je browser in. Zie de tabel hierboven.
- **Geen download link gevonden** — Niet alle edities in het archief hebben een PDF. Zeer oude edities of speciale uitgaven zijn mogelijk niet beschikbaar als download.
- **Browservenster verschijnt niet** — Het script draait in zichtbare modus. Zorg dat geen andere automatisering hetzelfde browserprofiel gebruikt.
- **Download stopt halverwege** — Voer het script opnieuw uit. Reeds gedownloade PDFs worden overgeslagen.

## Offline lezen

De gedownloade PDFs kun je overzetten naar je e-reader (bijv. Kobo, Kindle, reMarkable) of tablet voor offline gebruik — handig voor in het vliegtuig, op vakantie, of gewoon op de bank.

## Bijdragen

Bijdragen zijn welkom! Zie [CONTRIBUTING.md](CONTRIBUTING.md) voor richtlijnen.

Bugs melden of features voorstellen kan via [GitHub Issues](../../issues).

Beveiligingsproblemen? Zie [SECURITY.md](SECURITY.md).

## Disclaimer

Deze tool is bedoeld voor persoonlijk gebruik door betalende Elektor leden om hun eigen edities offline te lezen. Deel geen gedownloade bestanden — respecteer het auteursrecht van Elektor.

## Licentie

MIT
