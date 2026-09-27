import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { statSync } from 'node:fs';
import { createHandler } from '../server/app.js';
import { loadCatalog } from '../server/catalog.js';

const catalog = loadCatalog({ secret: 'a test secret, not the real one' });
let server;
let port;
let base;

before(async () => {
  server = createServer(createHandler(catalog, { timeTravel: true }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
});

// Send whatever bytes we like, bypassing http.request's own URL validation.
function rawRequest(requestLine) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    let data = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.end(`${requestLine} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`));
    socket.on('data', (chunk) => { data += chunk; });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('a request target the URL parser rejects gets a 400, and the server survives', async () => {
  const raw = await rawRequest('GET //[');
  const [head, body] = raw.split('\r\n\r\n');
  assert.equal(head.split('\r\n')[0], 'HTTP/1.1 400 Bad Request');
  // The body arrives chunked; the JSON is the one line that starts with a brace.
  assert.deepEqual(JSON.parse(body.split('\r\n').find((line) => line.startsWith('{'))), { error: 'Bad request' });

  const health = await get('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.body), { ok: true });
});

test('a malformed percent-escape in a static path gets a 400', async () => {
  const res = await get('/%ZZ');
  assert.equal(res.status, 400);
  assert.deepEqual(JSON.parse(res.body), { error: 'Bad request' });
});

test('a door that has not unlocked yet returns 403', async () => {
  // Door 25 of the 2100 calendar stays locked for the rest of our lifetimes.
  const res = await get('/api/doors/25?year=2100');
  assert.equal(res.status, 403);
  assert.equal(JSON.parse(res.body).error, 'Too early');
});

test('every response carries the security headers', async () => {
  for (const path of ['/api/health', '/', '/styles.css', '/no-such-file', '/api/no-such-route']) {
    const res = await get(path);
    assert.equal(res.headers['x-content-type-options'], 'nosniff', path);
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin', path);
  }
});

test('the door cookie is Secure only when the handler is told to', async () => {
  const openOne = (p) => new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port: p, path: '/api/doors/1/open', method: 'POST', headers: { 'X-Preview-Date': '2026-12-14' } }, (r) => {
      r.resume();
      r.on('end', () => resolve(r));
    }).on('error', reject).end();
  });
  const plain = await openOne(port);
  assert.match(plain.headers['set-cookie'][0], /^stathmas-2026=1\.0; Path=\/; Max-Age=34560000; HttpOnly; SameSite=Lax$/);

  const secure = createServer(createHandler(catalog, { timeTravel: true, secureCookies: true }));
  secure.listen(0, '127.0.0.1');
  await once(secure, 'listening');
  try {
    const res = await openOne(secure.address().port);
    assert.match(res.headers['set-cookie'][0], /; SameSite=Lax; Secure$/);
  } finally {
    secure.close();
    await once(secure, 'close');
  }
});

// ---------- static files and caching ----------

const fetchGet = (path, headers = {}) => fetch(base + path, { headers });

test('a first GET of a static file sends the file with validators and no-cache', async () => {
  const res = await fetchGet('/js/app.js');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  assert.match(res.headers.get('etag'), /^W\/"\d+-[0-9a-f]+"$/);
  assert.ok(!Number.isNaN(Date.parse(res.headers.get('last-modified'))), 'Last-Modified is an HTTP date');
  const size = statSync(new URL('../public/js/app.js', import.meta.url)).size;
  assert.equal(Number(res.headers.get('content-length')), size);
  assert.equal((await res.arrayBuffer()).byteLength, size);
});

test('a second GET with If-None-Match set to that ETag gets a 304 with no body', async () => {
  const first = await fetchGet('/styles.css');
  const etag = first.headers.get('etag');
  await first.arrayBuffer();

  const again = await fetchGet('/styles.css', { 'If-None-Match': etag });
  assert.equal(again.status, 304);
  assert.equal(again.headers.get('etag'), etag);
  assert.equal(again.headers.get('cache-control'), 'no-cache');
  assert.equal((await again.arrayBuffer()).byteLength, 0);
});

test('a stale ETag gets the whole file again', async () => {
  const res = await fetchGet('/styles.css', { 'If-None-Match': 'W/"1-abc"' });
  assert.equal(res.status, 200);
  assert.ok((await res.arrayBuffer()).byteLength > 0);
});

