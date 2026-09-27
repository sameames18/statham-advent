import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, isUnlocked, parseDate, dateIn, isValidTimeZone } from '../server/calendar.js';

const films = Array.from({ length: 28 }, (_, i) => i + 1);

test('every film gets a door, and all 31 days are filled', () => {
  const cal = buildCalendar(films, 12345);
  assert.equal(cal.length, 31);
  assert.deepEqual(cal.map((d) => d.day), Array.from({ length: 31 }, (_, i) => i + 1));
  assert.deepEqual(new Set(cal.map((d) => d.filmId)), new Set(films));
});

test('spare days become encores of distinct films, flagged on the later showing', () => {
  const cal = buildCalendar(films, 999);
  const encores = cal.filter((d) => d.encore);
  assert.equal(encores.length, 3);
  assert.equal(new Set(encores.map((d) => d.filmId)).size, 3);
  for (const e of encores) {
    const first = cal.find((d) => d.filmId === e.filmId);
    assert.ok(first.day < e.day && !first.encore);
  }
});

test('with exactly 31 films, every day is a different film and nothing is an encore', () => {
  const thirtyOne = Array.from({ length: 31 }, (_, i) => i + 1);
  const cal = buildCalendar(thirtyOne, 42);
  assert.equal(new Set(cal.map((d) => d.filmId)).size, 31);
  assert.ok(cal.every((d) => !d.encore));
});

test('no film plays two nights running', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const ids = buildCalendar(films, seed).map((d) => d.filmId);
    assert.ok(ids.every((id, i) => i === 0 || ids[i - 1] !== id), `seed ${seed}`);
  }
});

test('same seed, same calendar; different seed, different calendar', () => {
  assert.deepEqual(buildCalendar(films, 7), buildCalendar(films, 7));
  assert.notDeepEqual(buildCalendar(films, 7), buildCalendar(films, 8));
});

test('with more films than days, it takes 31 distinct films', () => {
  const many = Array.from({ length: 40 }, (_, i) => i);
  const cal = buildCalendar(many, 3);
  assert.equal(cal.length, 31);
  assert.equal(new Set(cal.map((d) => d.filmId)).size, 31);
});

test('doors unlock on their day in December and stay unlocked', () => {
  assert.equal(isUnlocked(2026, 1, { year: 2026, month: 11, day: 30 }), false);
  assert.equal(isUnlocked(2026, 1, { year: 2026, month: 12, day: 1 }), true);
  assert.equal(isUnlocked(2026, 14, { year: 2026, month: 12, day: 13 }), false);
  assert.equal(isUnlocked(2026, 14, { year: 2026, month: 12, day: 14 }), true);
  assert.equal(isUnlocked(2026, 31, { year: 2027, month: 1, day: 2 }), true);
  assert.equal(isUnlocked(2026, 1, { year: 2025, month: 12, day: 31 }), false);
});

test('preview dates parse strictly', () => {
  assert.deepEqual(parseDate('2026-12-14'), { year: 2026, month: 12, day: 14 });
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('12/14/2026'), null);
  assert.equal(parseDate(undefined), null);
});

test('the date depends on the visitor time zone', () => {
  const instant = new Date('2026-12-01T05:00:00Z'); // 9pm Nov 30 in LA, 2pm Dec 1 in Tokyo
  assert.deepEqual(dateIn('America/Los_Angeles', instant), { year: 2026, month: 11, day: 30 });
  assert.deepEqual(dateIn('Asia/Tokyo', instant), { year: 2026, month: 12, day: 1 });
  assert.equal(isValidTimeZone('Europe/London'), true);
  assert.equal(isValidTimeZone('Not/AZone'), false);
});
