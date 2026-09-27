import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilmInUseError, openDb } from '../server/db.js';

const catalog = JSON.parse(readFileSync(new URL('../server/data/films.json', import.meta.url), 'utf8'));
const slugs = (films) => films.map((f) => f.slug).sort();

test('opening the database loads every film in films.json', () => {
  const store = openDb(':memory:');
  assert.equal(store.films().length, 31);
  assert.deepEqual(slugs(store.films()), slugs(catalog));
  store.close();
});

test('opening with { seed: false } leaves the catalog alone', () => {
  const store = openDb(':memory:', { seed: false });
  assert.equal(store.films().length, 0);
  store.close();
});

test('re-seeding applies edits and drops films that have left the JSON', () => {
  const store = openDb(':memory:');
  assert.equal(store.films().length, 31);

  const thirty = catalog.slice(0, 30).map((f) => ({ ...f }));
  thirty[0] = { ...thirty[0], title: 'Lock, Stock (director’s cut)' };
  store.seedFilms(thirty);

  assert.equal(store.films().length, 30);
  assert.deepEqual(slugs(store.films()), slugs(thirty));
  assert.equal(store.films().find((f) => f.slug === thirty[0].slug).title, thirty[0].title);
  store.close();
});

test('a film a stored calendar uses cannot be removed, and the sync is rolled back', () => {
  const store = openDb(':memory:');
  store.days(2026); // draws the year's calendar, which puts all 31 films behind doors
  const [gone, ...rest] = catalog;
  const edited = rest.map((f, i) => (i === 0 ? { ...f, title: 'Edited in the same sync' } : f));

  assert.throws(() => store.seedFilms(edited), (err) => {
    assert.ok(err instanceof FilmInUseError);
    assert.ok(err.message.includes(gone.title), err.message);
    assert.ok(err.message.includes(gone.slug), err.message);
    assert.ok(err.message.includes('2026 calendar'), err.message);
    assert.ok(err.message.includes('node scripts/reshuffle.js 2026'), err.message);
    return true;
  });

  // Nothing from the failed sync landed: the row is still there and the edit is not.
  assert.equal(store.films().length, 31);
  assert.equal(store.films().find((f) => f.slug === rest[0].slug).title, rest[0].title);
  assert.equal(store.days(2026).length, 31);
  store.close();
});

test('the error names every year that still uses the film', () => {
  const store = openDb(':memory:');
  store.days(2025);
  store.days(2026);
  assert.throws(() => store.seedFilms(catalog.slice(1)), (err) => {
    assert.ok(err instanceof FilmInUseError);
    assert.ok(err.message.includes('2025, 2026 calendars'), err.message);
    assert.ok(err.message.includes('node scripts/reshuffle.js 2025 and node scripts/reshuffle.js 2026'), err.message);
    return true;
  });
  store.close();
});

test('a film only an old calendar used goes once that year is reshuffled', () => {
  const store = openDb(':memory:');
  store.days(2026);
  const [gone, ...rest] = catalog;
  assert.throws(() => store.seedFilms(rest), FilmInUseError);

  store.reshuffle(2026, rest);
  assert.equal(store.films().length, 30);
  const days = store.days(2026);
  assert.equal(days.length, 31);
  assert.ok(days.every((d) => d.film.slug !== gone.slug));
  assert.equal(days.filter((d) => d.encore).length, 1, 'with 30 films one day is an encore');

  // The next start-up sync is now a no-op rather than an error.
  store.seedFilms(rest);
  assert.equal(store.films().length, 30);
  store.close();
});

test('a calendar for another year does not block removing a film it never used', () => {
  const store = openDb(':memory:', { seed: false });
  store.seedFilms(catalog.slice(0, 30));
  store.days(2026); // 30 films behind 31 doors; the 31st film is not in this calendar
  store.seedFilms(catalog); // add it back
  assert.equal(store.films().length, 31);
  store.seedFilms(catalog.slice(0, 30)); // and take it away again: no door depends on it
  assert.equal(store.films().length, 30);
  store.close();
});

// ---------- the yearly draw and door states ----------

const YEAR = 2026;
const VISITOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const draw = (store, year) => store.days(year).map((d) => [d.day, d.film.slug, d.encore]);

