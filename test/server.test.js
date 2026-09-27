import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { openDb } from '../server/db.js';
import { statSync } from 'node:fs';
import { createHandler } from '../server/app.js';

let store;
let server;
let port;
let base;

before(async () => {
  store = openDb(':memory:');
  server = createServer(createHandler(store, { timeTravel: true }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  server.closeAllConnections();
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

test('missing files, directories and paths outside public/ are still refused', async () => {
  assert.equal((await fetchGet('/nope.js')).status, 404);
  assert.equal((await fetchGet('/js')).status, 404);
  assert.equal((await fetchGet('/js/')).status, 404);
  assert.equal((await fetchGet('/..%2f..%2fpackage.json')).status, 403);
});