test('a strong tag with the same value still matches, and a list of tags is searched', async () => {
  const first = await fetchGet('/');
  const etag = first.headers.get('etag');
  await first.arrayBuffer();
  const strong = etag.replace(/^W\//, '');
  const res = await fetchGet('/', { 'If-None-Match': `"nope", ${strong}` });
  assert.equal(res.status, 304);
});

test('If-Modified-Since is honoured when there is no If-None-Match', async () => {
  const first = await fetchGet('/js/scene.js');
  const lastModified = first.headers.get('last-modified');
  await first.arrayBuffer();

  const fresh = await fetchGet('/js/scene.js', { 'If-Modified-Since': lastModified });
  assert.equal(fresh.status, 304);
  assert.equal((await fresh.arrayBuffer()).byteLength, 0);

  const stale = await fetchGet('/js/scene.js', { 'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT' });
  assert.equal(stale.status, 200);
  await stale.arrayBuffer();

  const junk = await fetchGet('/js/scene.js', { 'If-Modified-Since': 'not a date' });
  assert.equal(junk.status, 200);
  await junk.arrayBuffer();
});

test('HEAD sends the same headers and no body', async () => {
  const res = await fetch(base + '/js/app.js', { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('etag'), /^W\/"\d+-[0-9a-f]+"$/);
  const size = statSync(new URL('../public/js/app.js', import.meta.url)).size;
  assert.equal(Number(res.headers.get('content-length')), size);
  assert.equal((await res.arrayBuffer()).byteLength, 0);

  const cached = await fetch(base + '/js/app.js', { method: 'HEAD', headers: { 'If-None-Match': res.headers.get('etag') } });
  assert.equal(cached.status, 304);
});

// ---------- link-preview thumbnail ----------

const ogImage = (html) => /<meta property="og:image" content="([^"]*)">/.exec(html)?.[1];

test('the thumbnail is served as a JPEG', async () => {
  const res = await fetchGet('/og.jpg');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xff, 0xd8, 0xff], 'starts with the JPEG signature');
});

test('without SITE_URL the page points at the thumbnail root-relative', async () => {
  const html = await (await fetchGet('/')).text();
  assert.equal(ogImage(html), '/og.jpg');
  assert.match(html, /<meta name="twitter:card" content="summary">/);
  assert.equal(html.includes('%SITE_URL%'), false);
});

test('with SITE_URL the page points at the thumbnail absolutely, with lengths and ETag to match', async () => {
  const site = createServer(createHandler(catalog, { timeTravel: true, siteUrl: 'https://stathmas.example.com' }));
  site.listen(0, '127.0.0.1');
  await once(site, 'listening');
  const at = `http://127.0.0.1:${site.address().port}`;
  try {
    for (const path of ['/', '/index.html']) {
      const res = await fetch(at + path);
      const body = Buffer.from(await res.arrayBuffer());
      assert.equal(ogImage(body.toString('utf8')), 'https://stathmas.example.com/og.jpg', path);
      assert.equal(Number(res.headers.get('content-length')), body.length, path);

      const head = await fetch(at + path, { method: 'HEAD' });
      assert.equal(Number(head.headers.get('content-length')), body.length, `HEAD ${path}`);

      // A cached copy from before SITE_URL was set must not be answered with a 304.
      const plain = await fetchGet(path);
      await plain.arrayBuffer();
      assert.notEqual(res.headers.get('etag'), plain.headers.get('etag'), path);
    }
  } finally {
    site.close();
    await once(site, 'close');
  }
});

test('missing files, directories and paths outside public/ are still refused', async () => {
  assert.equal((await fetchGet('/nope.js')).status, 404);
  assert.equal((await fetchGet('/js')).status, 404);
  assert.equal((await fetchGet('/js/')).status, 404);
  assert.equal((await fetchGet('/..%2f..%2fpackage.json')).status, 403);
});

// ---------- the API as the page uses it ----------

