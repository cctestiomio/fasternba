# Sports API Speed Race

A Vercel/GitHub-ready dashboard that polls free/public no-key score endpoints every **3 seconds** and shows which endpoint displays score changes first.

Sports included:

- NBA
- MLB
- NFL
- NHL

Each sport has about five feed probes. Some are official league endpoints, some are ESPN public/undocumented endpoints, and some are derived per-game endpoints that need a base scoreboard to discover today’s game IDs.

## Important

This app measures **when your deployed Vercel function sees a score update**, not the true internal provider publish timestamp. That is what matters for automation/alerting, but it depends on Vercel region, provider caching, endpoint blocking, and your 3-second polling interval.

NFL has fewer truly public no-key live score sources than NBA/MLB/NHL, so the NFL section uses several ESPN public endpoint variants and clearly labels them.

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

No API keys are required.

## Change refresh interval

The UI defaults to 3000 ms and lets you change it in the input box. The minimum is locked to 3000 ms to avoid hammering free endpoints too hard.
