const TODAY = () => new Date();

const UA = 'Mozilla/5.0 (compatible; SportsAPISpeedRace/2.0; +https://vercel.app)';
const FETCH_TIMEOUT_MS = 6500;
const THE_SPORTS_DB_KEY = process.env.THESPORTSDB_API_KEY || '3'; // public test key; set your own if you have one
const BDL_KEY = process.env.BALLDONTLIE_API_KEY || process.env.BDL_API_KEY || '';
const GRID_KEY = process.env.GRID_API_KEY || process.env.GRIDGG_API_KEY || '';
const GRID_ACCESS_LEVEL = String(process.env.GRID_ACCESS_LEVEL || 'open').toLowerCase();
const HLTV_GO_API_BASE_URL = String(process.env.HLTV_GO_API_BASE_URL || process.env.HLTV_API_BASE_URL || '').replace(/\/+$/, '');
const HLTV_NODE_ENABLED = /^(1|true|yes)$/i.test(String(process.env.HLTV_NODE_ENABLED || '0'));
const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';
const HLTV_APIFY_ACTOR_ID = process.env.HLTV_APIFY_ACTOR_ID || 'paco_nassa~hltv-org-live-and-upcoming-matches';

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
  const u = String(url);
  if (u.startsWith('https://cdn.nba.com/')) return NBA_CDN_HEADERS;
  const h = { 'accept': 'application/json,text/plain,*/*', 'user-agent': UA };
  if (u.includes('espn.com')) { h.origin = 'https://www.espn.com'; h.referer = 'https://www.espn.com/'; }
  if (u.includes('grid.gg') && GRID_KEY) h['x-api-key'] = GRID_KEY;
  if (u.includes('apify.com') && APIFY_TOKEN) h.authorization = `Bearer ${APIFY_TOKEN}`;
  if (u.includes('balldontlie') && BDL_KEY) h.Authorization = BDL_KEY;
  return h;
}

const SPORT_LABELS = {
  sports: 'All supported sports', esports: 'Esports bundle', esport: 'Esports bundle',
  nba: 'NBA', basketball: 'Basketball bundle', wnba: 'WNBA', ncaa: 'NCAA bundle', ncaab: 'NCAAB / CBB', cbb: 'NCAAB / CBB',
  nfl: 'NFL', football: 'Football bundle', mlb: 'MLB', baseball: 'Baseball bundle', nhl: 'NHL', hockey: 'Hockey bundle',
  mls: 'MLS', soccer: 'Soccer bundle', epl: 'English Premier League', uef: 'UEFA competitions', fif: 'FIFA / international', fifa: 'FIFA / international', bra2: 'Brazil Série B', per1: 'Peru Liga 1',
  tennis: 'Tennis bundle', atp: 'ATP Tennis', wta: 'WTA Tennis', golf: 'Golf', volleyball: 'Volleyball', rugby: 'Rugby', ahl: 'AHL',
  valorant: 'VALORANT', csgo: 'Counter-Strike', cs2: 'Counter-Strike 2', dota: 'Dota 2', dota2: 'Dota 2', 'league of legends': 'League of Legends', lol: 'League of Legends',
  overwatch: 'Overwatch', 'rocket league': 'Rocket League', 'call of duty': 'Call of Duty', cod: 'Call of Duty', 'rainbow six': 'Rainbow Six', r6: 'Rainbow Six',
  starcraft: 'StarCraft', hearthstone: 'Hearthstone', chess: 'Chess'
};

