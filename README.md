# elektormagazine-dl

*[Nederlands](README.nl.md)*

Download your Elektor Magazine issues as PDF so you can read them offline — on your e-reader, tablet, or on a plane.

Requires an active Elektor membership (GREEN or GOLD) with access to the magazine archive.

## How does it work?

Elektor offers members direct PDF downloads per issue. This tool uses Puppeteer to:

1. Log in to your Elektor account
2. Browse the magazine archive year by year
3. Find the PDF download link for each issue
4. Download the PDF directly

The archive consists of two separate sites, each with their own editions:

| Site | Language | Archive | Issues |
|---|---|---|---|
| [elektormagazine.com](https://www.elektormagazine.com/magazine-archive) | English | 1974-present | ~540 |
| [elektormagazine.nl](https://www.elektormagazine.nl/magazine-archive) | Dutch | 1961-present | ~660 |

PDFs are saved per language and year:

```
output/
  en/                          <- English editions
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
  nl/                          <- Dutch editions
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

Issue numbers correspond to Elektor's own numbering system. Recent editions are bimonthly (01, 03, 05, 07, 09, 11), older editions are monthly (01-12). Some bonus or special editions have a different number.

A full download is approximately 27 GB (~11 GB English, ~16 GB Dutch).

## Requirements

- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org/)
- **A Chromium-based browser** (one of the following):
  - Google Chrome
  - Microsoft Edge
  - Brave
  - Chromium

### Finding your browser path

You need the full path to your browser:

| OS | Browser | Path |
|---|---|---|
| Windows | Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Windows | Edge | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| macOS | Chrome | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| macOS | Edge | `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` |
| Linux | Chrome | `/usr/bin/google-chrome` |
| Linux | Chromium | `/usr/bin/chromium-browser` |

## Installation

1. Clone the repository and install dependencies:
   ```
   git clone https://github.com/GraafG/elektormagazine-dl.git
   cd elektormagazine-dl
   npm install
   ```

2. Copy the example configuration file:
   ```
   cp .env.example .env
   ```

3. Fill in your Elektor email, password and browser path in `.env`.

## Usage

Download all editions (English + Dutch):

```
npm run download
```

Download only the latest issue:

```
npm run download -- --latest
```

Download only the English editions:

```
npm run download -- --en
```

Download only the Dutch editions:

```
npm run download -- --nl
```

Combinations are also possible:

```
npm run download -- --latest --nl
```

The tool will:
- Open a browser window and automatically log in to both sites
- Browse the full archive (~1200 issues), or only the latest with `--latest`
- Save PDFs in the `./output` folder, sorted by language (`en`/`nl`) and year
- Skip previously downloaded editions (safe to restart)
- Automatically re-login if the session expires

A full download of both archives takes approximately 60-70 minutes. Run the script again to fetch new editions — existing files are skipped.

## Configuration

All settings are in the `.env` file:

| Variable | Description | Default |
|---|---|---|
| `ELEKTOR_EMAIL` | Your Elektor email address | (required) |
| `ELEKTOR_PASSWORD` | Your Elektor password | (required) |
| `BROWSER_PATH` | Full path to a Chromium browser | (required) |
| `OUTPUT_DIR` | Folder for downloaded PDFs | `./output` |

## English vs. Dutch

Elektor publishes two separate editions:

- **English** (`en/`) — International, available via [elektormagazine.com](https://www.elektormagazine.com). Archive back to 1974.
- **Dutch** (`nl/`) — Dutch edition, available via [elektormagazine.nl](https://www.elektormagazine.nl). Archive back to 1961.

The editions are **not identical** — they contain partially different articles. With an Elektor GREEN or GOLD membership you have access to both archives. By default the tool downloads both; use `--en` or `--nl` to download only one.

## Troubleshooting

- **Login failed** — Check your email and password in `.env`. Test whether you can log in at [elektormagazine.com](https://www.elektormagazine.com/account/login).
- **"Missing BROWSER_PATH"** — Fill in the full path to your browser. See the table above.
- **No download link found** — Not all editions in the archive have a PDF. Very old editions or special issues may not be available for download.
- **Browser window doesn't appear** — The script runs in visible mode. Make sure no other automation is using the same browser profile.
- **Download stops halfway** — Run the script again. Already downloaded PDFs are skipped.

## Offline reading

The downloaded PDFs can be transferred to your e-reader (e.g. Kobo, Kindle, reMarkable) or tablet for offline use — handy on a plane, on holiday, or just on the couch.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Report bugs or suggest features via [GitHub Issues](../../issues).

Security issues? See [SECURITY.md](SECURITY.md).

## Disclaimer

This tool is intended for personal use by paying Elektor members to read their own editions offline. Do not share downloaded files — respect Elektor's copyright.

## License

MIT
