import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billText, daysUntilDecember, doorLabel, ordinal, previewNote, splitTitle, tagText,
} from '../public/js/words.js';

// A season's doors as the API sends them: `opened` and `watched` list days.
function doors({ opened = [], watched = [] } = {}) {
  return Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const isOpen = opened.includes(day);
    return {
      day,
      opened: isOpen,
      watched: isOpen && watched.includes(day),
      film: isOpen ? { title: `Film ${day}` } : null,
    };
  });
}
const date = (year, month, day) => ({ year, month, day });

test('ordinals', () => {
  const cases = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 11: '11th', 12: '12th', 13: '13th', 21: '21st', 22: '22nd', 23: '23rd', 24: '24th', 31: '31st', 111: '111th' };
  for (const [n, s] of Object.entries(cases)) assert.equal(ordinal(Number(n)), s);
});

test('days until December, across month and year ends', () => {
  assert.equal(daysUntilDecember(date(2026, 11, 30), 2026), 1);
  assert.equal(daysUntilDecember(date(2026, 9, 27), 2026), 65); // the design doc's "65 days"
  assert.equal(daysUntilDecember(date(2026, 1, 7), 2026), 328);
  assert.equal(daysUntilDecember(date(2028, 2, 29), 2028), 276); // a leap day
});

test('the tag counts down before December', () => {
  assert.deepEqual(tagText({ today: date(2026, 9, 27), year: 2026, doors: doors() }),
    { line: 'The first door opens on the 1st of December.', sub: '65 days to go.' });
  assert.equal(tagText({ today: date(2026, 11, 30), year: 2026, doors: doors() }).sub, 'One more sleep.');
});

test('in December the tag names the day and nudges toward its door', () => {
  assert.deepEqual(tagText({ today: date(2026, 12, 14), year: 2026, doors: doors() }),
    { line: 'The 14th of December.', sub: 'Door 14 is lit.' });
  assert.equal(tagText({ today: date(2026, 12, 14), year: 2026, doors: doors({ opened: [14] }) }).sub, 'See you tomorrow.');
  assert.equal(tagText({ today: date(2026, 12, 24), year: 2026, doors: doors() }).sub, 'The big door is lit.');
  assert.equal(tagText({ today: date(2026, 12, 24), year: 2026, doors: doors({ opened: [24] }) }).sub, 'Merry Christmas.');
  assert.equal(tagText({ today: date(2026, 12, 31), year: 2026, doors: doors({ opened: [31] }) }).sub, 'Happy New Year.');
  assert.equal(tagText({ today: date(2026, 12, 1), year: 2026, doors: doors() }).line, 'The 1st of December.');
});

test('after Christmas the tag looks back, counting the films seen', () => {
  assert.deepEqual(tagText({ today: date(2027, 1, 3), year: 2026, doors: doors({ opened: [1, 2, 3], watched: [1, 3] }) }),
    { line: 'That was Stathmas 2026.', sub: '2 of 31 seen.' });
});

test('door labels read the state out plainly', () => {
  assert.equal(doorLabel({ day: 20, unlocked: false, opened: false }), 'December 20: not yet');
  assert.equal(doorLabel({ day: 7, unlocked: true, opened: false }), 'December 7: ready to open');
  assert.equal(doorLabel({ day: 7, unlocked: true, opened: true, watched: false, film: { title: 'Crank' } }), 'December 7: Crank');
  assert.equal(doorLabel({ day: 7, unlocked: true, opened: true, watched: true, film: { title: 'Crank' } }), 'December 7: Crank, seen');
});

test('the preview note is pencilled with a short month', () => {
  assert.equal(previewNote(date(2026, 12, 14)), 'preview: 14 Dec (rub out)');
  assert.equal(previewNote(date(2027, 1, 3)), 'preview: 3 Jan (rub out)');
});

test('long titles split over two balanced rows; short ones stay whole', () => {
  assert.deepEqual(splitTitle('CRANK'), ['CRANK']);
  assert.deepEqual(splitTitle('THE TRANSPORTER'), ['THE TRANSPORTER']);
  assert.deepEqual(splitTitle('IN THE NAME OF THE KING'), ['IN THE NAME', 'OF THE KING']);
  assert.deepEqual(splitTitle('SUPERCALIFRAGILISTIC'), ['SUPERCALIFRAGILISTIC']);
});

test('the picture house bills the latest film opened', () => {
  assert.deepEqual(billText(doors()), { top: 'COMING SOON', lines: ['JASON STATHAM'], foot: '31 NIGHTS ONLY' });
  const two = doors({ opened: [3, 9] });
  two[8].film.title = 'Meg 2: The Trench';
  assert.deepEqual(billText(two), { top: 'NOW SHOWING', lines: ['MEG 2', 'THE TRENCH'], foot: 'JASON STATHAM' });
  const long = doors({ opened: [5] });
  long[4].film.title = 'Lock, Stock and Two Smoking Barrels';
  assert.deepEqual(billText(long).lines, ['LOCK, STOCK AND', 'TWO SMOKING BARRELS']);
});
