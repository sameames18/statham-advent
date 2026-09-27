// Everything the page says, worked out from the calendar data. No DOM here,
// so it runs in node tests as well as the browser.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th';
  return `${n}${s}`;
}

export function daysUntilDecember(today, year) {
  return Math.round((Date.UTC(year, 11, 1) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000);
}

export function doorLabel(d) {
  const date = `December ${d.day}`;
  if (d.opened) return `${date}: ${d.film.title}${d.watched ? ', seen' : ''}`;
  if (d.unlocked) return `${date}: ready to open`;
  return `${date}: not yet`;
}

// The two lines on the ribbon tag.
export function tagText({ today, year, doors }) {
  if (today.year > year) {
    return { line: `That was Stathmas ${year}.`, sub: `${doors.filter((d) => d.watched).length} of 31 seen.` };
  }
  if (today.month !== 12) {
    const n = daysUntilDecember(today, year);
    return { line: 'The first door opens on the 1st of December.', sub: n === 1 ? 'One more sleep.' : `${n} days to go.` };
  }
  const d = today.day;
  const line = `The ${ordinal(d)} of December.`;
  if (doors[d - 1].opened) return { line, sub: d === 31 ? 'Happy New Year.' : d === 24 ? 'Merry Christmas.' : 'See you tomorrow.' };
  return { line, sub: d === 24 ? 'The big door is lit.' : `Door ${d} is lit.` };
}

export function previewNote(today) {
  return `preview: ${today.day} ${MONTHS[today.month - 1].slice(0, 3)} (rub out)`;
}

// A long title split over two rows at the space that best balances them.
export function splitTitle(title) {
  if (title.length <= 16 || !title.includes(' ')) return [title];
  const words = title.split(' ');
  let best = [title];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) { best = [a, b]; bestDiff = diff; }
  }
  return best;
}

// What the picture house bills: the latest film opened, or a teaser before
// the first door. A subtitle goes on its own row, the way a theatre would
// letter it.
export function billText(doors) {
  const latest = doors.filter((d) => d.opened).at(-1);
  if (!latest) return { top: 'COMING SOON', lines: ['JASON STATHAM'], foot: '31 NIGHTS ONLY' };
  const title = latest.film.title.toUpperCase();
  const lines = title.includes(':') ? title.split(':').map((part) => part.trim()) : splitTitle(title);
  return { top: 'NOW SHOWING', lines, foot: 'JASON STATHAM' };
}
