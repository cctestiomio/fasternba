const TODAY = () => new Date();

const UA = 'Mozilla/5.0 (compatible; SportsAPISpeedRace/1.0; +https://vercel.app)';
const FETCH_TIMEOUT_MS = 6500;

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

function headersForUrl(url) {
  if (String(url).startsWith('https://cdn.nba.com/')) {
    return NBA_CDN_HEADERS;
  }
  return {
    'accept': 'application/json,text/plain,*/*',
    'user-agent': UA,
    'origin': 'https://www.espn.com',
    'referer': 'https://www.espn.com/'
  };
}

const SPORT_LABELS = { nba: 'NBA', mlb: 'MLB', nfl: 'NFL', nhl: 'NHL' };

function ymd(d = TODAY(), sep = '') {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${sep}${m}${sep}${day}`;
}
function mdyyyy(d = TODAY()) {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const y = d.getUTCFullYear();
  return `${m}/${day}/${y}`;
}
function addDays(date, days) {
  const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return d;
}
function currentNflSeasonYear() {
  const now = TODAY();
  const y = now.getUTCFullYear();
  return now.getUTCMonth() < 2 ? y - 1 : y;
}

const SOURCES = {
  nba: [
    { id: 'nba-cdn-scoreboard', name: 'NBA CDN scoreboard', type: 'nbaCdnScoreboard', url: () => 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json' },
    { id: 'nba-cdn-boxscore', name: 'NBA CDN boxscore per game', type: 'nbaCdnBoxscore', depends: 'nba-cdn-scoreboard' },
    { id: 'nba-cdn-playbyplay', name: 'NBA CDN play-by-play per game', type: 'nbaCdnPlayByPlay', depends: 'nba-cdn-scoreboard' },
    { id: 'espn-site-nba', name: 'ESPN site scoreboard', type: 'espnScoreboard', url: () => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard' },
    { id: 'espn-summary-nba', name: 'ESPN summary per game', type: 'espnSummary', depends: 'espn-site-nba', sportPath: 'basketball/nba' }
  ],
  mlb: [
    { id: 'mlb-stats-schedule', name: 'MLB Stats schedule+linescore', type: 'mlbSchedule', url: () => `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${ymd(TODAY(), '-')}&hydrate=linescore,team` },
    { id: 'mlb-stats-livefeed', name: 'MLB Stats live feed per game', type: 'mlbLiveFeed', depends: 'mlb-stats-schedule' },
    { id: 'mlb-stats-linescore', name: 'MLB Stats linescore per game', type: 'mlbLinescore', depends: 'mlb-stats-schedule' },
    { id: 'espn-site-mlb', name: 'ESPN site scoreboard', type: 'espnScoreboard', url: () => 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard' },
    { id: 'espn-summary-mlb', name: 'ESPN summary per game', type: 'espnSummary', depends: 'espn-site-mlb', sportPath: 'baseball/mlb' }
  ],
  nfl: [
    { id: 'espn-site-nfl', name: 'ESPN site scoreboard', type: 'espnScoreboard', url: () => 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard' },
    { id: 'espn-web-nfl', name: 'ESPN web scoreboard', type: 'espnScoreboard', url: () => 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/scoreboard' },
    { id: 'espn-site-nfl-limit', name: 'ESPN site scoreboard limit=100', type: 'espnScoreboard', url: () => 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100' },
    { id: 'espn-summary-nfl', name: 'ESPN summary per game', type: 'espnSummary', depends: 'espn-site-nfl', sportPath: 'football/nfl' },
    { id: 'espn-core-nfl-events', name: 'ESPN core events', type: 'espnCoreEvents', url: () => `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events?dates=${ymd()}&limit=100` }
  ],
  nhl: [
    { id: 'nhl-web-score-now', name: 'NHL API score/now', type: 'nhlScore', url: () => 'https://api-web.nhle.com/v1/score/now' },
    { id: 'nhl-web-score-date', name: 'NHL API score/date', type: 'nhlScore', url: () => `https://api-web.nhle.com/v1/score/${ymd(TODAY(), '-')}` },
    { id: 'nhl-web-scoreboard-now', name: 'NHL API scoreboard/now', type: 'nhlScoreboard', url: () => 'https://api-web.nhle.com/v1/scoreboard/now' },
    { id: 'nhl-gamecenter-landing', name: 'NHL gamecenter landing', type: 'nhlLanding', depends: 'nhl-web-score-now' },
    { id: 'espn-site-nhl', name: 'ESPN site scoreboard', type: 'espnScoreboard', url: () => 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard' }
  ]
};

