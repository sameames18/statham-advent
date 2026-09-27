import { createServer } from 'node:http';
import { FilmInUseError, openDb } from './db.js';
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
// The public address, e.g. SITE_URL=https://stathmas.example.com. Link previews
// in Slack, iMessage, X and the rest fetch the thumbnail from an absolute URL,
// which only the deployment knows. Unset, the page gives a root-relative one.
const SITE_URL = siteOrigin(process.env.SITE_URL);

function siteOrigin(value) {
  if (!value) return '';
  let url;
  try {
    url = new URL(value);
  } catch {
    url = null;
  }
  if (url?.protocol !== 'https:' && url?.protocol !== 'http:') {
    console.error(`Stathmas can't start: SITE_URL must be an http(s) address like https://stathmas.example.com, not "${value}".`);
    process.exit(1);
  }
  return url.origin;
}

// The catalog is synced from films.json on every start. A film can't leave the
// JSON while a stored calendar still shows it, so stop with the fix spelled out.
function openCatalog() {
  try {
    return openDb();
  } catch (err) {
    if (!(err instanceof FilmInUseError)) throw err;
    console.error(`Stathmas can't start: ${err.message}`);
    process.exit(1);
  }
}

const store = openCatalog();
const server = createServer(createHandler(store, {
  defaultTz: DEFAULT_TZ, timeTravel: TIME_TRAVEL, secureCookies: SECURE_COOKIES, siteUrl: SITE_URL,
}));

server.listen(PORT, () => {
  console.log(`Stathmas is running at http://localhost:${PORT}`);
  if (!SITE_URL) console.log('SITE_URL is not set: link previews may not show the thumbnail.');
  if (TIME_TRAVEL) console.log(`Preview mode is on: add ?preview=2026-12-14 to the URL to pretend it's another day.`);
});
