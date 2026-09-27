import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { openDb } from '../server/db.js';
import { createHandler } from '../server/app.js';

let store;
let server;
let port;

before(async () => {
  store = openDb(':memory:');
  server = createServer(createHandler(store, { timeTravel: true }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
});

after(async () => {
  server.close();
  store.close();
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
      res.on('end', () => resolve({ status: res.statusCode, body }));
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

// ---------- the API as the page uses it ----------

// A full request: method, headers and JSON body in, status, headers and parsed
// body out. `port` defaults to the shared preview-on server.
function call(path, { method = 'GET', headers = {}, body, on = () => port } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request({
      host: '127.0.0.1',
      port: on(),
      path,
      method,
      headers: payload ? { ...headers, 'Content-Type': 'application/json' } : headers,
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

test('/api/health answers', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ok: true });
  assert.match(res.headers['content-type'], /^application\/json/);
});

test('the calendar carries no film data for locked or unopened doors', async () => {
  const me = visitor();
  const res = await me('/api/calendar');
  assert.equal(res.status, 200);
  assert.equal(res.json.doors.length, 31);
  assert.deepEqual(res.json.today, { year: 2026, month: 12, day: 14, preview: true });

  const unlocked = res.json.doors.filter((d) => d.unlocked).map((d) => d.day);
  assert.deepEqual(unlocked, Array.from({ length: 14 }, (_, i) => i + 1));
  for (const d of res.json.doors) {
    assert.equal(d.opened, false, `door ${d.day}`);
    assert.equal(d.film, null, `door ${d.day} leaks a film`);
    assert.equal(d.encore, undefined, `door ${d.day} leaks whether it is an encore`);
  }
  assert.equal(JSON.stringify(res.json).includes('"title"'), false, 'no title anywhere in the payload');
  assert.deepEqual(res.json.stats, { unlocked: 14, opened: 0, watched: 0 });
  assert.equal(res.json.doors.find((d) => d.day === 14).isToday, true);
});

test('a visitor cookie is issued once and honoured on the next request', async () => {
  const first = await call('/api/calendar');
  const set = first.headers['set-cookie'];
  assert.equal(set?.length, 1);
  assert.match(set[0], /^visitor=[0-9a-f-]{36}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax$/);
  const cookie = set[0].split(';')[0];

  const second = await call('/api/calendar', { headers: { Cookie: cookie } });
  assert.equal(second.status, 200);
  assert.equal(second.headers['set-cookie'], undefined, 'a known visitor is not issued another cookie');

  // A cookie that is not a visitor id is ignored and replaced.
  const bogus = await call('/api/calendar', { headers: { Cookie: 'visitor=not-a-uuid' } });
  assert.equal(bogus.headers['set-cookie']?.length, 1);
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
  assert.equal(cal.json.stats.opened, 0);
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
  for (const key of ['slug', 'title', 'year', 'director', 'runtime', 'character', 'hue', 'logline', 'note', 'wikipedia']) {
    assert.ok(key in film, `film detail has ${key}`);
  }
  assert.ok(film.title.length > 0);
  assert.equal('id' in film, false, 'the database id stays inside');
  assert.equal('wiki' in film, false, 'the raw wiki slug is turned into a link');
  assert.match(film.wikipedia, /^https:\/\/en\.wikipedia\.org\/wiki\//);

  const again = await me('/api/doors/7');
  assert.equal(again.status, 200);
  assert.deepEqual(again.json.film, film);

  const cal = await me('/api/calendar');
  const door = cal.json.doors.find((d) => d.day === 7);
  assert.equal(door.opened, true);
  assert.equal(door.encore, false);
  assert.deepEqual(door.film, { slug: film.slug, title: film.title, year: film.year, hue: film.hue, character: film.character });
  assert.equal(cal.json.stats.opened, 1);
  assert.equal(cal.json.doors.filter((d) => d.film).length, 1, 'only the opened door has a film');

  const someoneElse = await visitor()('/api/calendar');
  assert.equal(someoneElse.json.stats.opened, 0, 'another visitor sees their own closed doors');
});

test('watched toggles on and off', async () => {
  const me = visitor();
  await me('/api/doors/3/open', { method: 'POST' });

  const on = await me('/api/doors/3/watched', { method: 'POST', body: {} });
  assert.equal(on.status, 200);
  assert.equal(on.json.watched, true);
  let cal = await me('/api/calendar');
  assert.equal(cal.json.doors.find((d) => d.day === 3).watched, true);
  assert.equal(cal.json.stats.watched, 1);

  const off = await me('/api/doors/3/watched', { method: 'POST', body: { watched: false } });
  assert.equal(off.status, 200);
  assert.equal(off.json.watched, false);
  assert.equal(off.json.opened, true, 'unwatching does not close the door');
  cal = await me('/api/calendar');
  assert.equal(cal.json.doors.find((d) => d.day === 3).watched, false);
  assert.equal(cal.json.stats.watched, 0);

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
  assert.deepEqual(mine.json.stats, { unlocked: 14, opened: 0, watched: 0 });
  assert.ok(mine.json.doors.every((d) => d.film === null));
  const theirs = await other('/api/calendar');
  assert.equal(theirs.json.stats.opened, 1);
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
  const source = 'DatabaseSync';
  for (const path of ['/../server/db.js', '/%2e%2e/server/db.js', '/..%2fserver/db.js', '/..%2f..%2fserver/db.js', '/%2e%2e%2fserver%2fdb.js']) {
    const res = await call(path);
    assert.ok([403, 404].includes(res.status), `${path} answered ${res.status}`);
    assert.equal(res.raw.includes(source), false, `${path} served the file`);
  }
  // The one that decodes to a real climb is refused outright, not just missing.
  assert.equal((await call('/..%2f..%2fserver/db.js')).status, 403);

  // And ordinary files still come through.
  const index = await call('/');
  assert.equal(index.status, 200);
  assert.match(index.headers['content-type'], /^text\/html/);
  assert.match(index.raw, /<title>Stathmas<\/title>/);
  const js = await call('/js/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /^text\/javascript/);
});

test('/api/catalog lists every film while preview is on', async () => {
  const res = await call('/api/catalog');
  assert.equal(res.status, 200);
  assert.equal(res.json.films.length, store.filmCount());
  assert.ok(res.json.films.every((f) => f.title && !('id' in f)));
});

test('with preview off, /api/catalog is 404 and X-Preview-Date is ignored', async () => {
  const strict = createServer(createHandler(store, { timeTravel: false }));
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
    assert.equal(cal.json.timeTravel, false);
    assert.equal(cal.json.today.preview, false);
    assert.notEqual(cal.json.today.year, 2100);
  } finally {
    strict.close();
    await once(strict, 'close');
  }
});
