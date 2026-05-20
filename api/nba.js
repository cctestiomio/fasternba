const NBA_URL = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeGame(game) {
  const home = game.homeTeam || {};
  const away = game.awayTeam || {};
  const statusId = Number(game.gameStatus || 0);
  const isLive = statusId === 2;
  const isFinal = statusId === 3;

  return {
    source: 'nba',
    id: String(game.gameId || game.gameCode || `${away.teamTricode}-${home.teamTricode}`),
    gameCode: game.gameCode || '',
    key: `${away.teamTricode || away.teamName || 'AWAY'}-${home.teamTricode || home.teamName || 'HOME'}`,
    home: {
      name: [home.teamCity, home.teamName].filter(Boolean).join(' ') || home.teamName || 'Home',
      short: home.teamTricode || home.teamName || 'HOME',
      score: safeNumber(home.score)
    },
    away: {
      name: [away.teamCity, away.teamName].filter(Boolean).join(' ') || away.teamName || 'Away',
      short: away.teamTricode || away.teamName || 'AWAY',
      score: safeNumber(away.score)
    },
    status: game.gameStatusText || (isLive ? 'Live' : isFinal ? 'Final' : 'Scheduled'),
    statusId,
    isLive,
    isFinal,
    period: safeNumber(game.period),
    clock: game.gameClock || '',
    startTime: game.gameTimeUTC || game.gameEt || null,
    scoreSig: `${safeNumber(away.score)}-${safeNumber(home.score)}|${safeNumber(game.period)}|${game.gameClock || ''}|${game.gameStatusText || ''}`,
    rawUpdatedAt: game?.meta?.time || null
  };
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  try {
    const upstream = await fetch(`${NBA_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'accept': 'application/json,text/plain,*/*',
        'user-agent': 'Mozilla/5.0 NBA Score Speed Checker',
        'cache-control': 'no-cache',
        'pragma': 'no-cache'
      }
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        source: 'nba',
        error: `NBA endpoint returned HTTP ${upstream.status}`,
        sample: text.slice(0, 500),
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt
      });
    }

    const data = JSON.parse(text);
    const games = Array.isArray(data?.scoreboard?.games) ? data.scoreboard.games.map(normalizeGame) : [];

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).json({
      ok: true,
      source: 'nba',
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      metaTime: data?.meta?.time || null,
      gameDate: data?.scoreboard?.gameDate || null,
      games
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      source: 'nba',
      error: err?.message || String(err),
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt
    });
  }
}
