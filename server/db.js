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

export function openDb(file = process.env.DB_FILE ?? join(here, '..', 'data', 'stathmas.db')) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  seedFilms(db);
  return makeStore(db);
}

// Upsert the catalog from films.json so edits to the JSON land on restart.
function seedFilms(db, films = JSON.parse(readFileSync(FILMS_JSON, 'utf8'))) {
  const upsert = db.prepare(`
    INSERT INTO films (slug, title, year, director, runtime, character, gross, wiki, hue, logline, note)
    VALUES (:slug, :title, :year, :director, :runtime, :character, :gross, :wiki, :hue, :logline, :note)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title, year = excluded.year, director = excluded.director,
      runtime = excluded.runtime, character = excluded.character, gross = excluded.gross,
      wiki = excluded.wiki, hue = excluded.hue, logline = excluded.logline, note = excluded.note`);
  db.exec('BEGIN');
  for (const f of films) upsert.run(f);
  db.exec('COMMIT');
}

function makeStore(db) {
  const q = {
    filmIds: db.prepare('SELECT id FROM films ORDER BY id'),
    filmCount: db.prepare('SELECT count(*) AS n FROM films'),
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
    filmCount: () => q.filmCount.get().n,
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

    reshuffle(year) {
      q.deleteCalendar.run(year);
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
