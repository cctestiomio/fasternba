const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(event, competition) {
  const status = competition?.status || event?.status || {};
  const type = status?.type || {};
  const state = String(type.state || '').toLowerCase();
  const name = String(type.name || '').toLowerCase();
  const isLive = state === 'in' || name.includes('status_in_progress');
  const isFinal = state === 'post' || type.completed === true;
  return {
    status: type.shortDetail || type.detail || type.description || event.status?.type?.description || 'Scheduled',
    isLive,
    isFinal,
    period: safeNumber(status.period),
    clock: status.displayClock || ''
  };
}

function normalizeGame(event) {
  const comp = event?.competitions?.[0] || {};
  const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
  const homeTeam = home.team || {};
  const awayTeam = away.team || {};
  const status = normalizeStatus(event, comp);
  const homeShort = homeTeam.abbreviation || homeTeam.shortDisplayName || 'HOME';
  const awayShort = awayTeam.abbreviation || awayTeam.shortDisplayName || 'AWAY';

  return {
    source: 'espn',
    id: String(event.id || comp.id || `${awayShort}-${homeShort}`),
    gameCode: event.shortName || `${awayShort} @ ${homeShort}`,
    key: `${awayShort}-${homeShort}`,
    home: {
      name: homeTeam.displayName || homeTeam.name || 'Home',
      short: homeShort,
      score: safeNumber(home.score)
    },
    away: {
      name: awayTeam.displayName || awayTeam.name || 'Away',
      short: awayShort,
      score: safeNumber(away.score)
    },
    status: status.status,
    isLive: status.isLive,
    isFinal: status.isFinal,
    period: status.period,
    clock: status.clock,
    startTime: event.date || comp.date || null,
    scoreSig: `${safeNumber(away.score)}-${safeNumber(home.score)}|${status.period}|${status.clock}|${status.status}`
  };
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  try {
    const upstream = await fetch(`${ESPN_URL}?_=${Date.now()}`, {
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
        source: 'espn',
        error: `ESPN endpoint returned HTTP ${upstream.status}`,
        sample: text.slice(0, 500),
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt
      });
    }

    const data = JSON.parse(text);
    const games = Array.isArray(data?.events) ? data.events.map(normalizeGame) : [];

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).json({
      ok: true,
      source: 'espn',
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      day: data?.day?.date || null,
      games
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      source: 'espn',
      error: err?.message || String(err),
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt
    });
  }
}
