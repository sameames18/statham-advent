// The film catalog and each year's calendar, with nothing stored anywhere.
// The films come from films.json; a year's draw is worked out from the
// secret (see drawSeed), so every server instance shows the same calendar.

import films from './data/films.json' with { type: 'json' };
import { buildCalendar, drawSeed } from './calendar.js';

const REQUIRED = ['slug', 'title', 'year', 'director', 'runtime', 'character', 'logline', 'note'];

function check(list) {
  const seen = new Set();
  for (const f of list) {
    const missing = REQUIRED.filter((k) => f[k] === undefined || f[k] === null || f[k] === '');
    if (missing.length) throw new Error(`films.json: "${f.slug ?? f.title}" is missing ${missing.join(', ')}`);
    if (seen.has(f.slug)) throw new Error(`films.json: the slug "${f.slug}" is used twice`);
    seen.add(f.slug);
  }
  return list;
}

// `list` defaults to films.json; tests pass their own.
export function loadCatalog({ secret, list = films }) {
  if (!secret) throw new Error('loadCatalog needs a secret');
  const bySlug = new Map(check(list).map((f) => [f.slug, f]));
  // Drawn from the slugs in sorted order, so reordering films.json changes
  // nothing. Adding or removing a film does redraw every year: do that
  // before December, never during it.
  const slugs = [...bySlug.keys()].sort();
  // Release order, oldest first; ties keep their films.json order.
  const releaseOrder = [...list].sort((a, b) => a.year - b.year);
  const draws = new Map();

  function days(year) {
    let draw = draws.get(year);
    if (!draw) {
      draw = buildCalendar(slugs, drawSeed(secret, year))
        .map(({ day, filmId, encore }) => ({ day, encore, film: bySlug.get(filmId) }));
      draws.set(year, draw);
    }
    return draw;
  }

  return {
    films: () => releaseOrder,
    days,
    // One day's entry, or undefined if the day is out of range.
    day: (year, day) => days(year)[day - 1],
  };
}
