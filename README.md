# NBA Score Speed Checker

A Vercel-ready React dashboard that compares which public score feed updates first:

- NBA CDN: `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`
- ESPN API: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`

It polls both feeds every **3 seconds**, sorts live/current games first, and timestamps when each source first shows a score change.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL Vercel prints, usually `http://localhost:3000`.

## Deploy to Vercel

1. Upload/push this folder to GitHub.
2. In Vercel, import the GitHub repo.
3. Use the defaults:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy.

## Change refresh speed

Default refresh is `3000` ms. To change it, set a Vercel environment variable:

```bash
VITE_POLL_MS=3000
```

## How the speed comparison works

The frontend calls two separate Vercel API routes:

- `/api/nba`
- `/api/espn`

Each route proxies one upstream feed with no-cache headers. The browser records the local receipt time of each successful response. When a game score changes compared with the previous poll, that source gets a `last score change` timestamp. The dashboard then labels NBA or ESPN as faster for that game.

Because polling is every 3 seconds, changes that happen inside the same polling window may show as `Tie / same poll`.
