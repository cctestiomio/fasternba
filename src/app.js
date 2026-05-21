const DEFAULT_REFRESH_MS = 3000;
const state = {
  paused: false,
  refreshMs: DEFAULT_REFRESH_MS,
  timer: null,
  lastSnapshot: null,
  history: new Map(), // sport|gameKey|sourceId -> {scoreKey,lastSeenScoreChangeAt,firstSeenAt}
  raceWins: new Map() // sport|gameKey|scoreKey -> {sourceId,sourceName,at}
};

const $ = (id) => document.getElementById(id);
const sportSections = $('sportSections');
const sportTemplate = $('sportTemplate');

$('refreshMs').addEventListener('change', () => {
  state.refreshMs = Math.max(3000, Number($('refreshMs').value || DEFAULT_REFRESH_MS));
  $('refreshMs').value = state.refreshMs;
  $('intervalText').textContent = `${(state.refreshMs/1000).toFixed(state.refreshMs % 1000 ? 1 : 0)}s`;
  restart();
});
$('sportFilter').addEventListener('change', () => pollNow());
$('pauseBtn').addEventListener('click', () => {
  state.paused = !state.paused;
  $('pauseBtn').textContent = state.paused ? 'Resume' : 'Pause';
  $('stateText').textContent = state.paused ? 'Paused' : 'Running';
  $('liveDot').className = state.paused ? 'dot paused' : 'dot';
  if (!state.paused) pollNow();
});
$('resetBtn').addEventListener('click', () => {
  state.history.clear(); state.raceWins.clear(); render(state.lastSnapshot);
});

