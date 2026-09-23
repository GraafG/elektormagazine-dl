# Bijdragen aan elektormagazine-dl

Bedankt voor je interesse om bij te dragen!

## Hoe bij te dragen

1. Fork de repository
2. Maak een feature branch (`git checkout -b feature/mijn-verbetering`)
3. Commit je wijzigingen (`git commit -m 'Voeg X toe'`)
4. Push naar je branch (`git push origin feature/mijn-verbetering`)
5. Open een Pull Request

## Richtlijnen

- **Geen credentials** — Commit nooit wachtwoorden, tokens, of `.env` bestanden
- **Test je wijzigingen** — Draai `npm test` voordat je een PR opent. De offline tests vereisen geen account of browser.
- **Houd het simpel** — Dit is een klein project, houd wijzigingen overzichtelijk
- **Nederlands of Engels** — Beide talen zijn prima voor issues, PRs en comments

## Ideeën voor bijdragen

- Headless modus (zonder zichtbaar browservenster)
- Automatisch nieuwe edities ophalen (bijv. via cron/scheduled task)
- Betere foutafhandeling bij trage verbindingen
- Ondersteuning voor het downloaden van losse artikelen

## Ontwikkelen

Gebruik Node.js 22.12.0 of hoger. `npm test` controleert de echte Puppeteer-module
en voert het script uit met een gesimuleerde browser en synthetische downloads.
Dit test geen echte browser, website of accountlogin.

```bash
# Installeer dependencies
npm install

# Draai de offline tests (geen .env nodig)
npm test

# Kopieer en vul je configuratie in
cp .env.example .env

# Draai het script
npm run download
```
