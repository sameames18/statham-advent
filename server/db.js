import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildCalendar } from './calendar.js';

const here = dirname(fileURLToPath(import.meta.url));
const FILMS_JSON = join(here, 'data', 'films.json');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS films (
  id        INTEGER PRIMARY KEY,
  slug      TEXT NOT NULL UNIQUE,
  title     TEXT NOT NULL,
  year      INTEGER NOT NULL,
  director  TEXT NOT NULL,
  runtime   INTEGER NOT NULL,
  character TEXT NOT NULL,
  gross     TEXT,
  wiki      TEXT,
  hue       INTEGER NOT NULL,
  logline   TEXT NOT NULL,
  note      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS calendars (
  year       INTEGER PRIMARY KEY,
  seed       INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS calendar_days (
  year    INTEGER NOT NULL REFERENCES calendars(year) ON DELETE CASCADE,
  day     INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  film_id INTEGER NOT NULL REFERENCES films(id),
  encore  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (year, day)
);
CREATE TABLE IF NOT EXISTS door_states (
  visitor_id TEXT NOT NULL,
  year       INTEGER NOT NULL,
  day        INTEGER NOT NULL,
  opened_at  TEXT NOT NULL DEFAULT (datetime('now')),
  watched_at TEXT,
  PRIMARY KEY (visitor_id, year, day)
);
`;

export function openDb(file = process.env.DB_FILE ?? join(here, '..', 'data', 'stathmas.db'), { seed = true } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  // Pass { seed: false } to look at the database without touching the catalog
  // (reshuffle does, so it can drop a year's calendar before the sync runs).
  if (seed) seedFilms(db);
  return makeStore(db);
}

const loadFilms = () => JSON.parse(readFileSync(FILMS_JSON, 'utf8'));

// Thrown when films.json no longer lists a film that a stored calendar has behind
// a door. Removing it would break that year's doors, so the operator has to redraw
// the year (or put the film back) before the catalog can follow the JSON.
export class FilmInUseError extends Error {
  constructor(uses) {
    const years = [...new Set(uses.flatMap((u) => u.years))].sort();
    const lines = uses.map(({ title, slug, years }) => {
      const cals = years.length > 1 ? `the ${years.join(', ')} calendars still have` : `the ${years[0]} calendar still has`;
      return `"${title}" (${slug}) is no longer in films.json, but ${cals} it behind a door.`;
    });
    const cmds = years.map((y) => `node scripts/reshuffle.js ${y}`).join(' and ');
    super(`${lines.join('\n')}\nRun \`${cmds}\` first, or restore the film${uses.length > 1 ? 's' : ''} in server/data/films.json.`);
    this.name = 'FilmInUseError';
    this.uses = uses;
  }
}

// Sync the catalog with films.json so edits to the JSON land on restart: every
// entry is upserted by slug, and rows whose slug has left the JSON are deleted.
// All or nothing: a film a stored calendar still uses cannot go (calendar_days
// references films with foreign keys on), so the whole sync is rolled back and
// a FilmInUseError names the film and the year.
function seedFilms(db, films = loadFilms()) {
  const upsert = db.prepare(`
    INSERT INTO films (slug, title, year, director, runtime, character, gross, wiki, hue, logline, note)
    VALUES (:slug, :title, :year, :director, :runtime, :character, :gross, :wiki, :hue, :logline, :note)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title, year = excluded.year, director = excluded.director,
      runtime = excluded.runtime, character = excluded.character, gross = excluded.gross,
      wiki = excluded.wiki, hue = excluded.hue, logline = excluded.logline, note = excluded.note`);
  const all = db.prepare('SELECT id, slug, title FROM films');
  const yearsUsing = db.prepare('SELECT DISTINCT year FROM calendar_days WHERE film_id = ? ORDER BY year');
  const remove = db.prepare('DELETE FROM films WHERE id = ?');

  db.exec('BEGIN');
  try {
    for (const f of films) upsert.run(f);
    const keep = new Set(films.map((f) => f.slug));
    const stale = all.all().filter((f) => !keep.has(f.slug));
    const inUse = stale
      .map((f) => ({ ...f, years: yearsUsing.all(f.id).map((r) => r.year) }))
      .filter((f) => f.years.length);
    if (inUse.length) throw new FilmInUseError(inUse);
    for (const f of stale) remove.run(f.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function makeStore(db) {
  const q = {
    filmIds: db.prepare('SELECT id FROM films ORDER BY id'),
    films: db.prepare('SELECT * FROM films ORDER BY year, id'),
    calendar: db.prepare('SELECT seed FROM calendars WHERE year = ?'),
    insertCalendar: db.prepare('INSERT INTO calendars (year, seed) VALUES (?, ?)'),
    deleteCalendar: db.prepare('DELETE FROM calendars WHERE year = ?'),
    insertDay: db.prepare('INSERT INTO calendar_days (year, day, film_id, encore) VALUES (?, ?, ?, ?)'),
    days: db.prepare(`
      SELECT d.day, d.encore, f.*
      FROM calendar_days d JOIN films f ON f.id = d.film_id
      WHERE d.year = ? ORDER BY d.day`),
    doorStates: db.prepare('SELECT day, opened_at, watched_at FROM door_states WHERE visitor_id = ? AND year = ?'),
    open: db.prepare(`INSERT INTO door_states (visitor_id, year, day) VALUES (?, ?, ?)
                      ON CONFLICT DO NOTHING`),
    watched: db.prepare(`UPDATE door_states SET watched_at = CASE WHEN ? THEN datetime('now') END
                         WHERE visitor_id = ? AND year = ? AND day = ?`),
    resetVisitor: db.prepare('DELETE FROM door_states WHERE visitor_id = ? AND year = ?'),
  };

  const store = {
    // Sync the catalog again from a list (default: films.json). Used by reshuffle
    // and by the tests; the server does it once, in openDb.
    seedFilms: (films) => seedFilms(db, films),
    films: () => q.films.all(),

    // The calendar for a year is drawn once, with a random seed, then kept.
    ensureCalendar(year) {
      if (q.calendar.get(year)) return;
      const seed = randomInt(2 ** 31);
      const ids = q.filmIds.all().map((r) => r.id);
      db.exec('BEGIN');
      try {
        q.insertCalendar.run(year, seed);
        for (const d of buildCalendar(ids, seed)) q.insertDay.run(year, d.day, d.filmId, d.encore ? 1 : 0);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    // Redraw a year: drop its calendar, sync the catalog (a film that only this
    // year pinned can leave now), then draw again from what is left. The steps
    // are deliberately separate transactions: if another year still pins the
    // film, the sync fails and names it, and this year is redrawn on demand.
    reshuffle(year, films) {
      q.deleteCalendar.run(year);
      seedFilms(db, films);
      store.ensureCalendar(year);
    },

    days(year) {
      store.ensureCalendar(year);
      return q.days.all(year).map(({ day, encore, id, ...film }) => ({ day, encore: !!encore, film: { id, ...film } }));
    },

    doorStates(visitorId, year) {
      const map = new Map();
      for (const r of q.doorStates.all(visitorId, year)) map.set(r.day, { openedAt: r.opened_at, watchedAt: r.watched_at });
      return map;
    },

    open: (visitorId, year, day) => q.open.run(visitorId, year, day),
    setWatched: (visitorId, year, day, watched) => q.watched.run(watched ? 1 : 0, visitorId, year, day),
    resetVisitor: (visitorId, year) => q.resetVisitor.run(visitorId, year),
    close: () => db.close(),
  };
  return store;
}
