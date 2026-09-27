import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { ConfigError, readConfig } from '../server/config.js';
import stathmas, { restorePath } from '../api/index.js';

const SECRET = 'x'.repeat(32);

// ---------- settings ----------

test('preview mode is off unless asked for', () => {
  assert.equal(readConfig({ CALENDAR_SECRET: SECRET }, []).timeTravel, false);
  assert.equal(readConfig({ CALENDAR_SECRET: SECRET, TIME_TRAVEL: '0' }, []).timeTravel, false);
  assert.equal(readConfig({ CALENDAR_SECRET: SECRET, TIME_TRAVEL: 'yes' }, []).timeTravel, false);
  assert.equal(readConfig({ CALENDAR_SECRET: SECRET, TIME_TRAVEL: '1' }, []).timeTravel, true);
  assert.equal(readConfig({ CALENDAR_SECRET: SECRET }, ['node', 'server/index.js', '--preview']).timeTravel, true);
});

test('a real December will not run without a proper secret', () => {
  assert.throws(() => readConfig({}, []), (err) => err instanceof ConfigError && /CALENDAR_SECRET is not set/.test(err.message));
  assert.throws(() => readConfig({ CALENDAR_SECRET: 'hunter2' }, []), /too short/);
  assert.equal(readConfig({ CALENDAR_SECRET: SECRET }, []).secret, SECRET);
});

test('preview mode runs without a secret, since it gives every film away anyway', () => {
  const config = readConfig({ TIME_TRAVEL: '1' }, []);
  assert.equal(config.timeTravel, true);
  assert.ok(config.secret);
});

test('cookies are Secure on Vercel by default, and wherever SECURE_COOKIES says', () => {
  const base = { CALENDAR_SECRET: SECRET };
  assert.equal(readConfig(base, []).secureCookies, false);
  assert.equal(readConfig({ ...base, VERCEL: '1' }, []).secureCookies, true);
  assert.equal(readConfig({ ...base, VERCEL: '1', SECURE_COOKIES: '0' }, []).secureCookies, false);
  assert.equal(readConfig({ ...base, SECURE_COOKIES: '1' }, []).secureCookies, true);
});

test('port and fallback time zone have defaults', () => {
  const config = readConfig({ CALENDAR_SECRET: SECRET }, []);
  assert.equal(config.port, 4747);
  assert.equal(config.defaultTz, 'America/Los_Angeles');
  assert.equal(readConfig({ CALENDAR_SECRET: SECRET, PORT: '8080', DEFAULT_TZ: 'Europe/London' }, []).port, 8080);
});

// ---------- the Vercel function ----------

test('the original path is put back from the rewrite, or left alone if it was never lost', () => {
  assert.equal(restorePath('/api?__path=doors%2F7%2Fopen'), '/api/doors/7/open');
  assert.equal(restorePath('/api?__path=doors/7/open&year=2025'), '/api/doors/7/open?year=2025');
  assert.equal(restorePath('/api/doors/7/open?year=2025'), '/api/doors/7/open?year=2025');
  assert.equal(restorePath('/api?__path='), '/api/');
});

let server;
let port;
const savedEnv = { ...process.env };

before(async () => {
  // The function reads its settings from the environment on first use.
  Object.assign(process.env, { CALENDAR_SECRET: SECRET, VERCEL: '1' });
  delete process.env.TIME_TRAVEL;
  server = createServer(stathmas).listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
});

after(async () => {
  process.env = savedEnv;
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
});

function call(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port, path, method, agent: false }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, json: JSON.parse(raw) }));
    }).on('error', reject).end();
  });
}

test('the function answers the API under either form of URL', async () => {
  assert.deepEqual((await call('/api?__path=health')).json, { ok: true });
  assert.deepEqual((await call('/api/health')).json, { ok: true });
  const cal = await call('/api?__path=calendar');
  assert.equal(cal.status, 200);
  assert.equal(cal.json.doors.length, 31);
  assert.equal(cal.json.today.preview, false);
});

test('the function has preview off, no catalog, and serves no files', async () => {
  assert.equal((await call('/api?__path=catalog')).status, 404);
  assert.equal((await call('/api?__path=..%2F..%2Findex.html')).status, 404);
  assert.equal((await call('/index.html')).status, 404);
});

test('opening a past year\'s door sets a Secure cookie', async () => {
  const res = await call('/api?__path=doors/1/open&year=2025', 'POST');
  assert.equal(res.status, 200);
  assert.match(res.headers['set-cookie'][0], /^stathmas-2025=1\.0;.*; Secure$/);
});
