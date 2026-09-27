import { createServer } from 'node:http';
import { openDb } from './db.js';
import { createHandler } from './app.js';

const PORT = Number(process.env.PORT ?? 4747);
const DEFAULT_TZ = process.env.DEFAULT_TZ ?? 'America/Los_Angeles';
// Preview mode lets the client pretend it's a different date (?preview= in the
// page URL). Handy outside December; switch it off (TIME_TRAVEL=0) for a real one.
const TIME_TRAVEL = process.env.TIME_TRAVEL !== '0';

const store = openDb();
const server = createServer(createHandler(store, { defaultTz: DEFAULT_TZ, timeTravel: TIME_TRAVEL }));

server.listen(PORT, () => {
  console.log(`Stathmas is running at http://localhost:${PORT}`);
  if (TIME_TRAVEL) console.log(`Preview mode is on: add ?preview=2026-12-14 to the URL to pretend it's another day.`);
});
