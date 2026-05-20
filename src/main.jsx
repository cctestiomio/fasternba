import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Clock, Gauge, RefreshCw, Trophy, Zap } from 'lucide-react';
import './styles.css';

const POLL_MS = Number(import.meta.env.VITE_POLL_MS || 3000);
const SOURCES = [
  { id: 'nba', label: 'NBA CDN', endpoint: '/api/nba' },
  { id: 'espn', label: 'ESPN API', endpoint: '/api/espn' }
];

function nowIso() {
  return new Date().toISOString();
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

function secondsAgo(iso) {
  if (!iso) return '—';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  return `${(diff / 1000).toFixed(1)}s ago`;
}

function canonicalKey(game) {
  const a = String(game?.away?.short || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const h = String(game?.home?.short || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${a}-${h}`;
}

function scoreChanged(a, b) {
  if (!a || !b) return false;
  return a.away?.score !== b.away?.score || a.home?.score !== b.home?.score;
}

function statusRank(gamePair) {
  const live = gamePair.nba?.isLive || gamePair.espn?.isLive;
  const scheduled = !(gamePair.nba?.isFinal || gamePair.espn?.isFinal);
  if (live) return 0;
  if (scheduled) return 1;
  return 2;
}

function statusText(gamePair) {
  const g = gamePair.nba || gamePair.espn;
  if (gamePair.nba?.isLive || gamePair.espn?.isLive) return 'LIVE';
  if (gamePair.nba?.isFinal || gamePair.espn?.isFinal) return 'FINAL';
  return 'SCHEDULED';
}

function getLeader(history) {
  const nbaAt = history?.nba?.lastScoreChangeAt;
  const espnAt = history?.espn?.lastScoreChangeAt;
  if (!nbaAt && !espnAt) return { label: 'Waiting for score change', className: 'neutral', delta: null };
  if (nbaAt && !espnAt) return { label: 'NBA updated first', className: 'nba', delta: null };
  if (!nbaAt && espnAt) return { label: 'ESPN updated first', className: 'espn', delta: null };
  const n = new Date(nbaAt).getTime();
  const e = new Date(espnAt).getTime();
  const delta = Math.abs(n - e) / 1000;
  if (Math.abs(n - e) < 250) return { label: 'Tie / same poll', className: 'neutral', delta };
  return n < e
    ? { label: `NBA faster by ${delta.toFixed(1)}s`, className: 'nba', delta }
    : { label: `ESPN faster by ${delta.toFixed(1)}s`, className: 'espn', delta };
}

async function fetchSource(source) {
  const requestedAt = nowIso();
  const res = await fetch(`${source.endpoint}?clientTs=${Date.now()}`, { cache: 'no-store' });
  const receivedAt = nowIso();
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `${source.label} HTTP ${res.status}`);
  }
  return { ...json, requestedAt, receivedAt };
}

function App() {
  const [snapshots, setSnapshots] = useState({ nba: null, espn: null });
  const [errors, setErrors] = useState({ nba: null, espn: null });
  const [history, setHistory] = useState({});
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollAt, setLastPollAt] = useState(null);
  const [nextPollIn, setNextPollIn] = useState(POLL_MS / 1000);
  const prevGamesRef = useRef({ nba: new Map(), espn: new Map() });
  const intervalRef = useRef(null);
  const lastPollAtRef = useRef(null);
  const pollingRef = useRef(false);

  async function pollOnce() {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setIsPolling(true);
    const settled = await Promise.allSettled(SOURCES.map(fetchSource));
    const updated = {};
    const newErrors = {};

    settled.forEach((result, i) => {
      const source = SOURCES[i];
      if (result.status === 'fulfilled') {
        updated[source.id] = result.value;
        newErrors[source.id] = null;
      } else {
        newErrors[source.id] = result.reason?.message || String(result.reason);
      }
    });

    setSnapshots(prev => ({ ...prev, ...updated }));
    setErrors(prev => ({ ...prev, ...newErrors }));
    const completedAt = nowIso();
    lastPollAtRef.current = completedAt;
    setLastPollAt(completedAt);
    setNextPollIn(POLL_MS / 1000);

    setHistory(prevHistory => {
      const next = { ...prevHistory };
      for (const source of SOURCES) {
        const payload = updated[source.id];
        if (!payload?.games) continue;
        const previousMap = prevGamesRef.current[source.id] || new Map();
        const newMap = new Map();

        for (const game of payload.games) {
          const key = canonicalKey(game);
          newMap.set(key, game);
          const previous = previousMap.get(key);
          if (scoreChanged(previous, game)) {
            next[key] = {
              ...(next[key] || {}),
              [source.id]: {
                ...(next[key]?.[source.id] || {}),
                lastScoreChangeAt: payload.receivedAt,
                lastScore: `${game.away.score}-${game.home.score}`,
                changes: (next[key]?.[source.id]?.changes || 0) + 1
              }
            };
          }
        }
        prevGamesRef.current[source.id] = newMap;
      }
      return next;
    });

    pollingRef.current = false;
    setIsPolling(false);
  }

  useEffect(() => {
    pollOnce();
    intervalRef.current = setInterval(pollOnce, POLL_MS);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const countdown = setInterval(() => {
      if (!lastPollAtRef.current) return;
      const elapsed = Date.now() - new Date(lastPollAtRef.current).getTime();
      setNextPollIn(Math.max(0, (POLL_MS - elapsed) / 1000));
    }, 200);
    return () => clearInterval(countdown);
  }, []);

  const games = useMemo(() => {
    const pairs = new Map();
    for (const source of SOURCES) {
      const payload = snapshots[source.id];
      for (const game of payload?.games || []) {
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
  }, [snapshots]);

  const liveCount = games.filter(g => g.nba?.isLive || g.espn?.isLive).length;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow"><Activity size={16} /> NBA score feed race</p>
          <h1>ESPN API vs NBA CDN update speed checker</h1>
          <p className="subtext">Polls both feeds every <b>{(POLL_MS / 1000).toFixed(0)} seconds</b>, detects score changes per source, and sorts current live games first.</p>
        </div>
        <div className="statusPanel">
          <div><span>Live games</span><b>{liveCount}</b></div>
          <div><span>Last poll</span><b>{fmtTime(lastPollAt)}</b></div>
          <div><span>Next poll</span><b>{nextPollIn.toFixed(1)}s</b></div>
          <button onClick={pollOnce} disabled={isPolling}>{isPolling ? <RefreshCw className="spin" size={16} /> : <RefreshCw size={16} />} Refresh now</button>
        </div>
      </header>

      <section className="sourceGrid">
        {SOURCES.map(source => {
          const payload = snapshots[source.id];
          return (
            <article className="sourceCard" key={source.id}>
              <div className="sourceTitle"><Gauge size={18} /> {source.label}</div>
              <p>Latency: <b>{payload?.latencyMs ?? '—'} ms</b></p>
              <p>Fetched: <b>{fmtTime(payload?.receivedAt || payload?.fetchedAt)}</b></p>
              {errors[source.id] && <p className="error">{errors[source.id]}</p>}
            </article>
          );
        })}
      </section>

      <section className="games">
        {games.length === 0 && <div className="empty">No NBA games returned yet. It will keep polling every 3 seconds.</div>}
        {games.map(pair => {
          const game = pair.nba || pair.espn;
          const h = history[pair.key] || {};
          const leader = getLeader(h);
          return (
            <article className={`gameCard ${statusText(pair).toLowerCase()}`} key={pair.key}>
              <div className="gameTop">
                <div>
                  <span className={`pill ${statusText(pair).toLowerCase()}`}>{statusText(pair)}</span>
                  <h2>{game.away.name} @ {game.home.name}</h2>
                  <p className="gameMeta"><Clock size={15} /> {game.status} {game.clock ? `• ${game.clock}` : ''} {game.period ? `• P${game.period}` : ''}</p>
                </div>
                <div className={`winner ${leader.className}`}><Trophy size={16} /> {leader.label}</div>
              </div>

              <div className="compareGrid">
                {SOURCES.map(source => {
                  const g = pair[source.id];
                  const sourceHistory = h[source.id] || {};
                  return (
                    <div className="scoreBox" key={source.id}>
                      <div className="boxHeader"><span>{source.label}</span><Zap size={15} /></div>
                      {g ? (
                        <>
                          <div className="scoreLine"><span>{g.away.short}</span><b>{g.away.score}</b></div>
                          <div className="scoreLine"><span>{g.home.short}</span><b>{g.home.score}</b></div>
                          <div className="smallRows">
                            <p>Last score change: <b>{fmtTime(sourceHistory.lastScoreChangeAt)}</b></p>
                            <p>Changed: <b>{sourceHistory.changes || 0}x</b></p>
                            <p>Seen: <b>{secondsAgo(snapshots[source.id]?.receivedAt)}</b></p>
                          </div>
                        </>
                      ) : <p className="missing">Not returned by this source.</p>}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>

      <footer>
        Tip: leave this open during a live game. The first detected score change per feed is timestamped locally when your Vercel proxy receives it.
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
