// Redraw a year's calendar: node scripts/reshuffle.js [year]
// Visitors' opened/watched marks stay tied to day numbers, so reshuffle before December.
import { openDb } from '../server/db.js';

const year = Number(process.argv[2] ?? new Date().getFullYear());
const store = openDb();
store.reshuffle(year);
for (const { day, encore, film } of store.days(year)) {
  console.log(`Dec ${String(day).padStart(2)}  ${film.title} (${film.year})${encore ? '  [encore]' : ''}`);
}
store.close();
