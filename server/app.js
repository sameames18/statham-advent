import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  DAYS_IN_DECEMBER, dateIn, isUnlocked, isValidTimeZone, parseDate, seasonYear,
} from './calendar.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// ---------- request context ----------

function visitorId(req, res) {
  const match = /(?:^|;\s*)visitor=([0-9a-f-]{36})/.exec(req.headers.cookie ?? '');
  if (match) return match[1];
  const id = randomUUID();
  res.setHeader('Set-Cookie', `visitor=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
  return id;
}

// ---------- views ----------

const filmSummary = ({ slug, title, year, hue, character }) => ({ slug, title, year, hue, character });

function filmDetail(film) {
  const { id, wiki, ...rest } = film;
  return { ...rest, wikipedia: wiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki)}` : null };
}

function doorView(entry, now, year, state) {
  const unlocked = isUnlocked(year, entry.day, now);
  const opened = unlocked && !!state;
  return {
    day: entry.day,
    unlocked,
    isToday: now.year === year && now.month === 12 && now.day === entry.day,
    opened,
    watched: opened && !!state.watchedAt,
    encore: opened ? entry.encore : undefined,
    // Nothing about a film leaves the server until its door is opened.
    film: opened ? filmSummary(entry.film) : null,
  };
}

// ---------- plumbing ----------

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) break;
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Build the request handler for `http.createServer`. `store` comes from
// `openDb()`; the options default to what the real server uses, and tests
// pass their own.
export function createHandler(store, {
  defaultTz = 'America/Los_Angeles',
  // Preview mode lets the client pretend it's a different date (?preview= in the
  // page URL). Handy outside December; switch it off (TIME_TRAVEL=0) for a real one.
  timeTravel = true,
  publicDir = DEFAULT_PUBLIC_DIR,
} = {}) {
  const publicRoot = normalize(publicDir.endsWith(sep) ? publicDir : publicDir + sep);

  // "Today", in the visitor's own time zone so doors open at their midnight.
  function today(req) {
    const preview = timeTravel ? parseDate(req.headers['x-preview-date']) : null;
    if (preview) return { ...preview, preview: true };
    const tz = req.headers['x-timezone'];
    return { ...dateIn(isValidTimeZone(tz) ? tz : defaultTz), preview: false };
  }

  // ---------- routes ----------

  function calendar(req, res, ctx) {
    const states = store.doorStates(ctx.visitor, ctx.year);
    const doors = store.days(ctx.year).map((e) => doorView(e, ctx.now, ctx.year, states.get(e.day)));
    const firstOfDecember = new Date(Date.UTC(ctx.year, 11, 1)).getUTCDay(); // 0 = Sunday
    return send(res, 200, {
      year: ctx.year,
      today: ctx.now,
      firstWeekday: firstOfDecember,
      filmCount: store.filmCount(),
      timeTravel,
      stats: {
        unlocked: doors.filter((d) => d.unlocked).length,
        opened: doors.filter((d) => d.opened).length,
        watched: doors.filter((d) => d.watched).length,
      },
      doors,
    });
  }

  function door(req, res, ctx, day, action) {
    if (!Number.isInteger(day) || day < 1 || day > DAYS_IN_DECEMBER) return send(res, 404, { error: 'No such door' });
    if (!isUnlocked(ctx.year, day, ctx.now)) {
      return send(res, 403, { error: 'Too early', message: `Door ${day} opens on December ${day}.` });
    }
    if (action === 'open') store.open(ctx.visitor, ctx.year, day);
    if (action === 'watched') {
      store.open(ctx.visitor, ctx.year, day);
      store.setWatched(ctx.visitor, ctx.year, day, ctx.body?.watched !== false);
    }
    const entry = store.days(ctx.year).find((e) => e.day === day);
    const state = store.doorStates(ctx.visitor, ctx.year).get(day);
    if (!state) return send(res, 403, { error: 'Not opened', message: 'Open the door first.' });
    return send(res, 200, { ...doorView(entry, ctx.now, ctx.year, state), film: filmDetail(entry.film) });
  }

  function reset(req, res, ctx) {
    store.resetVisitor(ctx.visitor, ctx.year);
    return send(res, 200, { ok: true });
  }

  async function api(req, res, url) {
    const ctx = { visitor: visitorId(req, res), now: today(req) };
    const yearParam = Number(url.searchParams.get('year'));
    ctx.year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : seasonYear(ctx.now);
    if (req.method === 'POST') ctx.body = await readJson(req);

    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });
    // Every film at once, for reviewing the catalog. It spoils the whole
    // calendar, so it only exists while preview mode is on.
    if (req.method === 'GET' && path === '/api/catalog' && timeTravel) return send(res, 200, { films: store.films().map(filmDetail) });
    if (req.method === 'GET' && path === '/api/calendar') return calendar(req, res, ctx);
    if (req.method === 'POST' && path === '/api/reset') return reset(req, res, ctx);

    const m = /^\/api\/doors\/(\d{1,2})(?:\/(open|watched))?$/.exec(path);
    if (m) {
      const action = m[2];
      if ((req.method === 'GET' && !action) || (req.method === 'POST' && action)) return door(req, res, ctx, Number(m[1]), action);
    }
    return send(res, 404, { error: 'Not found' });
  }

  async function staticFile(req, res, url) {
    let rel;
    try {
      rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    } catch {
      // A malformed percent-escape like /%ZZ is the client's fault, not ours.
      return send(res, 400, { error: 'Bad request' });
    }
    const file = normalize(join(publicDir, rel));
    if (!file.startsWith(publicRoot)) return send(res, 403, { error: 'Forbidden' });
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      send(res, 404, { error: 'Not found' });
    }
  }

  return async function handler(req, res) {
    try {
      // Node's HTTP parser accepts request targets the URL parser rejects
      // (e.g. `GET //[`), so this can throw; it must stay inside the try or
      // the rejected promise takes the whole process down.
      let url;
      try {
        url = new URL(req.url, 'http://localhost');
      } catch {
        return send(res, 400, { error: 'Bad request' });
      }
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else await staticFile(req, res, url);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: 'Server error' });
    }
  };
}
