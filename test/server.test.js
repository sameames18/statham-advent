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

test('the visitor cookie is Secure only when the handler is told to', async () => {
  const plain = await get('/api/health');
  assert.match(plain.headers['set-cookie'][0], /^visitor=[0-9a-f-]{36}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax$/);

  const secure = createServer(createHandler(store, { timeTravel: true, secureCookies: true }));
  secure.listen(0, '127.0.0.1');
  await once(secure, 'listening');
  try {
    const res = await new Promise((resolve, reject) => {
      request({ host: '127.0.0.1', port: secure.address().port, path: '/api/health' }, (r) => {
        r.resume();
        r.on('end', () => resolve(r));
      }).on('error', reject).end();
    });
    assert.match(res.headers['set-cookie'][0], /; SameSite=Lax; Secure$/);
  } finally {
    secure.close();
    await once(secure, 'close');
  }
});