async function fetchJson(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: headersForUrl(url)
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

function statusRank(status = '') {
  const s = String(status).toLowerCase();
  if (s.includes('progress') || s.includes('live') || s.includes('in_play') || s.includes('intermission') || s.includes('period') || s.includes('quarter') || s.includes('halftime')) return 0;
  if (s.includes('pre') || s.includes('sched') || s.includes('created')) return 1;
  if (s.includes('final') || s.includes('post') || s.includes('complete') || s.includes('off')) return 2;
  return 3;
}
function makeGameKey(sport, away, home, startTime, id = '') {
  const a = cleanTeam(away); const h = cleanTeam(home);
  const day = startTime ? String(startTime).slice(0, 10) : ymd(TODAY(), '-');
  return `${sport}:${day}:${a}@${h}`.toLowerCase().replace(/[^a-z0-9:@-]+/g, '-');
}
function cleanTeam(v) { return String(v || '').trim().replace(/\s+/g, ' '); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function gameObj({ sport, sourceId, sourceName, id, externalId, away, home, awayScore, homeScore, status, clock, period, startTime, rawStatus }) {
  const key = makeGameKey(sport, away, home, startTime, id || externalId);
  return {
    sport, sourceId, sourceName, id: String(id || externalId || key), externalId: String(externalId || id || ''), key,
    away: cleanTeam(away), home: cleanTeam(home), awayScore: num(awayScore), homeScore: num(homeScore),
    scoreKey: `${num(awayScore) ?? '?'}-${num(homeScore) ?? '?'}`,
    status: status || rawStatus || 'unknown', rawStatus: rawStatus || status || '', clock: clock || '', period: period || '', startTime: startTime || '', rank: statusRank(status || rawStatus)
  };
}

function parseEspnScoreboard(data, sport, source) {
  const events = data?.events || data?.sports?.[0]?.leagues?.[0]?.events || [];
  return events.map(ev => {
    const comp = ev.competitions?.[0] || ev.competition || {};
    const competitors = comp.competitors || [];
    const awayC = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
    const homeC = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
    const st = comp.status || ev.status || {};
    return gameObj({
      sport, sourceId: source.id, sourceName: source.name, id: ev.id || comp.id, externalId: ev.id || comp.id,
      away: awayC.team?.shortDisplayName || awayC.team?.displayName || awayC.team?.abbreviation,
      home: homeC.team?.shortDisplayName || homeC.team?.displayName || homeC.team?.abbreviation,
      awayScore: awayC.score, homeScore: homeC.score,
      status: st.type?.description || st.type?.name || st.type?.state,
      rawStatus: st.type?.state,
      clock: st.displayClock || '', period: st.period || '', startTime: ev.date || comp.date
    });
  }).filter(g => g.away && g.home);
}
function parseEspnSummary(data, sport, source) {
  const comp = data?.header?.competitions?.[0] || data?.boxscore?.teams?.[0]?.team ? data?.header?.competitions?.[0] : null;
  if (comp?.competitors) return parseEspnScoreboard({ events: [{ id: data?.header?.id || comp.id, competitions: [comp], date: comp.date }] }, sport, source);
  return [];
}
function parseNbaCdnScoreboard(data, sport, source) {
  const games = data?.scoreboard?.games || [];
  return games.map(g => gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: g.gameId, externalId: g.gameId,
    away: g.awayTeam?.teamTricode || g.awayTeam?.teamName, home: g.homeTeam?.teamTricode || g.homeTeam?.teamName,
    awayScore: g.awayTeam?.score, homeScore: g.homeTeam?.score,
    status: g.gameStatusText || g.gameStatus, clock: g.gameClock, period: g.period, startTime: g.gameTimeUTC
  })).filter(g => g.away && g.home);
}
function parseNbaBoxscore(data, sport, source) {
  const g = data?.game || data?.scoreboard?.games?.[0];
  if (!g) return [];
  return [gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: g.gameId, externalId: g.gameId,
    away: g.awayTeam?.teamTricode || g.awayTeam?.teamName, home: g.homeTeam?.teamTricode || g.homeTeam?.teamName,
    awayScore: g.awayTeam?.score, homeScore: g.homeTeam?.score,
    status: g.gameStatusText || g.gameStatus, clock: g.gameClock, period: g.period, startTime: g.gameTimeUTC
  })].filter(g => g.away && g.home);
}
function parseNbaPbp(data, baseGame, sport, source) {
  const actions = data?.game?.actions || data?.actions || [];
  let latest = [...actions].reverse().find(a => a.scoreHome != null || a.scoreAway != null || a.scoreHomeBefore != null);
  return [gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: data?.game?.gameId || baseGame?.externalId, externalId: data?.game?.gameId || baseGame?.externalId,
    away: baseGame?.away, home: baseGame?.home,
    awayScore: latest?.scoreAway ?? baseGame?.awayScore, homeScore: latest?.scoreHome ?? baseGame?.homeScore,
    status: baseGame?.status, clock: latest?.clock || baseGame?.clock, period: latest?.period || baseGame?.period, startTime: baseGame?.startTime
  })].filter(g => g.away && g.home);
}
function parseMlbSchedule(data, sport, source) {
  const games = (data?.dates || []).flatMap(d => d.games || []);
  return games.map(g => gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: g.gamePk, externalId: g.gamePk,
    away: g.teams?.away?.team?.abbreviation || g.teams?.away?.team?.name,
    home: g.teams?.home?.team?.abbreviation || g.teams?.home?.team?.name,
    awayScore: g.teams?.away?.score ?? g.linescore?.teams?.away?.runs,
    homeScore: g.teams?.home?.score ?? g.linescore?.teams?.home?.runs,
    status: g.status?.detailedState || g.status?.abstractGameState,
    rawStatus: g.status?.abstractGameState, period: g.linescore?.currentInningOrdinal || '', clock: g.linescore?.inningState || '', startTime: g.gameDate
  })).filter(g => g.away && g.home);
}
function parseMlbLiveFeed(data, sport, source) {
  const gd = data?.gameData || {}; const ls = data?.liveData?.linescore || {};
  return [gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: gd.game?.pk, externalId: gd.game?.pk,
    away: gd.teams?.away?.abbreviation || gd.teams?.away?.name, home: gd.teams?.home?.abbreviation || gd.teams?.home?.name,
    awayScore: ls.teams?.away?.runs, homeScore: ls.teams?.home?.runs,
    status: gd.status?.detailedState || gd.status?.abstractGameState, rawStatus: gd.status?.abstractGameState,
    period: ls.currentInningOrdinal || '', clock: ls.inningState || '', startTime: gd.datetime?.dateTime
  })].filter(g => g.away && g.home);
}
function parseMlbLinescore(data, baseGame, sport, source) {
  const ls = data || {};
  return [gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: baseGame?.externalId, externalId: baseGame?.externalId,
    away: baseGame?.away, home: baseGame?.home,
    awayScore: ls.teams?.away?.runs ?? baseGame?.awayScore, homeScore: ls.teams?.home?.runs ?? baseGame?.homeScore,
    status: baseGame?.status, period: ls.currentInningOrdinal || baseGame?.period, clock: ls.inningState || baseGame?.clock, startTime: baseGame?.startTime
  })].filter(g => g.away && g.home);
}
function parseNhlScore(data, sport, source) {
  const games = data?.games || data?.gameWeek?.flatMap(x => x.games || []) || [];
  return games.map(g => gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: g.id, externalId: g.id,
    away: g.awayTeam?.abbrev || g.awayTeam?.placeName?.default || g.awayTeam?.commonName?.default,
    home: g.homeTeam?.abbrev || g.homeTeam?.placeName?.default || g.homeTeam?.commonName?.default,
    awayScore: g.awayTeam?.score, homeScore: g.homeTeam?.score,
    status: g.gameState || g.gameScheduleState || g.gameType,
    clock: g.clock?.timeRemaining || '', period: g.periodDescriptor?.number || '', startTime: g.startTimeUTC
  })).filter(g => g.away && g.home);
}
function parseNhlLanding(data, sport, source) {
  const g = data || {};
  return [gameObj({
    sport, sourceId: source.id, sourceName: source.name, id: g.id, externalId: g.id,
    away: g.awayTeam?.abbrev || g.awayTeam?.placeName?.default || g.awayTeam?.commonName?.default,
    home: g.homeTeam?.abbrev || g.homeTeam?.placeName?.default || g.homeTeam?.commonName?.default,
    awayScore: g.awayTeam?.score, homeScore: g.homeTeam?.score,
    status: g.gameState || g.gameScheduleState, clock: g.clock?.timeRemaining || '', period: g.periodDescriptor?.number || '', startTime: g.startTimeUTC
  })].filter(g => g.away && g.home);
}

