import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DAYS_IN_DECEMBER, dateIn, isUnlocked, isValidTimeZone, parseDate, seasonYear,
} from './calendar.js';
import {
  NONE, isOpened, isWatched, marksCookie, readMarks, withOpened, withWatched,
} from './marks.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

// Sent with every response, static or API.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// The years the API will answer for, whether asked with ?year= or implied
// by a preview date.
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const inRange = (year) => Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;

// ---------- views ----------

const filmSummary = ({ slug, title, year, character }) => ({ slug, title, year, character });

function filmDetail(film) {
  // The box office figure and the v1 poster colour stay in the catalog but are not part of the site.
  const { wiki, gross, hue, ...rest } = film;
  return { ...rest, wikipedia: wiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki)}` : null };
}

function doorView(entry, now, year, marks) {
  const unlocked = isUnlocked(year, entry.day, now);
  const opened = unlocked && isOpened(marks, entry.day);
  return {
    day: entry.day,
    unlocked,
    isToday: now.year === year && now.month === 12 && now.day === entry.day,
    opened,
    watched: opened && isWatched(marks, entry.day),
    encore: opened ? entry.encore : undefined,
    // Nothing about a film leaves the server until its door is opened.
    film: opened ? filmSummary(entry.film) : null,
  };
}

// ---------- plumbing ----------

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

function send(res, status, body, done) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body), done);
}

const MAX_BODY_BYTES = 10_000;

// Collect the body as bytes and decode it once at the end: appending chunks to
// a string would mangle a multi-byte character split across two chunks. An
// empty or malformed body is tolerated as {}. A body over the limit is answered
// with 413 here and the stream destroyed; the caller gets undefined and stops.
async function readJson(req, res) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      await new Promise((resolve) => send(res, 413, { error: 'Body too large' }, resolve));
      req.destroy();
      return undefined;
    }
    chunks.push(chunk);
  }
  try {
    return size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    return {};
  }
}

// Build the request handler for `http.createServer`. `catalog` comes from
// `loadCatalog()`; the options are what server/config.js reads from the
// environment, and tests pass their own.
export function createHandler(catalog, {
  defaultTz = 'America/Los_Angeles',
  // Preview mode: the client may pretend it's another date (X-Preview-Date).
  timeTravel = false,
  // Mark the door cookies Secure (HTTPS only).
  secureCookies = false,
  // Serve public/ as well as the API. Vercel serves the files itself.
  serveStatic = true,
  publicDir = DEFAULT_PUBLIC_DIR,
  // The real time; tests pass a fixed one.
  clock = () => new Date(),
} = {}) {
  const publicRoot = normalize(publicDir.endsWith(sep) ? publicDir : publicDir + sep);

  // "Today", in the visitor's own time zone so doors open at their midnight.
  function today(req) {
    const preview = timeTravel ? parseDate(req.headers['x-preview-date']) : null;
    if (preview && inRange(preview.year)) return { ...preview, preview: true };
    const tz = req.headers['x-timezone'];
    return { ...dateIn(isValidTimeZone(tz) ? tz : defaultTz, clock()), preview: false };
  }

  // ---------- routes ----------

  function calendar(req, res, ctx) {
    const doors = catalog.days(ctx.year).map((e) => doorView(e, ctx.now, ctx.year, ctx.marks));
    return send(res, 200, {
      year: ctx.year,
      today: ctx.now,
      doors,
    });
  }

  function door(req, res, ctx, day, action) {
    if (!Number.isInteger(day) || day < 1 || day > DAYS_IN_DECEMBER) return send(res, 404, { error: 'No such door' });
    if (!isUnlocked(ctx.year, day, ctx.now)) {
      return send(res, 403, { error: 'Too early', message: `Door ${day} opens on December ${day}.` });
    }
    let { marks } = ctx;
    if (action === 'open') marks = withOpened(marks, day);
    if (action === 'watched') marks = withWatched(marks, day, ctx.body?.watched !== false);
    if (action) res.setHeader('Set-Cookie', marksCookie(ctx.year, marks, secureCookies));
    if (!isOpened(marks, day)) return send(res, 403, { error: 'Not opened', message: 'Open the door first.' });
    const entry = catalog.day(ctx.year, day);
    return send(res, 200, { ...doorView(entry, ctx.now, ctx.year, marks), film: filmDetail(entry.film) });
  }

  function reset(req, res, ctx) {
    res.setHeader('Set-Cookie', marksCookie(ctx.year, NONE, secureCookies));
    return send(res, 200, { ok: true });
  }

  async function api(req, res, url) {
    const ctx = { now: today(req) };
    const yearParam = Number(url.searchParams.get('year'));
    ctx.year = url.searchParams.has('year') && inRange(yearParam) ? yearParam : seasonYear(ctx.now);
    ctx.marks = readMarks(req.headers.cookie, ctx.year);
    if (req.method === 'POST') {
      ctx.body = await readJson(req, res);
      if (ctx.body === undefined) return; // 413 already sent
    }

    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });
    // Every film at once, for reviewing the catalog. It spoils the whole
    // calendar, so it only exists while preview mode is on.
    if (req.method === 'GET' && path === '/api/catalog' && timeTravel) return send(res, 200, { films: catalog.films().map(filmDetail) });
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
  // Cache-Control: no-cache, so browsers keep a copy but check it on every
  // load. An unchanged file costs a 304 with no body instead of the whole
  // file, while an edit is picked up on the very next load after a deploy.
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

    let info;
    try {
      info = await stat(file);
    } catch {
      return send(res, 404, { error: 'Not found' });
    }
    if (!info.isFile()) return send(res, 404, { error: 'Not found' });

    const etag = `W/"${info.size}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      ...SECURITY_HEADERS,
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
      else if (serveStatic) await staticFile(req, res, url);
      else send(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: 'Server error' });
    }
  };
}