// A full request: method, headers and JSON body in, status, headers and parsed
// body out. `on` picks the server; the default is the shared preview-on one.
function call(path, { method = 'GET', headers = {}, body, on = () => port } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = request({
      host: '127.0.0.1',
      port: on(),
      path,
      method,
      headers: payload ? { ...headers, 'Content-Type': 'application/json' } : headers,
      // One socket per request. The 413 path destroys its socket, and a
      // pooled keep-alive connection would hand that dead socket to the
      // next request.
      agent: false,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json;
        try { json = JSON.parse(raw); } catch { json = undefined; }
        resolve({ status: res.statusCode, headers: res.headers, raw, json });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

// A visitor: a cookie jar of one, plus a fixed preview date so the calendar
// is the same whatever day the tests run. Doors 1 to 14 are unlocked.
const PREVIEW = '2026-12-14';
function visitor(preview = PREVIEW) {
  let cookie;
  return async (path, opts = {}) => {
    const headers = { ...(opts.headers ?? {}) };
    if (preview) headers['X-Preview-Date'] = preview;
    if (cookie) headers.Cookie = cookie;
    const res = await call(path, { ...opts, headers });
    const set = res.headers['set-cookie']?.[0];
    if (set) cookie = set.split(';')[0];
    return res;
  };
}

const count = (doors, key) => doors.filter((d) => d[key]).length;

test('/api/health answers', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ok: true });
  assert.match(res.headers['content-type'], /^application\/json/);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('the calendar carries no film data for locked or unopened doors', async () => {
  const me = visitor();
  const res = await me('/api/calendar');
  assert.equal(res.status, 200);
  assert.equal(res.json.year, 2026);
  assert.deepEqual(res.json.today, { year: 2026, month: 12, day: 14, preview: true });
  assert.equal(res.json.doors.length, 31);

  const unlocked = res.json.doors.filter((d) => d.unlocked).map((d) => d.day);
  assert.deepEqual(unlocked, Array.from({ length: 14 }, (_, i) => i + 1));
  for (const d of res.json.doors) {
    assert.equal(d.opened, false, `door ${d.day}`);
    assert.equal(d.film, null, `door ${d.day} leaks a film`);
    assert.equal(d.encore, undefined, `door ${d.day} leaks whether it is an encore`);
  }
  assert.equal(res.raw.includes('"title"'), false, 'no title anywhere in the payload');
  assert.equal(res.json.doors.find((d) => d.day === 14).isToday, true);
  assert.equal(count(res.json.doors, 'isToday'), 1);
});

test('reading never sets a cookie; only opening, marking and reset do', async () => {
  for (const path of ['/api/health', '/api/calendar', '/api/doors/7', '/api/doors/20']) {
    const res = await call(path, { headers: { 'X-Preview-Date': PREVIEW } });
    assert.equal(res.headers['set-cookie'], undefined, path);
  }
  // A refused open writes nothing either.
  const early = await call('/api/doors/20/open', { method: 'POST', headers: { 'X-Preview-Date': PREVIEW } });
  assert.equal(early.status, 403);
  assert.equal(early.headers['set-cookie'], undefined);
});

test('the doors live in the cookie: its marks are read back, junk is ignored', async () => {
  const cal = (cookie) => call('/api/calendar', { headers: { 'X-Preview-Date': PREVIEW, Cookie: cookie } });
  // Doors 1 and 3 open (0b101), door 3 seen (0b100).
  let res = await cal('stathmas-2026=5.4');
  assert.deepEqual(res.json.doors.filter((d) => d.opened).map((d) => d.day), [1, 3]);
  assert.deepEqual(res.json.doors.filter((d) => d.watched).map((d) => d.day), [3]);

  // "Seen" without "opened" is dropped, and so is anything unparseable.
  res = await cal('stathmas-2026=1.6');
  assert.deepEqual(res.json.doors.filter((d) => d.watched).map((d) => d.day), []);
  for (const junk of ['stathmas-2026=zz.1', 'stathmas-2026=', 'stathmas-2026=123456789.0', 'stathmas-2026']) {
    res = await cal(junk);
    assert.equal(res.status, 200, junk);
    assert.equal(count(res.json.doors, 'opened'), 0, junk);
  }
  // Another year's cookie doesn't count for this one.
  res = await cal('stathmas-2025=7fffffff.0');
  assert.equal(count(res.json.doors, 'opened'), 0);
});

test('a forged cookie cannot open a door before its date', async () => {
  // Every bit set: all 31 doors claim to be open, but it is only the 14th.
  const cookie = 'stathmas-2026=7fffffff.7fffffff';
  const cal = await call('/api/calendar', { headers: { 'X-Preview-Date': PREVIEW, Cookie: cookie } });
  assert.deepEqual(cal.json.doors.filter((d) => d.opened).map((d) => d.day), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.ok(cal.json.doors.slice(14).every((d) => d.film === null));
  const door = await call('/api/doors/20', { headers: { 'X-Preview-Date': PREVIEW, Cookie: cookie } });
  assert.equal(door.status, 403);
  assert.equal(door.raw.includes('"title"'), false);
});

test('a preview date outside 2000-2100 is ignored, like any malformed one', async () => {
  for (const date of ['9999-12-01', '0001-12-01', '1999-12-31', '2101-01-01']) {
    const res = await call('/api/calendar', { headers: { 'X-Preview-Date': date } });
    assert.equal(res.json.today.preview, false, date);
  }
  const edge = await call('/api/calendar', { headers: { 'X-Preview-Date': '2100-12-31' } });
  assert.equal(edge.json.today.preview, true);
});

test('the same secret always draws the same calendar; a different one does not', async () => {
  const me = visitor();
  const titles = [];
  for (const day of [1, 2, 3]) titles.push((await me(`/api/doors/${day}/open`, { method: 'POST' })).json.film.slug);
  assert.deepEqual(titles, [1, 2, 3].map((d) => catalog.day(2026, d).film.slug));
  const other = loadCatalog({ secret: 'some other secret entirely' });
  assert.notDeepEqual(other.days(2026).map((d) => d.film.slug), catalog.days(2026).map((d) => d.film.slug));
});

test('a locked door refuses GET and POST open with 403', async () => {
  const me = visitor();
  const get20 = await me('/api/doors/20');
  assert.equal(get20.status, 403);
  assert.equal(get20.json.error, 'Too early');
  assert.equal(get20.raw.includes('"title"'), false);

  const open20 = await me('/api/doors/20/open', { method: 'POST' });
  assert.equal(open20.status, 403);
  assert.equal(open20.json.error, 'Too early');

  const cal = await me('/api/calendar');
  assert.equal(cal.json.doors.find((d) => d.day === 20).opened, false);
  assert.equal(count(cal.json.doors, 'opened'), 0);
});

test('an unlocked door that has not been opened does not give up its film either', async () => {
  const me = visitor();
  const res = await me('/api/doors/7');
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'Not opened');
  assert.equal(res.raw.includes('"title"'), false);
});

test('opening an unlocked door returns the film and the calendar then shows it opened', async () => {
  const me = visitor();
  const opened = await me('/api/doors/7/open', { method: 'POST' });
  assert.equal(opened.status, 200);
  assert.equal(opened.json.day, 7);
  assert.equal(opened.json.opened, true);
  assert.equal(opened.json.watched, false);
  const { film } = opened.json;
  for (const key of ['slug', 'title', 'year', 'director', 'runtime', 'character', 'logline', 'note', 'wikipedia']) {
    assert.ok(key in film, `film detail has ${key}`);
  }
  assert.ok(film.title.length > 0);
  for (const key of ['id', 'wiki', 'gross', 'hue']) assert.equal(key in film, false, `${key} stays inside`);
  assert.match(film.wikipedia, /^https:\/\/en\.wikipedia\.org\/wiki\//);

  const again = await me('/api/doors/7');
  assert.equal(again.status, 200);
  assert.deepEqual(again.json.film, film);

  const cal = await me('/api/calendar');
  const door = cal.json.doors.find((d) => d.day === 7);
  assert.equal(door.opened, true);
  assert.equal(door.encore, false);
  assert.deepEqual(door.film, { slug: film.slug, title: film.title, year: film.year, character: film.character });
  assert.equal(count(cal.json.doors, 'opened'), 1);
  assert.equal(cal.json.doors.filter((d) => d.film).length, 1, 'only the opened door has a film');

  const someoneElse = await visitor()('/api/calendar');
  assert.equal(count(someoneElse.json.doors, 'opened'), 0, 'another visitor sees their own closed doors');
});

test('watched toggles on and off', async () => {
  const me = visitor();
  await me('/api/doors/3/open', { method: 'POST' });

  const on = await me('/api/doors/3/watched', { method: 'POST', body: {} });
  assert.equal(on.status, 200);
  assert.equal(on.json.watched, true);
  let cal = await me('/api/calendar');
  assert.equal(cal.json.doors.find((d) => d.day === 3).watched, true);
  assert.equal(count(cal.json.doors, 'watched'), 1);

  const off = await me('/api/doors/3/watched', { method: 'POST', body: { watched: false } });
  assert.equal(off.status, 200);
  assert.equal(off.json.watched, false);
  assert.equal(off.json.opened, true, 'unwatching does not close the door');
  cal = await me('/api/calendar');
  assert.equal(cal.json.doors.find((d) => d.day === 3).watched, false);
  assert.equal(count(cal.json.doors, 'watched'), 0);

  // Marking an unopened door watched opens it too.
  const straight = await me('/api/doors/4/watched', { method: 'POST', body: { watched: true } });
  assert.equal(straight.status, 200);
  assert.equal(straight.json.opened, true);
  assert.equal(straight.json.watched, true);
});

test('reset closes all of this visitor\'s doors and nobody else\'s', async () => {
  const me = visitor();
  const other = visitor();
  await me('/api/doors/1/open', { method: 'POST' });
  await me('/api/doors/2/watched', { method: 'POST', body: {} });
  await other('/api/doors/1/open', { method: 'POST' });

  const res = await me('/api/reset', { method: 'POST' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ok: true });

  const mine = await me('/api/calendar');
  assert.equal(count(mine.json.doors, 'opened'), 0);
  assert.ok(mine.json.doors.every((d) => d.film === null));
  const theirs = await other('/api/calendar');
  assert.equal(count(theirs.json.doors, 'opened'), 1);
});

test('a malformed or oversized POST body is handled', async () => {
  const me = visitor();
  // Junk is read as {}, so this marks the door watched.
  const junk = await me('/api/doors/5/watched', { method: 'POST', body: '{not json' });
  assert.equal(junk.status, 200);
  assert.equal(junk.json.watched, true);

  const huge = await me('/api/doors/5/watched', { method: 'POST', body: { pad: 'x'.repeat(20_000) } });
  assert.equal(huge.status, 413);
  assert.deepEqual(huge.json, { error: 'Body too large' });
});

test('unknown doors and routes are 404', async () => {
  const me = visitor();
  assert.equal((await me('/api/doors/0')).status, 404);
  assert.equal((await me('/api/doors/32')).status, 404);
  assert.equal((await me('/api/doors/7/eat', { method: 'POST' })).status, 404);
  assert.equal((await me('/api/doors/7', { method: 'POST' })).status, 404);
  assert.equal((await me('/api/nothing')).status, 404);
});

test('static paths cannot climb out of public/', async () => {
  // A file that exists outside public/, and a string only it contains.
  const source = 'export function createHandler';
  for (const path of ['/../server/app.js', '/%2e%2e/server/app.js', '/..%2fserver/app.js', '/..%2f..%2fserver/app.js', '/%2e%2e%2fserver%2fapp.js']) {
    const res = await call(path);
    assert.ok([403, 404].includes(res.status), `${path} answered ${res.status}`);
    assert.equal(res.raw.includes(source), false, `${path} served the file`);
  }
  // The URL parser folds a plain `..` away, so those two come back as a
  // missing file inside public/. An encoded slash survives parsing and is
  // the one that reaches the directory check, which refuses it outright.
  assert.equal((await call('/..%2fserver/app.js')).status, 403);
});

test('/api/catalog lists every film while preview is on', async () => {
  const res = await call('/api/catalog');
  assert.equal(res.status, 200);
  assert.equal(res.json.films.length, catalog.films().length);
  assert.ok(res.json.films.every((f) => f.title && !('id' in f)));
});

test('with preview off, /api/catalog is 404 and X-Preview-Date is ignored', async () => {
  const strict = createServer(createHandler(catalog, { timeTravel: false }));
  strict.listen(0, '127.0.0.1');
  await once(strict, 'listening');
  const on = () => strict.address().port;
  try {
    const catalog = await call('/api/catalog', { on });
    assert.equal(catalog.status, 404);
    assert.deepEqual(catalog.json, { error: 'Not found' });

    // Door 31 of 2100 with a preview date that would unlock it: still locked.
    const door = await call('/api/doors/31/open?year=2100', { method: 'POST', on, headers: { 'X-Preview-Date': '2100-12-31' } });
    assert.equal(door.status, 403);
    assert.equal(door.json.error, 'Too early');

    const cal = await call('/api/calendar', { on, headers: { 'X-Preview-Date': '2100-12-31' } });
    assert.equal(cal.json.today.preview, false);
    assert.notEqual(cal.json.today.year, 2100);
  } finally {
    strict.closeAllConnections();
    strict.close();
    await once(strict, 'close');
  }
});

test('with serveStatic off (as on Vercel), only the API answers', async () => {
  const apiOnly = createServer(createHandler(catalog, { timeTravel: true, serveStatic: false }));
  apiOnly.listen(0, '127.0.0.1');
  await once(apiOnly, 'listening');
  const on = () => apiOnly.address().port;
  try {
    assert.equal((await call('/api/health', { on })).status, 200);
    for (const path of ['/', '/index.html', '/js/app.js']) {
      const res = await call(path, { on });
      assert.equal(res.status, 404, path);
      assert.deepEqual(res.json, { error: 'Not found' });
    }
  } finally {
    apiOnly.closeAllConnections();
    apiOnly.close();
    await once(apiOnly, 'close');
  }
});