async function directFetch(source, sport) {
  const started = Date.now();
  const url = source.url();
  const data = await fetchJson(url);
  let games = [];
  if (source.type === 'espnScoreboard') games = parseEspnScoreboard(data, sport, source);
  if (source.type === 'nbaCdnScoreboard') games = parseNbaCdnScoreboard(data, sport, source);
  if (source.type === 'mlbSchedule') games = parseMlbSchedule(data, sport, source);
  if (source.type === 'nhlScore' || source.type === 'nhlScoreboard') games = parseNhlScore(data, sport, source);
  if (source.type === 'espnCoreEvents') games = []; // Core events is included as a public probe; it often returns refs, not full scores.
  games.forEach(g => { g.sourceUrl = scrubUrl(url); });
  return okResult(source, started, games, url);
}
function okResult(source, started, games, url) {
  return { sourceId: source.id, sourceName: source.name, ok: true, durationMs: Date.now() - started, gameCount: games.length, games, url: scrubUrl(url) };
}
function errResult(source, started, error, url='') {
  return { sourceId: source.id, sourceName: source.name, ok: false, durationMs: Date.now() - started, gameCount: 0, games: [], error: String(error?.message || error), url: scrubUrl(url) };
}
function scrubUrl(url) { return String(url || '').replace(/apikey=[^&]+/ig, 'apikey=REDACTED'); }

