// Pure calendar logic: no I/O, so it can be tested directly.

export const DAYS_IN_DECEMBER = 31;

// Small seeded PRNG (mulberry32). Same seed, same calendar.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const hasAdjacentRepeat = (ids) => ids.some((id, i) => i > 0 && ids[i - 1] === id);

// Assign every film to a day of December. Every film appears at least once;
// if there are fewer films than days, the spare days go to "encores" of
// distinct films, never on the day right after the original.
export function buildCalendar(filmIds, seed, days = DAYS_IN_DECEMBER) {
  if (filmIds.length === 0) throw new Error('No films to schedule');
  const rand = rng(seed);
  const pool = filmIds.length >= days ? shuffle(filmIds, rand).slice(0, days) : null;

  let order = pool;
  if (!order) {
    const spare = days - filmIds.length;
    const encores = [];
    while (encores.length < spare) encores.push(...shuffle(filmIds, rand));
    const picks = encores.slice(0, spare);
    for (let attempt = 0; attempt < 500; attempt++) {
      order = shuffle([...filmIds, ...picks], rand);
      if (!hasAdjacentRepeat(order)) break;
    }
  }

  const seen = new Set();
  return order.map((filmId, i) => {
    const encore = seen.has(filmId);
    seen.add(filmId);
    return { day: i + 1, filmId, encore };
  });
}

// Today's calendar date in an IANA time zone, as { year, month, day }.
export function dateIn(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Parse a YYYY-MM-DD preview date; null if malformed.
export function parseDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const [year, month, day] = m.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

// A door opens at local midnight on its day, and stays open afterwards.
export function isUnlocked(year, day, today) {
  if (today.year !== year) return today.year > year;
  return today.month === 12 && today.day >= day;
}

// Which December the site is currently counting down to.
export const seasonYear = (today) => today.year;
