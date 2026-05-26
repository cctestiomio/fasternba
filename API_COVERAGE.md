# API coverage added in this patched ZIP

## Default no-key / public probes

- ESPN public site/web scoreboards for NBA, WNBA, NCAAB/CBB, NFL, MLB, NHL, MLS, EPL, UEFA competitions, FIFA/international, tennis, golf, volleyball, rugby, AHL/Brazil Serie B/Peru Liga 1 probes where endpoints exist.
- ESPN per-game `summary?event=` derived probes for leagues where a base ESPN scoreboard returns event IDs.
- Official NBA CDN live score, boxscore, and play-by-play JSON endpoints.
- Official MLB Stats API schedule, linescore, and live-feed endpoints.
- Official NHL web score/scoreboard/gamecenter endpoints.
- TheSportsDB free/public JSON probes for major leagues and recent/next-event lookups.
- Chess.com public puzzle/current probe and Lichess public TV feed liveness probe.

## Optional free-key / freemium probes

These do not hardcode secrets. They only run when environment variables are present.

- `BALLDONTLIE_API_KEY` / `BDL_API_KEY`: balldontlie sports endpoints.
- `GRID_API_KEY` / `GRIDGG_API_KEY`: GRID.gg CS2/Dota2 series-state endpoint note/probe.
- `GRID_ACCESS_LEVEL=open|full`: selects `api-op.grid.gg` or `api.grid.gg`.
- `THESPORTSDB_API_KEY`: overrides TheSportsDB public test key.

## Market-safety notes

This dashboard finds and compares API feeds. It does not magically verify every Polymarket market type. Futures, awards, player props, drafts, season table positions, exact-score markets, and some esports tags often have no durable no-key live-score API. Those are labeled as unavailable/optional instead of being treated as verified.
