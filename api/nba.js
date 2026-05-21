const NBA_URL = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';
const NBA_CDN_HEADERS = {
  'Host': 'cdn.nba.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Connection': 'keep-alive',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Priority': 'u=4',
  'TE': 'trailers'
};

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
        ...NBA_CDN_HEADERS,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
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