async function derivedFetch(source, sport, baseResults) {
  const started = Date.now();
  const urlsUsed = [];
  const record = (url) => { const clean = scrubUrl(url); urlsUsed.push(clean); return url; };
  try {
    const base = baseResults[source.depends];
    if (!base?.ok || !base.games.length) throw new Error(`No base games from ${source.depends}`);
    const liveish = base.games.filter(g => g.rank <= 2).slice(0, 16);
    let all = [];
    if (source.type === 'nbaCdnBoxscore') {
      const arr = await Promise.allSettled(liveish.map(async g => {
        const url = record(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${g.externalId}.json`);
        const parsed = parseNbaBoxscore(await fetchJson(url), sport, source)[0];
        if (parsed) parsed.sourceUrl = scrubUrl(url);
        return parsed;
      }).filter(Boolean));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'nbaCdnPlayByPlay') {
      const arr = await Promise.allSettled(liveish.map(async g => {
        const url = record(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${g.externalId}.json`);
        const parsed = parseNbaPbp(await fetchJson(url), g, sport, source)[0];
        if (parsed) parsed.sourceUrl = scrubUrl(url);
        return parsed;
      }).filter(Boolean));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'espnSummary') {
      const arr = await Promise.allSettled(liveish.map(async g => {
        const url = record(`https://site.api.espn.com/apis/site/v2/sports/${source.sportPath}/summary?event=${g.externalId}`);
        const parsed = parseEspnSummary(await fetchJson(url), sport, source)[0];
        if (parsed) parsed.sourceUrl = scrubUrl(url);
        return parsed;
      }).filter(Boolean));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'mlbLiveFeed') {
      const arr = await Promise.allSettled(liveish.map(async g => {
        const url = record(`https://statsapi.mlb.com/api/v1.1/game/${g.externalId}/feed/live`);
        const parsed = parseMlbLiveFeed(await fetchJson(url), sport, source)[0];
        if (parsed) parsed.sourceUrl = scrubUrl(url);
        return parsed;
      }).filter(Boolean));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'mlbLinescore') {
      const arr = await Promise.allSettled(liveish.map(async g => {
        const url = record(`https://statsapi.mlb.com/api/v1/game/${g.externalId}/linescore`);
        const parsed = parseMlbLinescore(await fetchJson(url), g, sport, source)[0];
        if (parsed) parsed.sourceUrl = scrubUrl(url);
        return parsed;
      }).filter(Boolean));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'nhlLanding') {
      const arr = await Promise.allSettled(liveish.map(async g => {
        const url = record(`https://api-web.nhle.com/v1/gamecenter/${g.externalId}/landing`);
        const parsed = parseNhlLanding(await fetchJson(url), sport, source)[0];
        if (parsed) parsed.sourceUrl = scrubUrl(url);
        return parsed;
      }).filter(Boolean));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    const templateUrl = derivedUrlTemplate(source);
    const result = okResult(source, started, all, urlsUsed.length ? urlsUsed[0] : templateUrl);
    result.urlTemplate = templateUrl;
    result.urlsUsed = [...new Set(urlsUsed)].slice(0, 20);
    return result;
  } catch (e) {
    return errResult(source, started, e, derivedUrlTemplate(source));
  }
}

function derivedUrlTemplate(source) {
  if (source.type === 'nbaCdnBoxscore') return 'https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{gameId}.json';
  if (source.type === 'nbaCdnPlayByPlay') return 'https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_{gameId}.json';
  if (source.type === 'espnSummary') return `https://site.api.espn.com/apis/site/v2/sports/${source.sportPath}/summary?event={eventId}`;
  if (source.type === 'mlbLiveFeed') return 'https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live';
  if (source.type === 'mlbLinescore') return 'https://statsapi.mlb.com/api/v1/game/{gamePk}/linescore';
  if (source.type === 'nhlLanding') return 'https://api-web.nhle.com/v1/gamecenter/{gameId}/landing';
  return `derived from ${source.depends}`;
}

async function fetchSport(sport) {
  const sources = SOURCES[sport] || [];
  const direct = sources.filter(s => !s.depends);
  const derived = sources.filter(s => s.depends);
  const baseEntries = await Promise.all(direct.map(async source => {
    const started = Date.now();
    try { return [source.id, await directFetch(source, sport)]; }
    catch (e) { return [source.id, errResult(source, started, e, source.url?.())]; }
  }));
  const baseResults = Object.fromEntries(baseEntries);
  const derivedEntries = await Promise.all(derived.map(async source => [source.id, await derivedFetch(source, sport, baseResults)]));
  const results = [...baseEntries, ...derivedEntries].map(([, v]) => v);
  const games = results.flatMap(r => r.games || []);
  return { sport, label: SPORT_LABELS[sport], sources: results, games };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const requested = String(req.query?.sport || 'all').toLowerCase();
  const sports = requested === 'all' ? Object.keys(SOURCES) : [requested].filter(s => SOURCES[s]);
  const started = Date.now();
  const sportsData = await Promise.all(sports.map(fetchSport));
  res.status(200).json({
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    pollIntervalRecommendedMs: 3000,
    sports: sportsData,
    note: 'All feeds are free/public/no-key probes. Some are undocumented and may be blocked, delayed, cached, or unavailable outside game windows.'
  });
};