function restart() {
  clearInterval(state.timer);
  state.timer = setInterval(() => { if (!state.paused) pollNow(); }, state.refreshMs);
}
function fmtTime(isoOrMs) {
  if (!isoOrMs) return '—';
  const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function ago(ms) {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s/60)}m ${s%60}s ago`;
}
function keyFor(g, sourceId = g.sourceId) { return `${g.sport}|${g.key}|${sourceId}`; }
function raceKey(g) { return `${g.sport}|${g.key}|${g.scoreKey}`; }
function updateHistory(snapshot) {
  const now = Date.now();
  for (const sport of snapshot.sports || []) {
    for (const g of sport.games || []) {
      const k = keyFor(g);
      const prev = state.history.get(k);
      if (!prev) {
        state.history.set(k, { scoreKey: g.scoreKey, lastSeenScoreChangeAt: now, firstSeenAt: now });
      } else if (prev.scoreKey !== g.scoreKey) {
        state.history.set(k, { ...prev, scoreKey: g.scoreKey, lastSeenScoreChangeAt: now });
      }
      const rk = raceKey(g);
      if (!state.raceWins.has(rk)) {
        state.raceWins.set(rk, { sourceId: g.sourceId, sourceName: g.sourceName, at: now });
      }
    }
  }
}
async function pollNow() {
  $('stateText').textContent = 'Polling…';
  $('liveDot').className = 'dot loading';
  try {
    const sport = $('sportFilter').value;
    const url = `/api/snapshot?sport=${encodeURIComponent(sport)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    state.lastSnapshot = data;
    updateHistory(data);
    render(data);
    $('stateText').textContent = 'Running';
    $('liveDot').className = 'dot';
  } catch (err) {
    $('stateText').textContent = `Error: ${err.message}`;
    $('liveDot').className = 'dot error';
  }
}
function groupGames(games) {
  const map = new Map();
  for (const g of games || []) {
    if (!map.has(g.key)) map.set(g.key, { key: g.key, sport: g.sport, away: g.away, home: g.home, startTime: g.startTime, bestRank: g.rank ?? 3, rows: [] });
    const item = map.get(g.key);
    item.bestRank = Math.min(item.bestRank, g.rank ?? 3);
    item.rows.push(g);
    if (!item.away && g.away) item.away = g.away;
    if (!item.home && g.home) item.home = g.home;
    if (!item.startTime && g.startTime) item.startTime = g.startTime;
  }
  return [...map.values()].sort((a,b) => (a.bestRank-b.bestRank) || String(a.startTime).localeCompare(String(b.startTime)) || a.key.localeCompare(b.key));
}
function sourceSummary(source) {
  const cls = source.ok ? 'ok' : 'bad';
  const shownUrl = source.urlTemplate || source.url || '';
  return `<div class="feed ${cls}">
    <div class="feed-title">${escapeHtml(source.sourceName)}</div>
    <div class="feed-stats">${source.ok ? `${source.gameCount} games · ${source.durationMs}ms` : `failed · ${source.durationMs}ms`}</div>
    ${shownUrl ? `<div class="feed-url"><span>Endpoint:</span> <a href="${escapeAttr(realHref(source.url || shownUrl))}" target="_blank" rel="noreferrer">${escapeHtml(shownUrl)}</a></div>` : ''}
    ${source.urlsUsed?.length ? `<details class="feed-used"><summary>${source.urlsUsed.length} exact URLs used this poll</summary>${source.urlsUsed.map(u => `<a href="${escapeAttr(realHref(u))}" target="_blank" rel="noreferrer">${escapeHtml(u)}</a>`).join('')}</details>` : ''}
    ${source.error ? `<div class="feed-error">${escapeHtml(source.error)}</div>` : ''}
  </div>`;
}
function render(snapshot) {
  if (!snapshot) return;
  sportSections.innerHTML = '';
  const totalFeeds = (snapshot.sports || []).reduce((n,s) => n + (s.sources?.length || 0), 0);
  $('lastPoll').textContent = `${fmtTime(snapshot.generatedAt)} (${snapshot.durationMs}ms server)`;
  $('feedCount').textContent = totalFeeds;
  for (const sport of snapshot.sports || []) {
    const node = sportTemplate.content.cloneNode(true);
    const section = node.querySelector('.sport-card');
    node.querySelector('h2').textContent = sport.label || sport.sport.toUpperCase();
    const gameGroups = groupGames(sport.games);
    const liveCount = gameGroups.filter(g => g.bestRank === 0).length;
    node.querySelector('.sport-meta').textContent = `${liveCount} live/current · ${gameGroups.length} total matched games · ${sport.sources.length} feeds`;
    node.querySelector('.feed-grid').innerHTML = sport.sources.map(sourceSummary).join('');
    node.querySelector('.games').innerHTML = gameGroups.length ? gameGroups.map(renderGameGroup).join('') : '<div class="empty">No games found right now. This is normal out of season or before games start.</div>';
    sportSections.appendChild(node);
  }
}
function renderGameGroup(group) {
  const rows = group.rows.sort((a,b) => a.sourceName.localeCompare(b.sourceName));
  const leader = findLeader(rows);
  return `<article class="game ${group.bestRank === 0 ? 'live' : ''}">
    <div class="game-head">
      <div>
        <div class="teams">${escapeHtml(group.away)} <span>@</span> ${escapeHtml(group.home)}</div>
        <div class="game-meta">${statusLabel(group.bestRank)} · ${group.startTime ? new Date(group.startTime).toLocaleString() : 'time unknown'}</div>
      </div>
      <div class="leader">Fastest this score: <strong>${leader ? escapeHtml(leader.sourceName) : '—'}</strong>${leader ? ` <span>${ago(leader.at)}</span>` : ''}</div>
    </div>
    <div class="score-table">
      <div class="tr header"><div>Endpoint</div><div>Exact URL</div><div>Score</div><div>Status</div><div>First saw current score</div><div>Last changed</div></div>
      ${rows.map(renderSourceRow).join('')}
    </div>
  </article>`;
}
function findLeader(rows) {
  const valid = rows.filter(r => r.scoreKey && !r.scoreKey.includes('?'));
  if (!valid.length) return null;
  const latestScore = valid.sort((a,b) => (b.rank === 0) - (a.rank === 0))[0].scoreKey;
  const winner = state.raceWins.get(raceKey({ ...valid[0], scoreKey: latestScore }));
  return winner || null;
}
function renderSourceRow(g) {
  const hist = state.history.get(keyFor(g));
  const rk = state.raceWins.get(raceKey(g));
  const isWinner = rk?.sourceId === g.sourceId;
  return `<div class="tr ${isWinner ? 'winner' : ''}">
    <div class="endpoint">${escapeHtml(g.sourceName)}${isWinner ? ' 🏁' : ''}</div>
    <div class="urlcell">${g.sourceUrl ? `<a href="${escapeAttr(realHref(g.sourceUrl))}" target="_blank" rel="noreferrer">${escapeHtml(g.sourceUrl)}</a>` : '—'}</div>
    <div class="score"><b>${g.awayScore ?? '?'}</b> - <b>${g.homeScore ?? '?'}</b></div>
    <div>${escapeHtml(g.status || '')} ${g.period ? `· P${escapeHtml(g.period)}` : ''} ${g.clock ? `· ${escapeHtml(g.clock)}` : ''}${g.detail ? `<div class="detail">${escapeHtml(g.detail)}</div>` : ''}</div>
    <div>${rk?.sourceId === g.sourceId ? fmtTime(rk.at) : '—'}</div>
    <div>${hist ? `${fmtTime(hist.lastSeenScoreChangeAt)} (${ago(hist.lastSeenScoreChangeAt)})` : '—'}</div>
  </div>`;
}
function statusLabel(rank) { return rank === 0 ? 'LIVE/CURRENT' : rank === 1 ? 'Scheduled' : rank === 2 ? 'Final' : 'Unknown'; }
function realHref(url) { return /^https?:\/\//.test(String(url || '')) ? url : '#'; }
function escapeHtml(str) { return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(str) { return escapeHtml(str).replace(/`/g, '&#96;'); }

$('intervalText').textContent = `${DEFAULT_REFRESH_MS/1000}s`;
pollNow();
restart();
