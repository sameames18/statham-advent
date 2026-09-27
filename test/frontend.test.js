import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { composition, DAYS, BIG_DOOR } from '../public/js/scene.js';
import { EMBLEM_SLUGS, emblemImage } from '../public/js/emblems.js';
import { faceSvg } from '../public/js/doors.js';

const films = JSON.parse(readFileSync(new URL('../server/data/films.json', import.meta.url), 'utf8'));

test('there is one film for every door', () => {
  assert.equal(films.length, DAYS);
  assert.equal(new Set(films.map((f) => f.slug)).size, DAYS);
});

test('every film has an emblem, and every emblem has a film', () => {
  assert.deepEqual([...EMBLEM_SLUGS].sort(), films.map((f) => f.slug).sort());
  for (const f of films) {
    assert.ok(!/NaN|undefined/.test(emblemImage(f.slug)), f.slug);
    assert.match(emblemImage(f.slug), new RegExp(`/emblems/${f.slug}\\.webp`));
  }
});

for (const name of ['wide', 'tall']) {
  const comp = composition(name);

  test(`${name}: doors are numbered 1 to 31, once each, with 24 on the church`, () => {
    assert.deepEqual(comp.slots.map((s) => s.n).sort((a, b) => a - b), Array.from({ length: DAYS }, (_, i) => i + 1));
    const big = comp.slots.find((s) => s.n === BIG_DOOR);
    assert.equal(big.kind, 'church');
    const area = (s) => s.w * s.h;
    const others = comp.slots.filter((s) => s !== big).map(area).sort((x, y) => x - y);
    assert.ok(area(big) >= 1.8 * others.at(-1), 'the church door is the biggest door');
    assert.ok(area(big) >= 3 * others[Math.floor(others.length / 2)], 'and several times a typical door');
  });

  test(`${name}: doors sit inside the picture and never overlap`, () => {
    for (const s of comp.slots) {
      assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= comp.width && s.y + s.h <= comp.height, `door ${s.n} is off the card`);
    }
    for (const a of comp.slots) {
      for (const b of comp.slots) {
        if (a === b) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        assert.ok(apart, `doors ${a.n} and ${b.n} overlap`);
      }
    }
  });

  test(`${name}: the picture and every door face draw without bad numbers`, () => {
    assert.ok(!/NaN|undefined/.test(comp.svg));
    for (const s of comp.slots) {
      for (const leaf of s.kind === 'church' ? ['left', 'right'] : ['single']) {
        assert.ok(!/NaN|undefined/.test(faceSvg(s, leaf)), `door ${s.n}`);
      }
    }
  });
}

test('tall: every door is big enough to tap on a phone', () => {
  // The tall card is about 374 CSS px wide on a 390 px phone.
  const scale = 374 / composition('tall').width;
  for (const s of composition('tall').slots) {
    assert.ok(Math.min(s.w, s.h) * scale >= 34, `door ${s.n} is ${Math.round(Math.min(s.w, s.h) * scale)} px`);
  }
});
