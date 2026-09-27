import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FilmInUseError, openDb } from '../server/db.js';

const catalog = JSON.parse(readFileSync(new URL('../server/data/films.json', import.meta.url), 'utf8'));
const slugs = (films) => films.map((f) => f.slug).sort();

test('opening the database loads every film in films.json', () => {
  const store = openDb(':memory:');
  assert.equal(store.filmCount(), 31);
  assert.deepEqual(slugs(store.films()), slugs(catalog));
  store.close();
});

test('opening with { seed: false } leaves the catalog alone', () => {
  const store = openDb(':memory:', { seed: false });
  assert.equal(store.filmCount(), 0);
  store.close();
});

test('re-seeding applies edits and drops films that have left the JSON', () => {
  const store = openDb(':memory:');
  assert.equal(store.filmCount(), 31);

  const thirty = catalog.slice(0, 30).map((f) => ({ ...f }));
  thirty[0] = { ...thirty[0], title: 'Lock, Stock (director’s cut)' };
  store.seedFilms(thirty);

  assert.equal(store.filmCount(), 30);
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
  assert.equal(store.filmCount(), 31);
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
  assert.equal(store.filmCount(), 30);
  const days = store.days(2026);
  assert.equal(days.length, 31);
  assert.ok(days.every((d) => d.film.slug !== gone.slug));
  assert.equal(days.filter((d) => d.encore).length, 1, 'with 30 films one day is an encore');

  // The next start-up sync is now a no-op rather than an error.
  store.seedFilms(rest);
  assert.equal(store.filmCount(), 30);
  store.close();
});

test('a calendar for another year does not block removing a film it never used', () => {
  const store = openDb(':memory:', { seed: false });
  store.seedFilms(catalog.slice(0, 30));
  store.days(2026); // 30 films behind 31 doors; the 31st film is not in this calendar
  store.seedFilms(catalog); // add it back
  assert.equal(store.filmCount(), 31);
  store.seedFilms(catalog.slice(0, 30)); // and take it away again: no door depends on it
  assert.equal(store.filmCount(), 30);
  store.close();
});
