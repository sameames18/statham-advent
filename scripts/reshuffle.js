// Redraw a year's calendar: node scripts/reshuffle.js [year]
// Visitors' opened/watched marks stay tied to day numbers, so reshuffle before December.
// This is also how a film leaves the catalog: drop the year that pins it, sync
// films.json, draw again. So the store is opened without the usual start-up sync,
// which would refuse to run while the old calendar still uses the film.
import { FilmInUseError, openDb } from '../server/db.js';

const year = Number(process.argv[2] ?? new Date().getFullYear());
const store = openDb(undefined, { seed: false });
try {
  store.reshuffle(year);
} catch (err) {
  if (!(err instanceof FilmInUseError)) throw err;
  console.error(err.message);
  process.exit(1);
}
for (const { day, encore, film } of store.days(year)) {
  console.log(`Dec ${String(day).padStart(2)}  ${film.title} (${film.year})${encore ? '  [encore]' : ''}`);
}
store.close();
