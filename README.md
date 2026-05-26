# Sports API Speed Race — expanded market-tag build

A Vercel/GitHub-ready dashboard that polls free/public score endpoints and shows which endpoint displays score changes first.

This patched build adds coverage for the requested `SPORTS_TAGS` family:

- NBA, WNBA, NCAAB/CBB, NFL, MLB, NHL, AHL
- MLS, EPL, UEFA, FIFA/international, Brazil Série B (`bra2`), Peru Liga 1 (`per1`), soccer bundle
- ATP/WTA tennis, golf, volleyball, rugby, chess
- Esports tags: VALORANT, CS2/CSGO, Dota2, League of Legends, Overwatch, Rocket League, Call of Duty, Rainbow Six, StarCraft, Hearthstone

## API strategy

Default no-key/public probes:

- ESPN public site/web scoreboards and per-game summary endpoints
- Official NBA CDN live-data endpoints
- Official MLB Stats API schedule, linescore, and live-feed endpoints
- Official NHL web API score/scoreboard/gamecenter endpoints
- TheSportsDB public JSON API using the public test key `3`
- Chess.com public API and Lichess public TV feed probe

Optional probes activated by environment variables:

- `BALLDONTLIE_API_KEY` or `BDL_API_KEY` for balldontlie NBA/NFL/MLB/NHL/PGA-style endpoints
- `GRID_API_KEY` or `GRIDGG_API_KEY` for GRID.gg CS2/Dota2 series-state verification notes
- `GRID_ACCESS_LEVEL=open` or `GRID_ACCESS_LEVEL=full` to choose the GRID endpoint family
- `THESPORTSDB_API_KEY` if you have your own TheSportsDB key instead of the public test key

## Important limitations

Some market tags are not true live-score markets. Futures, awards, exact table-position markets, player props, draft markets, and many esports markets may not have a durable no-key live-score API. This app keeps those probes fail-transparent: it labels missing optional keys or unavailable no-key sources instead of pretending it verified a winner.

The app measures **when your deployed Vercel function sees a score update**, not the provider's internal publish timestamp. Timing depends on Vercel region, provider caching, endpoint blocking, and your polling interval.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Upload this folder to GitHub.
2. Import the repo in Vercel.
3. Build command: `node build.js`
4. Output directory: `dist`

No API keys are required for the default probes.
