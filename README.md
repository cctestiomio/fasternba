# NBA Score Feed Race

Dashboard to compare whether the NBA CDN or ESPN scoreboard API updates NBA scores faster.

## Endpoints compared

- NBA CDN: `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`
- ESPN: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`

## Why this version fixes the Vercel build

This version has **zero npm dependencies** and no `package-lock.json`, so Vercel does not need to resolve React/Vite/latest packages. The dashboard is plain HTML/CSS/JS plus Vercel serverless API routes.

## Local run

```bash
npm install
npm run dev
```

## Deploy to Vercel

Push this folder to GitHub and import it in Vercel. The app refreshes every 3 seconds by default.

## Change polling speed

Open with a query string:

```text
?pollMs=1000
?pollMs=5000
```

Default is `3000` milliseconds.
