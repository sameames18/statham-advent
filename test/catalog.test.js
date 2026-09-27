import test from 'node:test';
import assert from 'node:assert/strict';
import films from '../server/data/films.json' with { type: 'json' };
import { loadCatalog } from '../server/catalog.js';
import { drawSeed } from '../server/calendar.js';
import {
  NONE, isOpened, isWatched, marksCookie, readMarks, withOpened, withWatched,
} from '../server/marks.js';

const SECRET = 'a test secret, not the real one';
const slugsOf = (days) => days.map((d) => d.film.slug);

// ---------- the catalog and the draw ----------

test('the catalog loads every film in films.json, in release order', () => {
  const catalog = loadCatalog({ secret: SECRET });
  assert.equal(catalog.films().length, films.length);
  const years = catalog.films().map((f) => f.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
});

test('a year draws 31 days, each a different film, the same every time', () => {
  const catalog = loadCatalog({ secret: SECRET });
  const days = catalog.days(2026);
  assert.deepEqual(days.map((d) => d.day), Array.from({ length: 31 }, (_, i) => i + 1));
  assert.equal(new Set(slugsOf(days)).size, 31);
  assert.ok(days.every((d) => d.encore === false));
  assert.deepEqual(slugsOf(loadCatalog({ secret: SECRET }).days(2026)), slugsOf(days), 'a second instance agrees');
  assert.equal(catalog.day(2026, 7), days[6]);
  assert.equal(catalog.day(2026, 32), undefined);
});

test('different years and different secrets draw different calendars', () => {
  const catalog = loadCatalog({ secret: SECRET });
  assert.notDeepEqual(slugsOf(catalog.days(2027)), slugsOf(catalog.days(2026)));
  assert.notDeepEqual(slugsOf(loadCatalog({ secret: `${SECRET}!` }).days(2026)), slugsOf(catalog.days(2026)));
});

test('reordering films.json changes nothing; adding a film redraws', () => {
  const base = slugsOf(loadCatalog({ secret: SECRET }).days(2026));
  assert.deepEqual(slugsOf(loadCatalog({ secret: SECRET, list: [...films].reverse() }).days(2026)), base);
  const extra = { ...films[0], slug: 'a-new-film', title: 'A New Film' };
  assert.notDeepEqual(slugsOf(loadCatalog({ secret: SECRET, list: [...films, extra] }).days(2026)), base);
});

test('with fewer films than days, the spare days are encores', () => {
  const days = loadCatalog({ secret: SECRET, list: films.slice(0, 20) }).days(2026);
  assert.equal(days.length, 31);
  assert.equal(days.filter((d) => d.encore).length, 11);
});

test('films.json is checked when it loads', () => {
  const { note, ...noNote } = films[0];
  assert.throws(() => loadCatalog({ secret: SECRET, list: [noNote] }), /missing note/);
  assert.throws(() => loadCatalog({ secret: SECRET, list: [films[0], films[0]] }), /used twice/);
  assert.throws(() => loadCatalog({ list: films }), /needs a secret/);
});

test('the seed is a 31-bit number fixed by the secret and the year', () => {
  const seed = drawSeed(SECRET, 2026);
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 31);
  assert.equal(drawSeed(SECRET, 2026), seed);
  assert.notEqual(drawSeed(SECRET, 2027), seed);
});

// ---------- the marks cookie ----------

test('marks round-trip through the cookie', () => {
  let marks = withOpened(NONE, 1);
  marks = withOpened(marks, 31);
  marks = withWatched(marks, 14, true);
  assert.ok(isOpened(marks, 1) && isOpened(marks, 14) && isOpened(marks, 31));
  assert.ok(!isOpened(marks, 2));
  assert.ok(isWatched(marks, 14) && !isWatched(marks, 1));

  const set = marksCookie(2026, marks, false);
  assert.match(set, /^stathmas-2026=40002001\.2000; Path=\/; Max-Age=34560000; HttpOnly; SameSite=Lax$/);
  const back = readMarks(`other=1; ${set.split(';')[0]}; more=2`, 2026);
  assert.deepEqual(back, marks);

  const unseen = withWatched(back, 14, false);
  assert.ok(isOpened(unseen, 14) && !isWatched(unseen, 14));
});

test('clearing the marks clears the cookie', () => {
  assert.equal(marksCookie(2026, NONE, true), 'stathmas-2026=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure');
});

test('a mark past the 31st, or a "seen" without "opened", is dropped', () => {
  assert.deepEqual(readMarks('stathmas-2026=ffffffff.ffffffff', 2026), { opened: 0x7fffffff, watched: 0x7fffffff });
  assert.deepEqual(readMarks('stathmas-2026=1.2', 2026), { opened: 1, watched: 0 });
  assert.equal(readMarks(undefined, 2026), NONE);
  assert.equal(readMarks('stathmas-2026=%3Cscript%3E', 2026), NONE);
});