function ymd(d = TODAY(), sep = '') {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${sep}${m}${sep}${day}`;
}
function addDays(date, days) { const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return d; }
function todayRange() { return `${ymd(addDays(TODAY(), -1))}-${ymd(addDays(TODAY(), 1))}`; }
function lower(v) { return String(v || '').toLowerCase(); }
function cleanTeam(v) { return String(v || '').trim().replace(/\s+/g, ' '); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function scrubUrl(url) { return String(url || '').replace(/apikey=[^&]+/ig, 'apikey=REDACTED').replace(/key=[^&]+/ig, 'key=REDACTED').replace(/token=[^&]+/ig, 'token=REDACTED'); }
function makeGameKey(sport, away, home, startTime, id = '') {
  const day = startTime ? String(startTime).slice(0, 10) : ymd(TODAY(), '-');
  return `${sport}:${day}:${cleanTeam(away)}@${cleanTeam(home)}:${id ? String(id).slice(0, 10) : ''}`.toLowerCase().replace(/[^a-z0-9:@-]+/g, '-');
}
function statusRank(status = '') {
  const s = lower(status);
  if (s.includes('progress') || s.includes('live') || s.includes('in_play') || s.includes('intermission') || s.includes('period') || s.includes('quarter') || s.includes('half') || s.includes('set ') || s.includes('suspended') || s === 'in') return 0;
  if (s.includes('pre') || s.includes('sched') || s.includes('created') || s.includes('not started')) return 1;
  if (s.includes('final') || s.includes('post') || s.includes('complete') || s.includes('off') || s.includes('retired') || s.includes('walkover') || s === 'post') return 2;
  return 3;
}
function gameObj({ sport, sourceId, sourceName, id, externalId, away, home, awayScore, homeScore, status, clock, period, startTime, rawStatus, detail, scoreKey }) {
  const key = makeGameKey(sport, away, home, startTime, id || externalId);
  const as = num(awayScore), hs = num(homeScore);
  return {
    sport, sourceId, sourceName, id: String(id || externalId || key), externalId: String(externalId || id || ''), key,
    away: cleanTeam(away), home: cleanTeam(home), awayScore: as, homeScore: hs,
    scoreKey: scoreKey || `${as ?? '?'}-${hs ?? '?'}`,
    status: status || rawStatus || 'unknown', rawStatus: rawStatus || status || '', clock: clock || '', period: period || '', startTime: startTime || '', detail: detail || '', rank: statusRank(status || rawStatus)
  };
}
function okResult(source, started, games, url) { return { sourceId: source.id, sourceName: source.name, ok: true, durationMs: Date.now() - started, gameCount: games.length, games, url: scrubUrl(url) }; }
function errResult(source, started, error, url='') { return { sourceId: source.id, sourceName: source.name, ok: false, durationMs: Date.now() - started, gameCount: 0, games: [], error: String(error?.message || error), url: scrubUrl(url) }; }

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: options.method || 'GET', body: options.body, signal: controller.signal, headers: { ...headersForUrl(url), ...(options.headers || {}) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}

const epsn = (id, label, sportPath, qs = '') => ({ id, name: label, type: 'espnScoreboard', sportPath, url: () => `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard${qs}` });
const epsnWeb = (id, label, sportPath, qs = '') => ({ id, name: label, type: 'espnScoreboard', sportPath, url: () => `https://site.web.api.espn.com/apis/v2/sports/${sportPath}/scoreboard${qs}` });
const epsnSummary = (id, label, depends, sportPath) => ({ id, name: label, type: 'espnSummary', depends, sportPath });
const sportsDb = (id, label, leagueId) => ({ id, name: label, type: 'sportsDbEvents', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/eventsnextleague.php?id=${leagueId}` });
const sportsDbLast = (id, label, leagueId) => ({ id, name: label, type: 'sportsDbEvents', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/eventspastleague.php?id=${leagueId}` });
const bdl = (id, label, path) => ({ id, name: label, type: 'ballDontLie', needsKey: true, url: () => `https://api.balldontlie.io/v1/${path}` });
const hltvGo = (id, label, path) => ({ id, name: label, type: 'hltvGo', needsHltvGo: true, url: () => `${HLTV_GO_API_BASE_URL}${path}` });
const hltvNode = (id, label, method) => ({ id, name: label, type: 'hltvNode', method });
const hltvApify = (id, label) => ({ id, name: label, type: 'hltvApify', needsApify: true, url: () => `https://api.apify.com/v2/acts/${HLTV_APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}` });

const SOURCES = {
  nba: [
    { id: 'nba-cdn-scoreboard', name: 'NBA CDN scoreboard', type: 'nbaCdnScoreboard', url: () => 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json' },
    { id: 'nba-cdn-boxscore', name: 'NBA CDN boxscore per game', type: 'nbaCdnBoxscore', depends: 'nba-cdn-scoreboard' },
    { id: 'nba-cdn-playbyplay', name: 'NBA CDN play-by-play per game', type: 'nbaCdnPlayByPlay', depends: 'nba-cdn-scoreboard' },
    epsn('espn-site-nba', 'ESPN NBA scoreboard', 'basketball/nba'), epsnWeb('espn-web-nba', 'ESPN NBA web scoreboard', 'basketball/nba'), epsnSummary('espn-summary-nba', 'ESPN NBA summary per game', 'espn-site-nba', 'basketball/nba'),
    sportsDb('sportsdb-nba-next', 'TheSportsDB NBA next events', 4387), sportsDbLast('sportsdb-nba-last', 'TheSportsDB NBA recent events', 4387), bdl('bdl-nba-games', 'balldontlie NBA games (optional free key)', 'games')
  ],
  wnba: [epsn('espn-site-wnba', 'ESPN WNBA scoreboard', 'basketball/wnba'), epsnSummary('espn-summary-wnba', 'ESPN WNBA summary per game', 'espn-site-wnba', 'basketball/wnba'), sportsDb('sportsdb-wnba-next', 'TheSportsDB WNBA next events', 4430), sportsDbLast('sportsdb-wnba-last', 'TheSportsDB WNBA recent events', 4430)],
  ncaab: [epsn('espn-site-ncaab', 'ESPN men CBB scoreboard', 'basketball/mens-college-basketball', `?dates=${todayRange()}&limit=200`), epsn('espn-site-ncaaw', 'ESPN women CBB scoreboard', 'basketball/womens-college-basketball', `?dates=${todayRange()}&limit=200`)],
  cbb: [], ncaa: [], basketball: [],
  mlb: [
    { id: 'mlb-stats-schedule', name: 'MLB Stats schedule+linescore', type: 'mlbSchedule', url: () => `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${ymd(TODAY(), '-')}&hydrate=linescore,team` },
    { id: 'mlb-stats-livefeed', name: 'MLB Stats live feed per game', type: 'mlbLiveFeed', depends: 'mlb-stats-schedule' },
    { id: 'mlb-stats-linescore', name: 'MLB Stats linescore per game', type: 'mlbLinescore', depends: 'mlb-stats-schedule' },
    epsn('espn-site-mlb', 'ESPN MLB scoreboard', 'baseball/mlb'), epsnSummary('espn-summary-mlb', 'ESPN MLB summary per game', 'espn-site-mlb', 'baseball/mlb'), sportsDb('sportsdb-mlb-next', 'TheSportsDB MLB next events', 4424), sportsDbLast('sportsdb-mlb-last', 'TheSportsDB MLB recent events', 4424), bdl('bdl-mlb-games', 'balldontlie MLB games (optional free key)', 'mlb/games')
  ],
  baseball: [],
  nfl: [epsn('espn-site-nfl', 'ESPN NFL scoreboard', 'football/nfl'), epsnWeb('espn-web-nfl', 'ESPN NFL web scoreboard', 'football/nfl'), epsn('espn-site-nfl-limit', 'ESPN NFL scoreboard limit=100', 'football/nfl', '?limit=100'), epsnSummary('espn-summary-nfl', 'ESPN NFL summary per game', 'espn-site-nfl', 'football/nfl'), { id: 'espn-core-nfl-events', name: 'ESPN core NFL events probe', type: 'espnCoreEvents', url: () => `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events?dates=${ymd()}&limit=100` }, sportsDb('sportsdb-nfl-next', 'TheSportsDB NFL next events', 4391), sportsDbLast('sportsdb-nfl-last', 'TheSportsDB NFL recent events', 4391), bdl('bdl-nfl-games', 'balldontlie NFL games (optional free key)', 'nfl/games')],
  football: [],
  nhl: [{ id: 'nhl-web-score-now', name: 'NHL API score/now', type: 'nhlScore', url: () => 'https://api-web.nhle.com/v1/score/now' }, { id: 'nhl-web-score-date', name: 'NHL API score/date', type: 'nhlScore', url: () => `https://api-web.nhle.com/v1/score/${ymd(TODAY(), '-')}` }, { id: 'nhl-web-scoreboard-now', name: 'NHL API scoreboard/now', type: 'nhlScoreboard', url: () => 'https://api-web.nhle.com/v1/scoreboard/now' }, { id: 'nhl-gamecenter-landing', name: 'NHL gamecenter landing', type: 'nhlLanding', depends: 'nhl-web-score-now' }, epsn('espn-site-nhl', 'ESPN NHL scoreboard', 'hockey/nhl'), sportsDb('sportsdb-nhl-next', 'TheSportsDB NHL next events', 4380), sportsDbLast('sportsdb-nhl-last', 'TheSportsDB NHL recent events', 4380), bdl('bdl-nhl-games', 'balldontlie NHL games (optional free key)', 'nhl/games')],
  hockey: [], ahl: [epsn('espn-site-ahl-probe', 'ESPN AHL probe', 'hockey/ahl', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-ahl-next', 'TheSportsDB AHL next events', 4425), sportsDbLast('sportsdb-ahl-last', 'TheSportsDB AHL recent events', 4425)],
  mls: [epsn('espn-site-mls', 'ESPN MLS scoreboard', 'soccer/usa.1', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-mls-next', 'TheSportsDB MLS next events', 4346), sportsDbLast('sportsdb-mls-last', 'TheSportsDB MLS recent events', 4346)],
  epl: [epsn('espn-site-epl', 'ESPN Premier League scoreboard', 'soccer/eng.1', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-epl-next', 'TheSportsDB EPL next events', 4328), sportsDbLast('sportsdb-epl-last', 'TheSportsDB EPL recent events', 4328)],
  bra2: [epsn('espn-site-bra2', 'ESPN Brazil Série B probe', 'soccer/bra.2', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-bra2-next', 'TheSportsDB Brazil Série B next events', 4351), sportsDbLast('sportsdb-bra2-last', 'TheSportsDB Brazil Série B recent events', 4351)],
  per1: [epsn('espn-site-per1', 'ESPN Peru Liga 1 probe', 'soccer/per.1', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-per1-next', 'TheSportsDB Peru Liga 1 next events', 4649), sportsDbLast('sportsdb-per1-last', 'TheSportsDB Peru Liga 1 recent events', 4649)],
  uef: [epsn('espn-site-ucl', 'ESPN UEFA Champions League', 'soccer/uefa.champions', `?dates=${todayRange()}&limit=100`), epsn('espn-site-uel', 'ESPN UEFA Europa League', 'soccer/uefa.europa', `?dates=${todayRange()}&limit=100`), epsn('espn-site-uecl', 'ESPN UEFA Conference League probe', 'soccer/uefa.europa.conf', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-ucl-next', 'TheSportsDB UCL next events', 4480), sportsDbLast('sportsdb-ucl-last', 'TheSportsDB UCL recent events', 4480)],
  fif: [epsn('espn-site-fifa', 'ESPN FIFA/international probe', 'soccer/fifa.world', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-worldcup-next', 'TheSportsDB FIFA World Cup next events', 4429), sportsDbLast('sportsdb-worldcup-last', 'TheSportsDB FIFA World Cup recent events', 4429)],
  fifa: [], soccer: [],
  atp: [epsn('espn-site-atp', 'ESPN ATP scoreboard', 'tennis/atp'), epsn('espn-site-atp-today', 'ESPN ATP scoreboard today', 'tennis/atp', `?dates=${ymd()}`), epsn('espn-site-atp-week', 'ESPN ATP scoreboard ±3 days', 'tennis/atp', `?dates=${ymd(addDays(TODAY(), -3))}-${ymd(addDays(TODAY(), 3))}`), epsnSummary('espn-summary-atp', 'ESPN ATP summary per match', 'espn-site-atp', 'tennis/atp'), sportsDb('sportsdb-atp-next', 'TheSportsDB ATP next events', 4464), sportsDbLast('sportsdb-atp-last', 'TheSportsDB ATP recent events', 4464)],
  wta: [epsn('espn-site-wta', 'ESPN WTA scoreboard', 'tennis/wta'), epsn('espn-site-wta-today', 'ESPN WTA scoreboard today', 'tennis/wta', `?dates=${ymd()}`), epsn('espn-site-wta-week', 'ESPN WTA scoreboard ±3 days', 'tennis/wta', `?dates=${ymd(addDays(TODAY(), -3))}-${ymd(addDays(TODAY(), 3))}`), epsnSummary('espn-summary-wta', 'ESPN WTA summary per match', 'espn-site-wta', 'tennis/wta'), sportsDb('sportsdb-wta-next', 'TheSportsDB WTA next events', 4517), sportsDbLast('sportsdb-wta-last', 'TheSportsDB WTA recent events', 4517)],
  tennis: [], golf: [epsn('espn-site-golf', 'ESPN Golf scoreboard probe', 'golf/pga', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-pga-next', 'TheSportsDB PGA next events', 4466), sportsDbLast('sportsdb-pga-last', 'TheSportsDB PGA recent events', 4466), bdl('bdl-pga-events', 'balldontlie PGA events (optional free key)', 'pga/events')],
  volleyball: [epsn('espn-site-volleyball', 'ESPN volleyball probe', 'volleyball/ncaa-womens-volleyball', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-volleyball-next', 'TheSportsDB volleyball next events', 4560), sportsDbLast('sportsdb-volleyball-last', 'TheSportsDB volleyball recent events', 4560)],
  rugby: [epsn('espn-site-rugby', 'ESPN rugby scoreboard probe', 'rugby/242041', `?dates=${todayRange()}&limit=100`), sportsDb('sportsdb-rugby-next', 'TheSportsDB rugby union next events', 4415), sportsDbLast('sportsdb-rugby-last', 'TheSportsDB rugby union recent events', 4415)],
  valorant: [{ id: 'vlrggapi-note', name: 'vlrggapi optional self-host note', type: 'note', note: 'No durable no-key official VALORANT score API. If you self-host vlrggapi, add VLRGGAPI_BASE_URL and wire its match endpoint here.' }, { id: 'sportsdb-esports-valorant-search', name: 'TheSportsDB esports probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Valorant` }],
  cs2: [
    hltvGo('hltv-go-live-now', 'HLTV Go API live-now (self-host)', '/api/live-now'),
    hltvGo('hltv-go-matches', 'HLTV Go API matches (self-host)', '/api/matches'),
    hltvGo('hltv-go-last-results', 'HLTV Go API last-results (self-host)', '/api/last-results'),
    hltvApify('hltv-apify-live-upcoming', 'Apify HLTV live/upcoming actor (optional token)'),
    hltvNode('hltv-node-get-matches', 'gigobyte/HLTV getMatches() (optional local package)', 'getMatches'),
    hltvNode('hltv-node-get-results', 'gigobyte/HLTV getResults() (optional local package)', 'getResults'),
    { id: 'grid-cs2-series-state', name: 'GRID.gg CS2 Series State (optional key)', type: 'gridNote' },
    { id: 'sportsdb-esports-cs2-search', name: 'TheSportsDB CS2 event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Counter-Strike` }
  ],
  csgo: [], dota2: [{ id: 'grid-dota2-series-state', name: 'GRID.gg Dota2 Series State (optional key)', type: 'gridNote' }, { id: 'sportsdb-esports-dota-search', name: 'TheSportsDB Dota event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Dota` }], dota: [],
  lol: [{ id: 'sportsdb-esports-lol-search', name: 'TheSportsDB LoL event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=League%20of%20Legends` }], 'league of legends': [],
  overwatch: [{ id: 'sportsdb-esports-overwatch-search', name: 'TheSportsDB Overwatch event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Overwatch` }],
  'rocket league': [{ id: 'sportsdb-esports-rl-search', name: 'TheSportsDB Rocket League event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Rocket%20League` }],
  cod: [{ id: 'sportsdb-esports-cod-search', name: 'TheSportsDB CoD event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Call%20of%20Duty` }], 'call of duty': [],
  r6: [{ id: 'sportsdb-esports-r6-search', name: 'TheSportsDB Rainbow Six event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Rainbow%20Six` }], 'rainbow six': [],
  starcraft: [{ id: 'sportsdb-esports-sc-search', name: 'TheSportsDB StarCraft event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=StarCraft` }],
  hearthstone: [{ id: 'sportsdb-esports-hs-search', name: 'TheSportsDB Hearthstone event search probe', type: 'sportsDbSearch', url: () => `https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/searchevents.php?e=Hearthstone` }],
  chess: [{ id: 'chesscom-daily-puzzle', name: 'Chess.com public puzzle/current probe', type: 'chessCom', url: () => 'https://api.chess.com/pub/puzzle' }, { id: 'lichess-tv', name: 'Lichess TV public game probe', type: 'lichessTv', url: () => 'https://lichess.org/api/tv/feed' }]
};

SOURCES.cbb = SOURCES.ncaab;
SOURCES.ncaa = [...SOURCES.ncaab, ...SOURCES.nfl];
SOURCES.basketball = [...SOURCES.nba, ...SOURCES.wnba, ...SOURCES.ncaab];
SOURCES.baseball = SOURCES.mlb;
SOURCES.football = SOURCES.nfl;
SOURCES.hockey = [...SOURCES.nhl, ...SOURCES.ahl];
SOURCES.soccer = [...SOURCES.mls, ...SOURCES.epl, ...SOURCES.uef, ...SOURCES.fif, ...SOURCES.bra2, ...SOURCES.per1];
SOURCES.fifa = SOURCES.fif;
SOURCES.tennis = [...SOURCES.atp, ...SOURCES.wta];
SOURCES.csgo = SOURCES.cs2;
SOURCES.dota = SOURCES.dota2;
SOURCES['league of legends'] = SOURCES.lol;
SOURCES['call of duty'] = SOURCES.cod;
SOURCES['rainbow six'] = SOURCES.r6;
SOURCES.esports = [...SOURCES.valorant, ...SOURCES.cs2, ...SOURCES.dota2, ...SOURCES.lol, ...SOURCES.overwatch, ...SOURCES['rocket league'], ...SOURCES.cod, ...SOURCES.r6, ...SOURCES.starcraft, ...SOURCES.hearthstone];
SOURCES.esport = SOURCES.esports;
SOURCES.sports = [...SOURCES.basketball, ...SOURCES.baseball, ...SOURCES.football, ...SOURCES.hockey, ...SOURCES.soccer, ...SOURCES.tennis, ...SOURCES.golf, ...SOURCES.volleyball, ...SOURCES.rugby, ...SOURCES.esports, ...SOURCES.chess];

function parseEspnScoreboard(data, sport, source) {
  const events = data?.events || data?.sports?.[0]?.leagues?.[0]?.events || [];
  return events.map(ev => {
    const comp = ev.competitions?.[0] || ev.competition || {};
    const competitors = comp.competitors || [];
    const awayC = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
    const homeC = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
    const st = comp.status || ev.status || {};
    return gameObj({ sport, sourceId: source.id, sourceName: source.name, id: ev.id || comp.id, externalId: ev.id || comp.id, away: awayC.team?.shortDisplayName || awayC.team?.displayName || awayC.team?.abbreviation || awayC.athlete?.displayName, home: homeC.team?.shortDisplayName || homeC.team?.displayName || homeC.team?.abbreviation || homeC.athlete?.displayName, awayScore: awayC.score, homeScore: homeC.score, status: st.type?.description || st.type?.shortDetail || st.type?.name || st.type?.state, rawStatus: st.type?.state, clock: st.displayClock || '', period: st.period || '', startTime: ev.date || comp.date, detail: ev.name || ev.shortName });
  }).filter(g => g.away && g.home);
}
function parseEspnTennisScoreboard(data, sport, source) { return parseEspnScoreboard(data, sport, source); }
function parseEspnSummary(data, sport, source) { return parseEspnScoreboard(data, sport, source); }
function parseNbaCdnScoreboard(data, sport, source) {
  return (data?.scoreboard?.games || []).map(g => gameObj({ sport, sourceId: source.id, sourceName: source.name, id: g.gameId, externalId: g.gameId, away: g.awayTeam?.teamTricode || g.awayTeam?.teamName, home: g.homeTeam?.teamTricode || g.homeTeam?.teamName, awayScore: g.awayTeam?.score, homeScore: g.homeTeam?.score, status: g.gameStatusText || g.gameStatus, clock: g.gameClock, period: g.period, startTime: g.gameTimeUTC })).filter(g => g.away && g.home);
}
function parseNbaBoxscore(data, sport, source) {
  const g = data?.game || {};
  return [gameObj({ sport, sourceId: source.id, sourceName: source.name, id: g.gameId, externalId: g.gameId, away: g.awayTeam?.teamTricode || g.awayTeam?.teamName, home: g.homeTeam?.teamTricode || g.homeTeam?.teamName, awayScore: g.awayTeam?.score, homeScore: g.homeTeam?.score, status: g.gameStatusText || g.gameStatus, clock: g.gameClock, period: g.period, startTime: g.gameTimeUTC })].filter(g => g.away && g.home);
}
function parseNbaPbp(data, baseGame, sport, source) {
  const actions = data?.game?.actions || [];
  const last = [...actions].reverse().find(a => a.scoreHome != null || a.scoreAway != null) || {};
  return [gameObj({ sport, sourceId: source.id, sourceName: source.name, id: baseGame.externalId, externalId: baseGame.externalId, away: baseGame.away, home: baseGame.home, awayScore: last.scoreAway ?? baseGame.awayScore, homeScore: last.scoreHome ?? baseGame.homeScore, status: baseGame.status, clock: last.clock || baseGame.clock, period: last.period || baseGame.period, startTime: baseGame.startTime, detail: last.description })];
}
function parseMlbSchedule(data, sport, source) {
  const games = (data?.dates || []).flatMap(d => d.games || []);
  return games.map(g => gameObj({ sport, sourceId: source.id, sourceName: source.name, id: g.gamePk, externalId: g.gamePk, away: g.teams?.away?.team?.name, home: g.teams?.home?.team?.name, awayScore: g.teams?.away?.score, homeScore: g.teams?.home?.score, status: g.status?.detailedState || g.status?.abstractGameState, period: g.linescore?.currentInningOrdinal || g.linescore?.currentInning, clock: g.linescore?.inningState || '', startTime: g.gameDate })).filter(g => g.away && g.home);
}
function parseMlbLiveFeed(data, sport, source) {
  const g = data?.gameData || {}; const live = data?.liveData || {}; const ls = live?.linescore || {};
  return [gameObj({ sport, sourceId: source.id, sourceName: source.name, id: g.game?.pk, externalId: g.game?.pk, away: g.teams?.away?.name, home: g.teams?.home?.name, awayScore: ls.teams?.away?.runs, homeScore: ls.teams?.home?.runs, status: g.status?.detailedState || g.status?.abstractGameState, period: ls.currentInningOrdinal || ls.currentInning, clock: ls.inningState || '', startTime: g.datetime?.dateTime })].filter(g => g.away && g.home);
}
function parseMlbLinescore(data, baseGame, sport, source) { return [gameObj({ sport, sourceId: source.id, sourceName: source.name, id: baseGame.externalId, externalId: baseGame.externalId, away: baseGame.away, home: baseGame.home, awayScore: data?.teams?.away?.runs, homeScore: data?.teams?.home?.runs, status: data?.isTopInning == null ? baseGame.status : `${data.inningState || ''} ${data.currentInningOrdinal || ''}`, period: data?.currentInningOrdinal || data?.currentInning, clock: data?.inningState || '', startTime: baseGame.startTime })]; }
function parseNhlScore(data, sport, source) {
  const games = data?.games || data?.gameWeek?.flatMap(d => d.games || []) || [];
  return games.map(g => gameObj({ sport, sourceId: source.id, sourceName: source.name, id: g.id, externalId: g.id, away: g.awayTeam?.abbrev || g.awayTeam?.placeName?.default || g.awayTeam?.commonName?.default, home: g.homeTeam?.abbrev || g.homeTeam?.placeName?.default || g.homeTeam?.commonName?.default, awayScore: g.awayTeam?.score, homeScore: g.homeTeam?.score, status: g.gameState || g.gameScheduleState || g.gameType, clock: g.clock?.timeRemaining || '', period: g.periodDescriptor?.number || '', startTime: g.startTimeUTC })).filter(g => g.away && g.home);
}
function parseNhlLanding(data, sport, source) { return parseNhlScore({ games: [data] }, sport, source); }
function parseSportsDbEvents(data, sport, source) {
  const events = data?.events || data?.event || [];
  return events.map(ev => {
    const parts = String(ev.strEvent || '').split(/\s+v(?:s)?\.?\s+/i);
    return gameObj({ sport, sourceId: source.id, sourceName: source.name, id: ev.idEvent, externalId: ev.idEvent, away: ev.strAwayTeam || ev.strAwayTeamAlternate || parts[1], home: ev.strHomeTeam || ev.strHomeTeamAlternate || parts[0], awayScore: ev.intAwayScore, homeScore: ev.intHomeScore, status: ev.strStatus || (ev.intHomeScore != null || ev.intAwayScore != null ? 'Final/Result' : 'Scheduled'), clock: ev.strTimestamp || ev.strTime || '', period: ev.strRound || '', startTime: ev.strTimestamp || [ev.dateEvent, ev.strTime].filter(Boolean).join('T'), detail: [ev.strLeague, ev.strSeason, ev.strVenue, ev.strCountry].filter(Boolean).join(' · ') });
  }).filter(g => g.away && g.home);
}
function parseBallDontLie(data, sport, source) {
  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.map(g => gameObj({ sport, sourceId: source.id, sourceName: source.name, id: g.id, externalId: g.id, away: g.visitor_team?.full_name || g.away_team?.full_name || g.away_team?.name || g.visitor_team?.name, home: g.home_team?.full_name || g.home_team?.name, awayScore: g.visitor_team_score ?? g.away_team_score, homeScore: g.home_team_score, status: g.status || g.period, startTime: g.date || g.datetime })).filter(g => g.away && g.home);
}
function parseChessCom(data, sport, source) {
  return [gameObj({ sport, sourceId: source.id, sourceName: source.name, id: data?.url || 'puzzle', away: 'Puzzle', home: data?.title || 'Chess.com', status: 'Public API alive', detail: data?.url || '', startTime: new Date().toISOString(), scoreKey: 'alive' })];
}
function parseLichessTv(data, sport, source) {
  return [gameObj({ sport, sourceId: source.id, sourceName: source.name, id: 'lichess-tv', away: 'Lichess', home: 'TV Feed', status: 'Public API alive', detail: 'Streaming NDJSON endpoint responded', startTime: new Date().toISOString(), scoreKey: 'alive' })];
}

function pickFirst(obj, keys) {
  for (const key of keys) {
    const v = obj?.[key];
    if (v != null && v !== '') return v;
  }
  return '';
}
function teamNameFromAny(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return pickFirst(v, ['name', 'teamName', 'title', 'displayName', 'shortName', 'tag']) || String(v.id || '');
}
function splitScore(v) {
  if (Array.isArray(v) && v.length >= 2) return [num(v[0]), num(v[1])];
  const m = String(v || '').match(/(\d+)\s*[-:–]\s*(\d+)/);
  return m ? [num(m[1]), num(m[2])] : [null, null];
}
function parseHltvGeneric(data, sport, source) {
  const rows = Array.isArray(data) ? data : (data?.data || data?.matches || data?.results || data?.items || data?.events || []);
  return rows.map((r, idx) => {
    const team1 = r.team1 || r.teamA || r.homeTeam || r.home || r.teams?.[0] || r.opponents?.[0]?.opponent || r.opponents?.[0];
    const team2 = r.team2 || r.teamB || r.awayTeam || r.away || r.teams?.[1] || r.opponents?.[1]?.opponent || r.opponents?.[1];
    const home = teamNameFromAny(team1);
    const away = teamNameFromAny(team2);
    const [score1, score2] = splitScore(r.score || r.result || r.mapScore || r.currentScore || r.scoreText);
    const s1 = num(r.team1Score ?? r.homeScore ?? r.score1 ?? r.mapsWon1 ?? r.result?.team1) ?? score1;
    const s2 = num(r.team2Score ?? r.awayScore ?? r.score2 ?? r.mapsWon2 ?? r.result?.team2) ?? score2;
    const status = pickFirst(r, ['status', 'state', 'time', 'liveStatus']) || (r.live ? 'Live' : (s1 != null || s2 != null ? 'Result' : 'Scheduled'));
    const startTime = r.date || r.startTime || r.startTimeUTC || r.timestamp || r.timeUnix || r.unixTime || '';
    return gameObj({
      sport, sourceId: source.id, sourceName: source.name, id: r.id || r.matchId || r.url || `${source.id}-${idx}`,
      externalId: r.id || r.matchId || '', away, home, awayScore: s2, homeScore: s1, status,
      startTime: typeof startTime === 'number' ? new Date(startTime > 9999999999 ? startTime : startTime * 1000).toISOString() : startTime,
      detail: [r.event?.name || r.eventName || r.event, r.map, r.format, r.url].filter(Boolean).join(' · '),
      scoreKey: s1 != null || s2 != null ? `${s1 ?? '?'}-${s2 ?? '?'}` : (r.score || r.result || 'hltv')
    });
  }).filter(g => g.away && g.home);
}
async function fetchHltvNode(source, sport) {
  const started = Date.now();
  if (!HLTV_NODE_ENABLED) return okResult(source, started, [gameObj({ sport, sourceId: source.id, sourceName: source.name, away: 'gigobyte/HLTV', home: 'Disabled', status: 'Optional verifier', detail: 'Set HLTV_NODE_ENABLED=true and install npm package hltv to enable this scraper. Keep request volume low because HLTV Cloudflare can throttle/ban abusive scraping.', scoreKey: 'disabled' })], 'npm:hltv');
  let pkg;
  try { pkg = require('hltv'); } catch (e) { throw new Error('npm package hltv is not installed. Run npm install hltv or leave HLTV_NODE_ENABLED=false.'); }
  const api = pkg.HLTV || pkg.default || pkg;
  if (!api || typeof api[source.method] !== 'function') throw new Error(`hltv package does not expose ${source.method}()`);
  const data = await api[source.method](source.method === 'getResults' ? { pages: 1 } : {});
  const games = parseHltvGeneric(data, sport, source);
  games.forEach(g => { g.sourceUrl = 'npm:hltv'; });
  return okResult(source, started, games, 'npm:hltv');
}

async function directFetch(source, sport) {
  const started = Date.now();
  if (source.type === 'note') return okResult(source, started, [gameObj({ sport, sourceId: source.id, sourceName: source.name, away: 'No-key API', home: 'Not available', status: 'Informational', detail: source.note, scoreKey: 'note' })], '');
  if (source.type === 'hltvNode') return fetchHltvNode(source, sport);
  if (source.type === 'gridNote') {
    const endpoint = GRID_ACCESS_LEVEL === 'full' ? 'https://api.grid.gg/live-data-feed/series-state/graphql' : 'https://api-op.grid.gg/live-data-feed/series-state/graphql';
    const detail = GRID_KEY ? `GRID key configured. Series-state API needs a mapped seriesId before it can verify a market. Endpoint: ${endpoint}` : 'Set GRID_API_KEY or GRIDGG_API_KEY plus a mapped seriesId to use GRID. No generic no-key CS2/Dota2 live score endpoint is available.';
    return okResult(source, started, [gameObj({ sport, sourceId: source.id, sourceName: source.name, away: 'GRID.gg', home: GRID_KEY ? 'Configured' : 'Needs key', status: 'Optional verifier', detail, scoreKey: GRID_KEY ? 'configured' : 'needs-key' })], endpoint);
  }
  if (source.needsKey && !BDL_KEY) return errResult(source, started, 'Optional free API key not configured. Set BALLDONTLIE_API_KEY to enable this feed.', source.url());
  if (source.needsHltvGo && !HLTV_GO_API_BASE_URL) return errResult(source, started, 'Optional HLTV Go API base URL not configured. Set HLTV_GO_API_BASE_URL, e.g. http://localhost:8080, after self-hosting the Go HLTV API.', 'HLTV_GO_API_BASE_URL');
  if (source.needsApify && !APIFY_TOKEN) return errResult(source, started, 'Optional Apify token not configured. Set APIFY_TOKEN or APIFY_API_TOKEN to enable the HLTV Apify actor.', source.url());
  const url = source.url();
  let data;
  if (source.type === 'lichessTv') {
    const controller = new AbortController(); const t = setTimeout(() => controller.abort(), 1800);
    try { const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/x-ndjson', 'user-agent': UA } }); if (!res.ok) throw new Error(`HTTP ${res.status}`); data = {}; } finally { clearTimeout(t); }
  } else if (source.type === 'hltvApify') data = await fetchJson(url, { method: 'POST', body: JSON.stringify({}), headers: { 'content-type': 'application/json' } });
  else data = await fetchJson(url);
  let games = [];
  if (source.type === 'espnScoreboard') games = parseEspnScoreboard(data, sport, source);
  if (source.type === 'espnTennisScoreboard') games = parseEspnTennisScoreboard(data, sport, source);
  if (source.type === 'nbaCdnScoreboard') games = parseNbaCdnScoreboard(data, sport, source);
  if (source.type === 'mlbSchedule') games = parseMlbSchedule(data, sport, source);
  if (source.type === 'nhlScore' || source.type === 'nhlScoreboard') games = parseNhlScore(data, sport, source);
  if (source.type === 'sportsDbEvents' || source.type === 'sportsDbSearch') games = parseSportsDbEvents(data, sport, source);
  if (source.type === 'ballDontLie') games = parseBallDontLie(data, sport, source);
  if (source.type === 'hltvGo' || source.type === 'hltvApify') games = parseHltvGeneric(data, sport, source);
  if (source.type === 'chessCom') games = parseChessCom(data, sport, source);
  if (source.type === 'lichessTv') games = parseLichessTv(data, sport, source);
  if (source.type === 'espnCoreEvents') games = [];
  games.forEach(g => { g.sourceUrl = scrubUrl(url); });
  return okResult(source, started, games, url);
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
async function derivedFetch(source, sport, baseResults) {
  const started = Date.now(); const urlsUsed = []; const record = (url) => { urlsUsed.push(scrubUrl(url)); return url; };
  try {
    const base = baseResults[source.depends];
    if (!base?.ok || !base.games.length) throw new Error(`No base games from ${source.depends}`);
    const liveish = base.games.filter(g => g.rank <= 2).slice(0, 16);
    let all = [];
    if (source.type === 'nbaCdnBoxscore') {
      const arr = await Promise.allSettled(liveish.map(async g => { const url = record(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${g.externalId}.json`); const parsed = parseNbaBoxscore(await fetchJson(url), sport, source)[0]; if (parsed) parsed.sourceUrl = scrubUrl(url); return parsed; }));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'nbaCdnPlayByPlay') {
      const arr = await Promise.allSettled(liveish.map(async g => { const url = record(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${g.externalId}.json`); const parsed = parseNbaPbp(await fetchJson(url), g, sport, source)[0]; if (parsed) parsed.sourceUrl = scrubUrl(url); return parsed; }));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'espnSummary') {
      const arr = await Promise.allSettled(liveish.map(async g => { const url = record(`https://site.api.espn.com/apis/site/v2/sports/${source.sportPath}/summary?event=${g.externalId}`); const parsed = parseEspnSummary(await fetchJson(url), sport, source)[0]; if (parsed) parsed.sourceUrl = scrubUrl(url); return parsed; }));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'mlbLiveFeed') {
      const arr = await Promise.allSettled(liveish.map(async g => { const url = record(`https://statsapi.mlb.com/api/v1.1/game/${g.externalId}/feed/live`); const parsed = parseMlbLiveFeed(await fetchJson(url), sport, source)[0]; if (parsed) parsed.sourceUrl = scrubUrl(url); return parsed; }));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'mlbLinescore') {
      const arr = await Promise.allSettled(liveish.map(async g => { const url = record(`https://statsapi.mlb.com/api/v1/game/${g.externalId}/linescore`); const parsed = parseMlbLinescore(await fetchJson(url), g, sport, source)[0]; if (parsed) parsed.sourceUrl = scrubUrl(url); return parsed; }));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    if (source.type === 'nhlLanding') {
      const arr = await Promise.allSettled(liveish.map(async g => { const url = record(`https://api-web.nhle.com/v1/gamecenter/${g.externalId}/landing`); const parsed = parseNhlLanding(await fetchJson(url), sport, source)[0]; if (parsed) parsed.sourceUrl = scrubUrl(url); return parsed; }));
      all = arr.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
    }
    const result = okResult(source, started, all, urlsUsed[0] || derivedUrlTemplate(source));
    result.urlTemplate = derivedUrlTemplate(source); result.urlsUsed = [...new Set(urlsUsed)].slice(0, 20);
    return result;
  } catch (e) { return errResult(source, started, e, derivedUrlTemplate(source)); }
}
async function fetchSport(sport) {
  const allSources = SOURCES[sport] || [];
  const seen = new Set();
  const sources = allSources.filter(s => { const k = `${s.id}:${s.type}:${s.sportPath || ''}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, sport === 'sports' ? 70 : 35);
  const direct = sources.filter(s => !s.depends); const derived = sources.filter(s => s.depends);
  const baseEntries = await Promise.all(direct.map(async source => { const started = Date.now(); try { return [source.id, await directFetch(source, sport)]; } catch (e) { return [source.id, errResult(source, started, e, source.url?.() || '')]; } }));
  const baseResults = Object.fromEntries(baseEntries);
  const derivedEntries = await Promise.all(derived.map(async source => [source.id, await derivedFetch(source, sport, baseResults)]));
  const results = [...baseEntries, ...derivedEntries].map(([, v]) => v);
  return { sport, label: SPORT_LABELS[sport] || sport.toUpperCase(), sources: results, games: results.flatMap(r => r.games || []) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cache-Control', 'no-store, max-age=0');
  const requested = String(req.query?.sport || 'all').toLowerCase();
  const sports = requested === 'all' ? ['nba','wnba','ncaab','mlb','nfl','nhl','mls','epl','uef','atp','wta','golf','rugby','volleyball','esports','chess'] : [requested].filter(s => SOURCES[s]);
  const started = Date.now();
  const sportsData = await Promise.all(sports.map(fetchSport));
  res.status(200).json({
    generatedAt: new Date().toISOString(), durationMs: Date.now() - started, pollIntervalRecommendedMs: 3000, supportedTags: Object.keys(SOURCES).sort(), sports: sportsData,
    note: 'Patched for the SPORTS_TAGS list. Default probes are free/public/no-key where possible: ESPN public scoreboards, official NBA/MLB/NHL endpoints, TheSportsDB public API, Chess.com/Lichess public probes. Optional free-key/freemium probes activate from BALLDONTLIE_API_KEY and GRID_API_KEY/GRIDGG_API_KEY. Esports coverage is intentionally conservative because durable no-key official live-score APIs are scarce. CS2 now includes optional HLTV probes: self-hosted Go HLTV API via HLTV_GO_API_BASE_URL, Apify via APIFY_TOKEN, and gigobyte/HLTV via HLTV_NODE_ENABLED=true plus npm package hltv.'
  });
};
