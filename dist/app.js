const POLL_MS = Number(new URLSearchParams(location.search).get('pollMs') || 3000);
const SOURCES = [
  { id: 'nba', label: 'NBA CDN', endpoint: '/api/nba' },
  { id: 'espn', label: 'ESPN API', endpoint: '/api/espn' }
];

const state = {
  snapshots: { nba: null, espn: null },
  errors: { nba: null, espn: null },
  history: {},
  previousGames: { nba: new Map(), espn: new Map() },
  polling: false,
  lastPollAt: null,
  timer: null,
  countdownTimer: null
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const nowIso = () => new Date().toISOString();

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function secondsAgo(iso) {
  if (!iso) return '—';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  return `${(diff / 1000).toFixed(1)}s ago`;
}

function canonicalKey(game) {
  const away = String(game?.away?.short || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const home = String(game?.home?.short || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${away}-${home}`;
}

function scoreChanged(a, b) {
  if (!a || !b) return false;
  return a.away?.score !== b.away?.score || a.home?.score !== b.home?.score;
}

function statusRank(pair) {
  if (pair.nba?.isLive || pair.espn?.isLive) return 0;
  if (!(pair.nba?.isFinal || pair.espn?.isFinal)) return 1;
  return 2;
}

function statusText(pair) {
  if (pair.nba?.isLive || pair.espn?.isLive) return 'LIVE';
  if (pair.nba?.isFinal || pair.espn?.isFinal) return 'FINAL';
  return 'SCHEDULED';
}

function getLeader(history) {
  const nbaAt = history?.nba?.lastScoreChangeAt;
  const espnAt = history?.espn?.lastScoreChangeAt;
  if (!nbaAt && !espnAt) return { label: 'Waiting for score change', className: 'neutral' };
  if (nbaAt && !espnAt) return { label: 'NBA updated first', className: 'nba' };
  if (!nbaAt && espnAt) return { label: 'ESPN updated first', className: 'espn' };
  const n = new Date(nbaAt).getTime();
  const e = new Date(espnAt).getTime();
  const delta = Math.abs(n - e) / 1000;
  if (Math.abs(n - e) < 250) return { label: 'Tie / same poll', className: 'neutral' };
  return n < e
    ? { label: `NBA faster by ${delta.toFixed(1)}s`, className: 'nba' }
    : { label: `ESPN faster by ${delta.toFixed(1)}s`, className: 'espn' };
}

async function fetchSource(source) {
  const requestedAt = nowIso();
  const res = await fetch(`${source.endpoint}?clientTs=${Date.now()}`, { cache: 'no-store' });
  const receivedAt = nowIso();
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || `${source.label} HTTP ${res.status}`);
  return { ...json, requestedAt, receivedAt };
}

async function pollOnce() {
  if (state.polling) return;
  state.polling = true;
  $('refreshBtn').disabled = true;
  $('refreshBtn').textContent = '↻ Polling...';

  const settled = await Promise.allSettled(SOURCES.map(fetchSource));
  const updated = {};

  settled.forEach((result, i) => {
    const source = SOURCES[i];
    if (result.status === 'fulfilled') {
      updated[source.id] = result.value;
      state.snapshots[source.id] = result.value;
      state.errors[source.id] = null;
    } else {
      state.errors[source.id] = result.reason?.message || String(result.reason);
    }
  });

  for (const source of SOURCES) {
    const payload = updated[source.id];
    if (!payload?.games) continue;
    const previousMap = state.previousGames[source.id] || new Map();
    const newMap = new Map();
    for (const game of payload.games) {
      const key = canonicalKey(game);
      newMap.set(key, game);
      const previous = previousMap.get(key);
      if (scoreChanged(previous, game)) {
        state.history[key] = {
          ...(state.history[key] || {}),
          [source.id]: {
            ...(state.history[key]?.[source.id] || {}),
            lastScoreChangeAt: payload.receivedAt,
            lastScore: `${game.away.score}-${game.home.score}`,
            changes: (state.history[key]?.[source.id]?.changes || 0) + 1
          }
        };
      }
    }
    state.previousGames[source.id] = newMap;
  }

  state.lastPollAt = nowIso();
  state.polling = false;
  $('refreshBtn').disabled = false;
  $('refreshBtn').textContent = '↻ Refresh now';
  render();
}

function getGamePairs() {
  const pairs = new Map();
  for (const source of SOURCES) {
    for (const game of state.snapshots[source.id]?.games || []) {
      const key = canonicalKey(game);
      pairs.set(key, { ...(pairs.get(key) || {}), [source.id]: game, key });
    }
  }
  return Array.from(pairs.values()).sort((a, b) => {
    const rank = statusRank(a) - statusRank(b);
    if (rank !== 0) return rank;
    const startA = new Date((a.nba || a.espn)?.startTime || 0).getTime();
    const startB = new Date((b.nba || b.espn)?.startTime || 0).getTime();
    return startA - startB;
  });
}

function renderSources() {
  $('sources').innerHTML = SOURCES.map(source => {
    const payload = state.snapshots[source.id];
    const error = state.errors[source.id];
    return `<article class="sourceCard">
      <div class="sourceTitle">📡 ${esc(source.label)}</div>
      <p>Latency: <b>${esc(payload?.latencyMs ?? '—')} ms</b></p>
      <p>Fetched: <b>${esc(fmtTime(payload?.receivedAt || payload?.fetchedAt))}</b></p>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
    </article>`;
  }).join('');
}

function renderGames() {
  const games = getGamePairs();
  $('liveCount').textContent = games.filter(g => g.nba?.isLive || g.espn?.isLive).length;
  if (!games.length) {
    $('games').innerHTML = '<div class="empty">No NBA games returned yet. It will keep polling every 3 seconds.</div>';
    return;
  }

  $('games').innerHTML = games.map(pair => {
    const game = pair.nba || pair.espn;
    const h = state.history[pair.key] || {};
    const leader = getLeader(h);
    const status = statusText(pair);
    return `<article class="gameCard ${status.toLowerCase()}">
      <div class="gameTop">
        <div>
          <span class="pill ${status.toLowerCase()}">${status}</span>
          <h2>${esc(game.away.name)} @ ${esc(game.home.name)}</h2>
          <p class="gameMeta">🕒 ${esc(game.status)} ${game.clock ? `• ${esc(game.clock)}` : ''} ${game.period ? `• P${esc(game.period)}` : ''}</p>
        </div>
        <div class="winner ${leader.className}">🏆 ${esc(leader.label)}</div>
      </div>
      <div class="compareGrid">
        ${SOURCES.map(source => renderScoreBox(source, pair[source.id], h[source.id] || {})).join('')}
      </div>
    </article>`;
  }).join('');
}

function renderScoreBox(source, game, history) {
  if (!game) {
    return `<div class="scoreBox"><div class="boxHeader"><span>${esc(source.label)}</span></div><div class="missing">Not found in this feed.</div></div>`;
  }
  return `<div class="scoreBox">
    <div class="boxHeader"><span>${esc(source.label)}</span><span>${esc(game.source.toUpperCase())}</span></div>
    <div class="scoreLine"><span>${esc(game.away.short)}</span><b>${esc(game.away.score)}</b></div>
    <div class="scoreLine"><span>${esc(game.home.short)}</span><b>${esc(game.home.score)}</b></div>
    <div class="smallRows">
      <p>Last score change seen: <b>${esc(fmtTime(history.lastScoreChangeAt))}</b> (${esc(secondsAgo(history.lastScoreChangeAt))})</p>
      <p>Changes detected: <b>${esc(history.changes || 0)}</b></p>
      <p>Score at change: <b>${esc(history.lastScore || '—')}</b></p>
    </div>
  </div>`;
}

function render() {
  $('pollEvery').textContent = `${(POLL_MS / 1000).toFixed(POLL_MS % 1000 ? 1 : 0)} seconds`;
  $('lastPoll').textContent = fmtTime(state.lastPollAt);
  renderSources();
  renderGames();
}

function updateCountdown() {
  if (!state.lastPollAt) {
    $('nextPoll').textContent = '—';
    return;
  }
  const elapsed = Date.now() - new Date(state.lastPollAt).getTime();
  $('nextPoll').textContent = `${Math.max(0, (POLL_MS - elapsed) / 1000).toFixed(1)}s`;
}

$('refreshBtn').addEventListener('click', pollOnce);
render();
pollOnce();
state.timer = setInterval(pollOnce, POLL_MS);
state.countdownTimer = setInterval(updateCountdown, 200);
