import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.js';

const FILMS = JSON.parse(readFileSync(new URL('../server/data/films.json', import.meta.url), 'utf8'));
const YEAR = 2026;
const VISITOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const draw = (store, year) => store.days(year).map((d) => [d.day, d.film.slug, d.encore]);

let store;
before(() => { store = openDb(':memory:'); });
after(() => store.close());

test('the catalog is seeded from films.json', () => {
  assert.equal(store.filmCount(), FILMS.length);
  assert.deepEqual(store.films().map((f) => f.slug).sort(), FILMS.map((f) => f.slug).sort());
});

test('ensureCalendar draws 31 days, each with a distinct film, and keeps that draw', () => {
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
});

test('open, setWatched and resetVisitor round-trip through doorStates', () => {
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
});

test('reshuffle draws a different calendar and leaves door_states alone', () => {
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
});

test('re-seeding with a changed title updates the existing row in place', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stathmas-'));
  const file = join(dir, 'test.db');
  try {
    const first = openDb(file, { films: FILMS });
    first.ensureCalendar(YEAR);
    const dayOfMeg = first.days(YEAR).find((d) => d.film.slug === 'the-meg').day;
    const idBefore = first.films().find((f) => f.slug === 'the-meg').id;
    first.close();

    const edited = FILMS.map((f) => (f.slug === 'the-meg' ? { ...f, title: 'The Meg (Director’s Cut)' } : f));
    const second = openDb(file, { films: edited });
    const meg = second.films().find((f) => f.slug === 'the-meg');
    assert.equal(meg.title, 'The Meg (Director’s Cut)');
    assert.equal(meg.id, idBefore, 'same row, not a new one');
    assert.equal(second.filmCount(), FILMS.length, 'no duplicate was inserted');
    assert.equal(second.days(YEAR)[dayOfMeg - 1].film.title, 'The Meg (Director’s Cut)', 'the calendar sees the new title');
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
