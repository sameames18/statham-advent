// A visitor's doors, kept in their own browser rather than on the server:
// one cookie per year, `stathmas-2026=<opened>.<watched>`, each a bitmask of
// days in hex (bit 0 is the 1st of December).
//
// Nothing here needs protecting from the visitor. The server only hands out
// a film once its date has come, whatever the cookie says, so a forged
// "opened" mark reveals nothing its owner couldn't open anyway.

const ALL_DAYS = 2 ** 31 - 1;
// Browsers cap cookie lifetimes at 400 days; this outlasts a season.
const MAX_AGE = 400 * 24 * 60 * 60;
const VALUE = /^([0-9a-f]{1,8})\.([0-9a-f]{1,8})$/;

export const NONE = Object.freeze({ opened: 0, watched: 0 });

export const cookieName = (year) => `stathmas-${year}`;
const bit = (day) => 1 << (day - 1);

export function readMarks(cookieHeader, year) {
  const name = cookieName(year);
  for (const part of (cookieHeader ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (part.slice(0, eq).trim() !== name) continue;
    const m = VALUE.exec(part.slice(eq + 1).trim());
    if (!m) return NONE;
    const opened = parseInt(m[1], 16) & ALL_DAYS;
    // A door can't be seen without being opened.
    return { opened, watched: parseInt(m[2], 16) & opened };
  }
  return NONE;
}

export const isOpened = (marks, day) => (marks.opened & bit(day)) !== 0;
export const isWatched = (marks, day) => (marks.watched & bit(day)) !== 0;

export const withOpened = (marks, day) => ({ opened: marks.opened | bit(day), watched: marks.watched });

export function withWatched(marks, day, watched) {
  const opened = marks.opened | bit(day);
  return { opened, watched: watched ? marks.watched | bit(day) : marks.watched & ~bit(day) };
}

// The Set-Cookie value for a year's marks. No doors open clears the cookie.
export function marksCookie(year, marks, secure) {
  const value = marks.opened ? `${marks.opened.toString(16)}.${marks.watched.toString(16)}` : '';
  const age = marks.opened ? MAX_AGE : 0;
  return `${cookieName(year)}=${value}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
