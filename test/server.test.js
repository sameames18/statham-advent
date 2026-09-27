import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { statSync } from 'node:fs';
import { createHandler } from '../server/index.js';
import { openDb } from '../server/db.js';

// The handler runs on a port of its own with an in-memory database, so the
// tests never touch data/stathmas.db or the real 4747.
let server;
let store;
let base;

before(async () => {
  store = openDb(':memory:');
  server = createServer(createHandler(store));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  store.close();
});

const get = (path, headers = {}) => fetch(base + path, { headers });

test('the API answers through the exported handler', async () => {
  const res = await get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('a first GET of a static file sends the file with validators and no-cache', async () => {
  const res = await get('/js/app.js');
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
  const first = await get('/styles.css');
  const etag = first.headers.get('etag');
  await first.arrayBuffer();

  const again = await get('/styles.css', { 'If-None-Match': etag });
  assert.equal(again.status, 304);
  assert.equal(again.headers.get('etag'), etag);
  assert.equal(again.headers.get('cache-control'), 'no-cache');
  assert.equal((await again.arrayBuffer()).byteLength, 0);
});

test('a stale ETag gets the whole file again', async () => {
  const res = await get('/styles.css', { 'If-None-Match': 'W/"1-abc"' });
  assert.equal(res.status, 200);
  assert.ok((await res.arrayBuffer()).byteLength > 0);
});

test('a strong tag with the same value still matches, and a list of tags is searched', async () => {
  const first = await get('/');
  const etag = first.headers.get('etag');
  await first.arrayBuffer();
  const strong = etag.replace(/^W\//, '');
  const res = await get('/', { 'If-None-Match': `"nope", ${strong}` });
  assert.equal(res.status, 304);
});

test('If-Modified-Since is honoured when there is no If-None-Match', async () => {
  const first = await get('/js/scene.js');
  const lastModified = first.headers.get('last-modified');
  await first.arrayBuffer();

  const fresh = await get('/js/scene.js', { 'If-Modified-Since': lastModified });
  assert.equal(fresh.status, 304);
  assert.equal((await fresh.arrayBuffer()).byteLength, 0);

  const stale = await get('/js/scene.js', { 'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT' });
  assert.equal(stale.status, 200);
  await stale.arrayBuffer();

  const junk = await get('/js/scene.js', { 'If-Modified-Since': 'not a date' });
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
  assert.equal((await get('/nope.js')).status, 404);
  assert.equal((await get('/js')).status, 404);
  assert.equal((await get('/js/')).status, 404);
  assert.equal((await get('/..%2f..%2fpackage.json')).status, 403);
});
