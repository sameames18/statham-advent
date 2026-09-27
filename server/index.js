import { createServer } from 'node:http';
import { openDb } from './db.js';
import { createHandler } from './app.js';

const PORT = Number(process.env.PORT ?? 4747);
const DEFAULT_TZ = process.env.DEFAULT_TZ ?? 'America/Los_Angeles';
// Preview mode lets the client pretend it's a different date (?preview= in the
// page URL). Handy outside December; switch it off (TIME_TRAVEL=0) for a real one.
const TIME_TRAVEL = process.env.TIME_TRAVEL !== '0';
// Behind a reverse proxy that terminates HTTPS, set SECURE_COOKIES=1 so the
// visitor cookie is only ever sent over HTTPS. Off by default so plain-HTTP
// local development keeps working (a Secure cookie is dropped over http://).
const SECURE_COOKIES = !!process.env.SECURE_COOKIES && process.env.SECURE_COOKIES !== '0';

const store = openDb();
const server = createServer(createHandler(store, {
  defaultTz: DEFAULT_TZ, timeTravel: TIME_TRAVEL, secureCookies: SECURE_COOKIES,
}));

server.listen(PORT, () => {
  console.log(`Stathmas is running at http://localhost:${PORT}`);
  if (TIME_TRAVEL) console.log(`Preview mode is on: add ?preview=2026-12-14 to the URL to pretend it's another day.`);
});
