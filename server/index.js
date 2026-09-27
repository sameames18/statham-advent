import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import {
  DAYS_IN_DECEMBER, dateIn, isUnlocked, isValidTimeZone, parseDate, seasonYear,
} from './calendar.js';

const PORT = Number(process.env.PORT ?? 4747);
const DEFAULT_TZ = process.env.DEFAULT_TZ ?? 'America/Los_Angeles';
// Preview mode lets the client pretend it's a different date (?preview= in the
// page URL). Handy outside December; switch it off (TIME_TRAVEL=0) for a real one.
const TIME_TRAVEL = process.env.TIME_TRAVEL !== '0';
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const PUBLIC_ROOT = normalize(PUBLIC_DIR.endsWith(sep) ? PUBLIC_DIR : PUBLIC_DIR + sep);

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

// "Today", in the visitor's own time zone so doors open at their midnight.
function today(req) {
  const preview = TIME_TRAVEL ? parseDate(req.headers['x-preview-date']) : null;
  if (preview) return { ...preview, preview: true };
  const tz = req.headers['x-timezone'];
  return { ...dateIn(isValidTimeZone(tz) ? tz : DEFAULT_TZ), preview: false };
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

// ---------- routes ----------

function calendar(req, res, ctx) {
  const { store } = ctx;
  const states = store.doorStates(ctx.visitor, ctx.year);
  const doors = store.days(ctx.year).map((e) => doorView(e, ctx.now, ctx.year, states.get(e.day)));
  const firstOfDecember = new Date(Date.UTC(ctx.year, 11, 1)).getUTCDay(); // 0 = Sunday
  return send(res, 200, {
    year: ctx.year,
    today: ctx.now,
    firstWeekday: firstOfDecember,
    filmCount: store.filmCount(),
    timeTravel: TIME_TRAVEL,
    stats: {
      unlocked: doors.filter((d) => d.unlocked).length,
      opened: doors.filter((d) => d.opened).length,
      watched: doors.filter((d) => d.watched).length,
    },
    doors,
  });
}

function door(req, res, ctx, day, action) {
  const { store } = ctx;
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
  ctx.store.resetVisitor(ctx.visitor, ctx.year);
  return send(res, 200, { ok: true });
}

async function api(req, res, url, store) {
  const ctx = { store, visitor: visitorId(req, res), now: today(req) };
  const yearParam = Number(url.searchParams.get('year'));
  ctx.year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : seasonYear(ctx.now);
  if (req.method === 'POST') ctx.body = await readJson(req);

  const path = url.pathname;
  if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });
  // Every film at once, for reviewing the catalog. It spoils the whole
  // calendar, so it only exists while preview mode is on.
  if (req.method === 'GET' && path === '/api/catalog' && TIME_TRAVEL) return send(res, 200, { films: store.films().map(filmDetail) });
  if (req.method === 'GET' && path === '/api/calendar') return calendar(req, res, ctx);
  if (req.method === 'POST' && path === '/api/reset') return reset(req, res, ctx);

  const m = /^\/api\/doors\/(\d{1,2})(?:\/(open|watched))?$/.exec(path);
  if (m) {
    const action = m[2];
    if ((req.method === 'GET' && !action) || (req.method === 'POST' && action)) return door(req, res, ctx, Number(m[1]), action);
  }
  return send(res, 404, { error: 'Not found' });
}

// Static files are served with validators (ETag, Last-Modified) and
// Cache-Control: no-cache, so browsers keep a copy but check it on every load.
// An unchanged file costs a 304 with no body instead of the whole file, while
// an edit is picked up on the very next load after a deploy.
async function staticFile(req, res, url) {
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = normalize(join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_ROOT)) return send(res, 403, { error: 'Forbidden' });

  let info;
  try {
    info = await stat(file);
  } catch {
    return send(res, 404, { error: 'Not found' });
  }
  if (!info.isFile()) return send(res, 404, { error: 'Not found' });

  const etag = `W/"${info.size}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const headers = {
    'Cache-Control': 'no-cache',
    ETag: etag,
    'Last-Modified': new Date(info.mtimeMs).toUTCString(),
  };
  if (isFresh(req, etag, info.mtimeMs)) {
    res.writeHead(304, headers);
    return res.end();
  }

  headers['Content-Type'] = TYPES[extname(file)] ?? 'application/octet-stream';
  if (req.method === 'HEAD') {
    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    return res.end();
  }
  let body;
  try {
    body = await readFile(file);
  } catch {
    return send(res, 404, { error: 'Not found' });
  }
  res.writeHead(200, { ...headers, 'Content-Length': body.length });
  res.end(body);
}

// Does the copy the browser holds still match? If-None-Match wins when both
// are sent (RFC 9110 §13.1.3); tags compare weakly, so W/ prefixes are ignored.
function isFresh(req, etag, mtimeMs) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const noneMatch = req.headers['if-none-match'];
  if (noneMatch !== undefined) {
    const bare = (tag) => tag.trim().replace(/^W\//, '');
    return noneMatch.trim() === '*' || noneMatch.split(',').some((tag) => bare(tag) === bare(etag));
  }
  const since = Date.parse(req.headers['if-modified-since'] ?? '');
  // Last-Modified is sent to the second, so compare at that precision.
  return !Number.isNaN(since) && Math.floor(mtimeMs / 1000) * 1000 <= since;
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

// The request handler, separate from the socket so tests can drive it on a
// port of their own (or against an in-memory database).
export function createHandler(store = openDb()) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url, store);
      else await staticFile(req, res, url);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: 'Server error' });
    }
  };
}

// Only listen when run as the program (`node server/index.js`), not when imported.
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  createServer(createHandler()).listen(PORT, () => {
    console.log(`Stathmas is running at http://localhost:${PORT}`);
    if (TIME_TRAVEL) console.log(`Preview mode is on: add ?preview=2026-12-14 to the URL to pretend it's another day.`);
  });
}