test('ensureCalendar draws 31 days, each with a distinct film, and keeps that draw', () => {
  const store = openDb(':memory:');
  store.ensureCalendar(YEAR);
  const first = draw(store, YEAR);
  assert.equal(first.length, 31);
  assert.deepEqual(first.map(([day]) => day), Array.from({ length: 31 }, (_, i) => i + 1));
  assert.equal(new Set(first.map(([, slug]) => slug)).size, 31);
  assert.ok(first.every(([, , encore]) => encore === false), 'with 31 films nothing is an encore');

  store.ensureCalendar(YEAR);
  assert.deepEqual(draw(store, YEAR), first);
  // days() also calls ensureCalendar, so a third look is the same draw too.
  assert.deepEqual(draw(store, YEAR), first);
  // and day() reads the same row that days() lists.
  assert.deepEqual(store.day(YEAR, 12), store.days(YEAR)[11]);
  assert.equal(store.day(YEAR, 32), undefined);
  store.close();
});

test('open, setWatched and resetVisitor round-trip through doorStates', () => {
  const store = openDb(':memory:');
  assert.equal(store.doorStates(VISITOR, YEAR).size, 0);

  store.open(VISITOR, YEAR, 3);
  store.open(VISITOR, YEAR, 3); // opening twice is harmless
  let states = store.doorStates(VISITOR, YEAR);
  assert.deepEqual([...states.keys()], [3]);
  assert.ok(states.get(3).openedAt);
  assert.equal(states.get(3).watchedAt, null);

  store.setWatched(VISITOR, YEAR, 3, true);
  states = store.doorStates(VISITOR, YEAR);
  assert.ok(states.get(3).watchedAt, 'watched sets a timestamp');
  assert.ok(states.get(3).openedAt, 'and keeps the opened one');
  assert.deepEqual(store.doorState(VISITOR, YEAR, 3), states.get(3), 'doorState reads the one row');
  assert.equal(store.doorState(VISITOR, YEAR, 4), undefined);

  store.setWatched(VISITOR, YEAR, 3, false);
  states = store.doorStates(VISITOR, YEAR);
  assert.equal(states.get(3).watchedAt, null, 'unwatched clears it');
  assert.ok(states.has(3), 'but the door stays open');

  store.open(VISITOR, YEAR, 9);
  assert.equal(store.doorStates(VISITOR, YEAR).size, 2);
  assert.equal(store.doorStates('someone-else', YEAR).size, 0, 'states are per visitor');
  assert.equal(store.doorStates(VISITOR, YEAR + 1).size, 0, 'and per year');

  store.resetVisitor(VISITOR, YEAR);
  assert.equal(store.doorStates(VISITOR, YEAR).size, 0);
  store.close();
});

test('reshuffle draws a different calendar and leaves door_states alone', () => {
  const store = openDb(':memory:');
  const before = draw(store, YEAR);
  store.open(VISITOR, YEAR, 5);
  store.setWatched(VISITOR, YEAR, 5, true);
  const states = store.doorStates(VISITOR, YEAR);

  store.reshuffle(YEAR);
  const after = draw(store, YEAR);
  assert.equal(after.length, 31);
  assert.equal(new Set(after.map(([, slug]) => slug)).size, 31);
  // A fresh random seed. The odds of drawing the same 31! order twice are nil.
  assert.notDeepEqual(after, before);

  assert.deepEqual(store.doorStates(VISITOR, YEAR), states);
  assert.deepEqual(draw(store, YEAR), after, 'and the new draw is kept');
  store.close();
});

test('re-seeding with a changed title updates the row in place, and a stored calendar sees it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stathmas-'));
  try {
    const file = join(dir, 'test.db');
    const first = openDb(file);
    first.ensureCalendar(YEAR);
    const dayOfMeg = first.days(YEAR).find((d) => d.film.slug === 'the-meg').day;
    const idBefore = first.films().find((f) => f.slug === 'the-meg').id;
    first.close();

    // A restart with an edited films.json: open without the start-up sync,
    // then sync from the edited list.
    const edited = catalog.map((f) => (f.slug === 'the-meg' ? { ...f, title: 'The Meg (Director’s Cut)' } : f));
    const second = openDb(file, { seed: false });
    second.seedFilms(edited);
    const meg = second.films().find((f) => f.slug === 'the-meg');
    assert.equal(meg.title, 'The Meg (Director’s Cut)');
    assert.equal(meg.id, idBefore, 'same row, not a new one');
    assert.equal(second.films().length, catalog.length, 'no duplicate was inserted');
    assert.equal(second.day(YEAR, dayOfMeg).film.title, 'The Meg (Director’s Cut)', 'the calendar sees the new title');
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
