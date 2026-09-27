// The calendar picture: a snowy village on Christmas Eve, drawn in two
// compositions (a wide card for desktop, a tall one for phones). Each
// composition lists its door slots; the doors themselves are HTML laid over
// the picture so they can swing open.

import { INK, rect, circ, ellipse, poly, path, line, star, offset, rng, esc } from './svg.js';

export const DAYS = 31;
export const BIG_DOOR = 24;

// ---------- drawing context ----------

function context(id, W, H) {
  return { id, W, H, defs: [], under: [], art: [], over: [], slots: [], specks: [], marquee: null, ribbon: null };
}

function slot(c, x, y, w, h, kind, opts = {}) {
  c.slots.push({ x, y, w, h, kind, color: opts.color, hinge: opts.hinge ?? (c.slots.length % 2 ? 'right' : 'left') });
}

function speck(c, x, y, s = 1) {
  c.specks.push({ x, y, s });
}

// ---------- scenery ----------

function sky(c, y0, y1) {
  c.under.push(rect(0, 0, c.W, c.H, INK.night, 'nl'));
  // A halftone screen of snow ink fading the sky toward the horizon.
  const bands = 8;
  const bh = (y1 - y0) / bands;
  for (let i = 0; i < bands; i++) {
    const r = 0.5 + i * 0.42;
    const id = `${c.id}-ht${i}`;
    c.defs.push(`<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="${r}" fill="${INK.snow}"/><circle cx="7.5" cy="7.5" r="${r}" fill="${INK.snow}"/></pattern>`);
    c.under.push(rect(0, y0 + i * bh, c.W, bh + (i === bands - 1 ? c.H : 0.5), `url(#${id})`, 'nl', { opacity: 0.5 }));
  }
}

function stars(c, list) {
  for (const [x, y, r] of list) {
    c.art.push(star(x, y, r, INK.candle));
    speck(c, x, y, r / 8);
  }
}

function title(c, x, y, size, anchor, ribbon) {
  c.over.push(`<text class="wordmark" x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${INK.berry}" stroke="${INK.snow}" stroke-width="${size * 0.07}" paint-order="stroke" stroke-linejoin="round">Stathmas</text>`);
  const { x0, x1, y: ry, h } = ribbon;
  const f = h * 0.55;
  // A banner with forked tails, folded under at each end.
  c.art.push(poly([[x0 - f * 1.6, ry + h * 0.35], [x0 + 4, ry + h * 0.35], [x0 + 4, ry + h * 1.35], [x0 - f * 1.6, ry + h * 1.35], [x0 - f * 0.9, ry + h * 0.85]], INK.berry));
  c.art.push(poly([[x1 + f * 1.6, ry + h * 0.35], [x1 - 4, ry + h * 0.35], [x1 - 4, ry + h * 1.35], [x1 + f * 1.6, ry + h * 1.35], [x1 + f * 0.9, ry + h * 0.85]], INK.berry));
  c.art.push(poly([[x0, ry + h], [x0 + 12, ry + h * 1.35], [x0 + 12, ry + h]], INK.key, 'nl'));
  c.art.push(poly([[x1, ry + h], [x1 - 12, ry + h * 1.35], [x1 - 12, ry + h]], INK.key, 'nl'));
  c.art.push(rect(x0, ry, x1 - x0, h, INK.berry));
  c.ribbon = { x: (x0 + x1) / 2, y: ry + h * 0.68, size: h * 0.52 };
}

// A hill or snowfield: filled down past the bottom of the picture, with only
// its top edge drawn in line.
function hills(c, top, fill) {
  c.art.push(path(`${top} L${c.W + 20},${c.H + 20} L-20,${c.H + 20} Z`, fill, 'nl'));
  c.art.push(path(top, 'none', 'lo'));
}

function farTree(c, cx, base, h) {
  c.art.push(poly([[cx - h * 0.3, base], [cx, base - h], [cx + h * 0.3, base]], INK.fir));
}

function tree(c, cx, base, h, w = h * 0.62) {
  const trunk = h * 0.1;
  c.art.push(rect(cx - w * 0.06, base - trunk - 2, w * 0.12, trunk + 2, INK.key));
  for (let i = 0; i < 3; i++) {
    const yb = base - trunk - i * h * 0.26;
    const th = h * 0.42;
    const tw = w * (1 - i * 0.28);
    const ya = yb - th;
    c.art.push(poly([[cx - tw / 2, yb], [cx, ya], [cx + tw / 2, yb]], INK.fir));
    // A cap of snow over the top half of each tier, scalloped where it ends.
    // The tier above hides all of it but a scalloped band.
    const y1 = ya + th * 0.5, hw = tw / 4, d = th * 0.13;
    c.art.push(path(`M${cx},${ya} L${cx + hw},${y1} Q${cx + hw * 0.66},${y1 + d} ${cx + hw * 0.33},${y1} Q${cx},${y1 + d} ${cx - hw * 0.33},${y1} Q${cx - hw * 0.66},${y1 + d} ${cx - hw},${y1} Z`, INK.snow));
    speck(c, cx - hw * 0.5, y1 - 2, 0.7);
  }
}

function chevron(x0, x1, yEave, yApex, t) {
  const cx = (x0 + x1) / 2;
  const k = (t * (x1 - x0)) / 2 / (yEave - yApex);
  return [[x0, yEave], [cx, yApex], [x1, yEave], [x1 - k, yEave], [cx, yApex + t], [x0 + k, yEave]];
}

function roof(c, x, w, top, apex, color) {
  c.art.push(poly(chevron(x - 14, x + w + 14, top + 12, apex - 12, 24), color));
  c.art.push(poly(chevron(x - 18, x + w + 18, top + 5, apex - 21, 21), INK.snow));
  speck(c, x + w * 0.25, (top + apex) / 2 - 12, 0.8);
  speck(c, x + w * 0.8, top - (top - apex) * 0.35 - 8, 0.8);
}

function chimney(c, x, w, top, apex, fx = 0.72) {
  const cx = x + w * fx;
  const roofY = apex + (Math.abs(cx - (x + w / 2)) / (w / 2)) * (top - apex);
  c.art.push(rect(cx - 11, roofY - 56, 22, 60, INK.berry));
  c.art.push(rect(cx - 14, roofY - 62, 28, 9, INK.snow));
  c.over.push(circ(cx + 6, roofY - 78, 8, INK.snow, 'nl', { opacity: 0.35 }));
  c.over.push(circ(cx + 16, roofY - 96, 11, INK.snow, 'nl', { opacity: 0.25 }));
  c.over.push(circ(cx + 30, roofY - 120, 14, INK.snow, 'nl', { opacity: 0.15 }));
}

// A front-gabled house. Windows and doors are added by the caller.
function house(c, { x, w, top, apex, base, wall, roofColor = INK.key, chimneyAt = 0.72, attic = true }) {
  if (chimneyAt) chimney(c, x, w, top, apex, chimneyAt);
  c.art.push(poly([[x, base], [x, top], [x + w / 2, apex], [x + w, top], [x + w, base]], wall));
  roof(c, x, w, top, apex, roofColor);
  if (attic && top - apex > 60) {
    const ay = apex + (top - apex) * 0.6;
    c.art.push(circ(x + w / 2, ay, 10, INK.candle));
    c.art.push(line(x + w / 2 - 10, ay, x + w / 2 + 10, ay));
    c.art.push(line(x + w / 2, ay - 10, x + w / 2, ay + 10));
  }
}

function frame(c, x, y, w, h, color = INK.card) {
  c.art.push(rect(x - 5, y - 5, w + 10, h + 10, color));
  c.art.push(rect(x - 8, y + h + 4, w + 16, 7, INK.snow));
}

function litWindow(c, x, y, w, h, color) {
  frame(c, x, y, w, h, color);
  c.art.push(rect(x, y, w, h, INK.candle));
  c.art.push(line(x + w / 2, y, x + w / 2, y + h));
  c.art.push(line(x, y + h / 2, x + w, y + h / 2));
}

function windowSlot(c, x, y, w, h, color) {
  frame(c, x, y, w, h, color);
  slot(c, x, y, w, h, 'window');
}

function doorSlot(c, x, y, w, h, color) {
  c.art.push(rect(x - 6, y - 6, w + 12, h + 6, INK.card));
  c.art.push(rect(x - 12, y + h - 2, w + 24, 8, INK.snow));
  slot(c, x, y, w, h, 'door', { color });
}

function cinema(c, { x, w, top, base }) {
  c.art.push(rect(x + 60, top - 46, w - 120, 24, INK.card));
  c.art.push(rect(x + 24, top - 24, w - 48, 26, INK.card));
  c.art.push(rect(x + 56, top - 52, w - 112, 8, INK.snow));
  c.art.push(rect(x + 20, top - 30, w - 40, 8, INK.snow));
  c.art.push(rect(x, top, w, base - top, INK.card));
  c.art.push(rect(x - 4, top - 4, w + 8, 10, INK.snow));
  c.over.push(`<text class="sign" x="${x + w / 2}" y="${top - 5}" text-anchor="middle" font-size="17" fill="${INK.berry}">PICTURE HOUSE</text>`);
  // the bill: a lit letter board, filled in by the page
  const mx = x + 14, my = top + 20, mw = w - 28, mh = 66;
  c.art.push(rect(mx - 6, my - 6, mw + 12, mh + 12, INK.berry));
  c.art.push(rect(mx, my, mw, mh, INK.card));
  for (let bx = mx + 6; bx <= mx + mw - 4; bx += 16) {
    c.art.push(circ(bx, my - 3, 2.6, INK.candle, 'nl'));
    c.art.push(circ(bx, my + mh + 3, 2.6, INK.candle, 'nl'));
  }
  c.art.push(line(mx + 6, my + 19, mx + mw - 6, my + 19, 'lo', { opacity: 0.3 }));
  c.art.push(line(mx + 6, my + mh - 15, mx + mw - 6, my + mh - 15, 'lo', { opacity: 0.3 }));
  c.marquee = { x: mx, y: my, w: mw, h: mh };
  c.art.push(rect(x + 6, my + mh + 12, w - 12, 10, INK.berry));
  speck(c, x + w * 0.3, top - 26);
  speck(c, x + w * 0.7, top - 48);
}

function posterSlot(c, x, y, w, h) {
  c.art.push(rect(x - 5, y - 5, w + 10, h + 10, INK.berry));
  slot(c, x, y, w, h, 'poster');
}

function church(c, t) {
  const { tx, tw, ttop, spire, nx, nw, ntop, napex, base } = t;
  // tower and spire
  c.art.push(rect(tx, ttop, tw, base - ttop, INK.card));
  c.art.push(poly([[tx - 8, ttop], [tx + tw / 2, spire], [tx + tw + 8, ttop]], INK.berry));
  c.art.push(rect(tx - 10, ttop - 4, tw + 20, 10, INK.snow));
  c.art.push(line(tx + tw / 2, spire, tx + tw / 2, spire - 26));
  c.art.push(line(tx + tw / 2 - 9, spire - 17, tx + tw / 2 + 9, spire - 17));
  speck(c, tx + tw / 2, spire - 26, 1.2);
  // nave
  c.art.push(poly([[nx, base], [nx, ntop], [nx + nw / 2, napex], [nx + nw, ntop], [nx + nw, base]], INK.card));
  roof(c, nx, nw, ntop, napex, INK.berry);
  const ry = napex + (ntop - napex) * 0.62;
  c.art.push(circ(nx + nw / 2, ry, 15, INK.candle));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    c.art.push(line(nx + nw / 2 - Math.cos(a) * 15, ry - Math.sin(a) * 15, nx + nw / 2 + Math.cos(a) * 15, ry + Math.sin(a) * 15));
  }
  // arched side windows
  for (const wx of [nx + 20, nx + nw - 48]) {
    c.art.push(path(`M${wx},${base - 40} V${ntop + 40} A14,14 0 0 1 ${wx + 28},${ntop + 40} V${base - 40} Z`, INK.candle));
    c.art.push(line(wx + 14, ntop + 30, wx + 14, base - 40));
  }
  // the big double door, arched, on the nave front
  const dw = t.doorW, dh = t.doorH, dx = nx + nw / 2 - dw / 2, dy = base - dh;
  c.art.push(path(`M${dx - 10},${base} V${dy + 4} A${dw / 2 + 10},${dw / 2 + 10} 0 0 1 ${dx + dw + 10},${dy + 4} V${base} Z`, INK.key, 'nl'));
  c.art.push(rect(dx - 18, base - 4, dw + 36, 10, INK.snow));
  slot(c, dx, dy, dw, dh, 'church', { hinge: 'both' });
}

function lamp(c, x, y0, base) {
  c.art.push(circ(x, y0 + 6, 34, INK.candle, 'nl', { opacity: 0.18 }));
  c.art.push(rect(x - 4, y0 + 18, 8, base - y0 - 18, INK.key));
  c.art.push(rect(x - 12, base - 8, 24, 8, INK.key));
  c.art.push(poly([[x - 12, y0 + 18], [x - 16, y0], [x + 16, y0], [x + 12, y0 + 18]], INK.candle));
  c.art.push(poly([[x - 20, y0], [x, y0 - 14], [x + 20, y0]], INK.key));
  c.art.push(poly([[x - 21, y0 - 2], [x, y0 - 17], [x + 21, y0 - 2], [x, y0 - 11]], INK.snow, 'nl'));
  speck(c, x - 8, y0 - 10);
}

function snowman(c, cx, base, r) {
  const b = r, m = r * 0.72, h = r * 0.48;
  const cb = base - b, cm = cb - b - m * 0.7, ch = cm - m - h * 0.7;
  c.art.push(ellipse(cx, base, b * 1.2, 8, INK.shade, 'nl'));
  c.art.push(circ(cx, cb, b, INK.snow));
  c.art.push(circ(cx, cm, m, INK.snow));
  c.art.push(circ(cx, ch, h, INK.snow));
  c.art.push(path(`M${cx - h * 0.9},${ch + h * 0.55} Q${cx},${ch + h * 1.05} ${cx + h * 0.9},${ch + h * 0.55} L${cx + h * 0.95},${ch + h * 0.9} Q${cx},${ch + h * 1.35} ${cx - h * 0.95},${ch + h * 0.9} Z`, INK.berry));
  c.art.push(rect(cx + h * 0.35, ch + h * 0.75, h * 0.34, h * 0.9, INK.berry));
  c.art.push(rect(cx - h * 0.95, ch - h * 0.78, h * 1.9, h * 0.22, INK.key));
  c.art.push(rect(cx - h * 0.62, ch - h * 1.75, h * 1.24, h * 1.0, INK.key));
  c.art.push(poly([[cx, ch + h * 0.05], [cx + h * 0.75, ch + h * 0.2], [cx, ch + h * 0.3]], INK.candle));
  c.art.push(circ(cx - h * 0.35, ch - h * 0.2, h * 0.1, INK.key, 'nl'));
  c.art.push(circ(cx + h * 0.3, ch - h * 0.2, h * 0.1, INK.key, 'nl'));
  c.art.push(line(cx - m * 0.9, cm - m * 0.1, cx - m * 1.9, cm - m * 0.9));
  c.art.push(line(cx + m * 0.9, cm - m * 0.1, cx + m * 1.8, cm - m * 1.0));
  speck(c, cx - b * 0.5, cb - b * 0.5);
  return { cx, cm, m, cb, b };
}

function sled(c, x, y, w) {
  c.art.push(rect(x, y, w, 14, INK.berry));
  c.art.push(path(`M${x - 6},${y + 30} H${x + w + 4} Q${x + w + 22},${y + 30} ${x + w + 18},${y + 14}`, 'none', 'lo'));
  c.art.push(line(x + 16, y + 14, x + 16, y + 30));
  c.art.push(line(x + w - 16, y + 14, x + w - 16, y + 30));
  c.art.push(path(`M${x + w + 18},${y + 14} Q${x + w + 60},${y - 10} ${x + w + 90},${y + 20}`, 'none', 'lo', { opacity: 0.7 }));
}

const ground = (c, top) => hills(c, top, INK.snow);

function drift(c, cx, cy, rx, ry) {
  c.art.push(ellipse(cx, cy, rx, ry, INK.shade, 'nl', { opacity: 0.7 }));
}

function groundSpecks(c, x0, x1, y0, y1, count, seed) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) speck(c, x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.6 + r() * 0.6);
}

// ---------- numbering ----------

// Numbers are scattered by composition, not placed in order: the hunt is the
// point. The church's big double door is always 24, Christmas Eve.
function number(c, seed) {
  const r = rng(seed);
  const rest = Array.from({ length: DAYS }, (_, i) => i + 1).filter((d) => d !== BIG_DOOR);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  let k = 0;
  for (const s of c.slots) s.n = s.kind === 'church' ? BIG_DOOR : rest[k++];
}

// ---------- compositions ----------

function wide() {
  const c = context('w', 1500, 1000);
  sky(c, 330, 600);
  stars(c, [[640, 60, 9], [700, 250, 7], [860, 120, 11], [1010, 70, 7], [1180, 210, 9], [1440, 250, 8], [310, 330, 7], [60, 320, 10], [470, 340, 6], [1040, 300, 6], [1290, 360, 7], [1455, 60, 7], [560, 170, 5], [95, 60, 6]]);
  title(c, 118, 198, 146, 'start', { x0: 170, x1: 600, y: 236, h: 46 });

  // sky doors: the moon and five stars
  slot(c, 1316, 84, 84, 84, 'moon');
  for (const [x, y] of [[760, 170], [930, 235], [1090, 110], [1210, 285], [520, 300]]) slot(c, x, y, 68, 68, 'star');

  hills(c, 'M-20,562 C200,505 380,545 560,520 C760,492 900,545 1100,505 C1250,478 1380,505 1520,486', INK.shade);
  for (const [x, h] of [[40, 50], [80, 34], [330, 44], [470, 52], [515, 36], [880, 40], [935, 56], [985, 38]]) farTree(c, x, 535 + (x % 7), h);
  hills(c, 'M880,1020 C900,760 960,640 1060,560 C1160,490 1300,466 1520,460', INK.snow);

  church(c, { tx: 1125, tw: 90, ttop: 345, spire: 230, nx: 1200, nw: 230, ntop: 470, napex: 380, base: 655, doorW: 112, doorH: 130 });
  windowSlot(c, 1140, 372, 60, 70, INK.card);

  ground(c, 'M-20,802 C150,782 300,812 500,796 C700,782 900,816 1100,796 C1300,780 1400,800 1520,790');

  // the village street
  house(c, { x: 40, w: 180, top: 590, apex: 500, base: 792, wall: INK.berry, roofColor: INK.key });
  windowSlot(c, 60, 612, 58, 58, INK.card);
  windowSlot(c, 142, 612, 58, 58, INK.card);
  windowSlot(c, 60, 706, 58, 58, INK.card);
  doorSlot(c, 144, 700, 56, 92, INK.fir);

  house(c, { x: 232, w: 160, top: 622, apex: 540, base: 792, wall: INK.card, roofColor: INK.berry, chimneyAt: 0.3 });
  windowSlot(c, 250, 642, 56, 56, INK.fir);
  windowSlot(c, 318, 642, 56, 56, INK.fir);
  litWindow(c, 250, 722, 40, 44, INK.fir);
  doorSlot(c, 316, 704, 58, 88, INK.berry);

  house(c, { x: 402, w: 198, top: 560, apex: 455, base: 792, wall: INK.fir, roofColor: INK.key });
  windowSlot(c, 424, 582, 58, 58, INK.card);
  windowSlot(c, 520, 582, 58, 58, INK.card);
  windowSlot(c, 424, 690, 58, 58, INK.card);
  doorSlot(c, 522, 702, 56, 90, INK.berry);

  cinema(c, { x: 612, w: 240, top: 560, base: 792 });
  posterSlot(c, 632, 686, 54, 80);
  slot(c, 706, 692, 64, 100, 'entrance');
  posterSlot(c, 790, 686, 54, 80);

  house(c, { x: 866, w: 170, top: 600, apex: 520, base: 792, wall: INK.shade, roofColor: INK.berry });
  windowSlot(c, 884, 620, 56, 56, INK.card);
  windowSlot(c, 962, 620, 56, 56, INK.card);
  litWindow(c, 886, 716, 44, 44, INK.card);
  doorSlot(c, 958, 702, 58, 90, INK.fir);

  house(c, { x: 1048, w: 150, top: 632, apex: 562, base: 792, wall: INK.berry, roofColor: INK.key, chimneyAt: 0.28 });
  windowSlot(c, 1064, 652, 56, 56, INK.card);
  windowSlot(c, 1064, 728, 56, 50, INK.card);
  doorSlot(c, 1130, 704, 56, 88, INK.fir);

  lamp(c, 397, 600, 880);

  // foreground
  drift(c, 250, 960, 220, 26);
  drift(c, 900, 975, 260, 22);
  drift(c, 1320, 950, 150, 18);
  sled(c, 250, 890, 200);
  slot(c, 262, 810, 86, 80, 'parcel', { color: INK.berry });
  slot(c, 356, 826, 76, 64, 'parcel', { color: INK.fir });
  const sm = snowman(c, 760, 992, 44);
  slot(c, sm.cx - 31, sm.cm - 31, 62, 62, 'snow');
  tree(c, 60, 990, 190);
  tree(c, 560, 975, 120);
  tree(c, 1260, 985, 170);
  tree(c, 1430, 995, 300, 170);
  groundSpecks(c, 20, 1480, 815, 990, 46, 7);

  number(c, 1962);
  return c;
}

function tall() {
  const c = context('t', 600, 1300);
  sky(c, 300, 520);
  stars(c, [[140, 40, 7], [470, 60, 9], [560, 170, 6], [30, 190, 6], [390, 330, 7], [120, 450, 6], [540, 390, 8], [275, 240, 5]]);
  title(c, 300, 150, 116, 'middle', { x0: 150, x1: 450, y: 172, h: 38 });

  slot(c, 492, 226, 84, 84, 'moon');
  for (const [x, y] of [[26, 250], [318, 244], [36, 370], [420, 340]]) slot(c, x, y, 64, 64, 'star');

  hills(c, 'M-20,542 C150,500 350,556 620,513', INK.shade);
  for (const [x, h] of [[30, 40], [70, 28], [520, 44], [560, 30]]) farTree(c, x, 548, h);
  hills(c, 'M-20,705 C120,652 220,640 620,626', INK.snow);

  church(c, { tx: 150, tw: 80, ttop: 400, spire: 300, nx: 230, nw: 240, ntop: 470, napex: 380, base: 640, doorW: 104, doorH: 124 });
  windowSlot(c, 160, 422, 60, 66, INK.card);

  ground(c, 'M-20,1182 C150,1165 300,1190 450,1175 C520,1168 560,1176 620,1172');

  // upper lane: three houses
  const rowA = [
    { x: 14, wall: INK.berry, roofColor: INK.key, top: 722, apex: 640, win: INK.card, door: INK.fir, chimneyAt: 0.22 },
    { x: 208, wall: INK.card, roofColor: INK.berry, top: 726, apex: 660, win: INK.fir, door: INK.berry, chimneyAt: 0.3 },
    { x: 402, wall: INK.fir, roofColor: INK.key, top: 716, apex: 628, win: INK.card, door: INK.berry, chimneyAt: 0.72 },
  ];
  for (const h of rowA) {
    house(c, { x: h.x, w: 184, top: h.top, apex: h.apex, base: 902, wall: h.wall, roofColor: h.roofColor, chimneyAt: h.chimneyAt, attic: false });
    windowSlot(c, h.x + 18, h.top + 18, 64, 62, h.win);
    windowSlot(c, h.x + 102, h.top + 18, 64, 62, h.win);
    windowSlot(c, h.x + 18, 824, 64, 64, h.win);
    doorSlot(c, h.x + 104, 810, 62, 92, h.door);
  }
  c.art.push(rect(0, 902, 600, 14, INK.snow));

  // lower lane: the picture house and two houses
  cinema(c, { x: 12, w: 276, top: 972, base: 1172 });
  posterSlot(c, 30, 1082, 62, 80);
  slot(c, 118, 1082, 64, 90, 'entrance');
  posterSlot(c, 208, 1082, 62, 80);
  house(c, { x: 300, w: 144, top: 1000, apex: 930, base: 1172, wall: INK.shade, roofColor: INK.berry, chimneyAt: 0.3, attic: false });
  windowSlot(c, 306, 1016, 62, 62, INK.card);
  windowSlot(c, 376, 1016, 62, 62, INK.card);
  doorSlot(c, 342, 1086, 62, 86, INK.fir);
  house(c, { x: 454, w: 142, top: 1010, apex: 944, base: 1172, wall: INK.berry, roofColor: INK.key, chimneyAt: 0, attic: false });
  windowSlot(c, 460, 1026, 62, 60, INK.card);
  windowSlot(c, 528, 1026, 62, 60, INK.card);
  doorSlot(c, 494, 1090, 62, 82, INK.fir);

  // foreground: the sled and its parcels
  drift(c, 300, 1280, 280, 16);
  sled(c, 22, 1250, 260);
  slot(c, 30, 1182, 76, 68, 'parcel', { color: INK.berry });
  slot(c, 114, 1194, 66, 56, 'parcel', { color: INK.fir });
  slot(c, 188, 1180, 72, 70, 'parcel', { color: INK.candle });
  snowman(c, 420, 1292, 30);
  tree(c, 540, 1296, 110);
  groundSpecks(c, 10, 590, 1190, 1296, 18, 11);

  number(c, 1962);
  return c;
}

// ---------- output ----------

function specksSvg(c) {
  const f = (v) => Math.round(v * 10) / 10;
  return `<g class="glitter">${c.specks.map(({ x, y, s }) => {
    const r = 3.2 * s, q = r * 0.28;
    return `<path class="speck" d="M${f(x)},${f(y - r)} L${f(x + q)},${f(y - q)} L${f(x + r)},${f(y)} L${f(x + q)},${f(y + q)} L${f(x)},${f(y + r)} L${f(x - q)},${f(y + q)} L${f(x - r)},${f(y)} L${f(x - q)},${f(y - q)} Z" fill="${INK.snow}"/>`;
  }).join('')}</g>`;
}

function render(c) {
  const m = c.marquee;
  const marquee = m ? `<g class="marquee" data-x="${m.x}" data-y="${m.y}" data-w="${m.w}" data-h="${m.h}"></g>` : '';
  const ribbon = c.ribbon
    ? `<text class="ribbon-text" x="${c.ribbon.x}" y="${c.ribbon.y}" text-anchor="middle" font-size="${c.ribbon.size}" fill="${INK.snow}">A Christmas Calendar</text>`
    : '';
  return `<svg class="scene-svg" viewBox="0 0 ${c.W} ${c.H}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">`
    + `<defs>${c.defs.join('')}</defs>`
    + c.under.join('')
    + c.art.join('')
    + c.over.join('') + ribbon + marquee + specksSvg(c)
    + '</svg>';
}

const cache = {};
export function composition(name) {
  if (!cache[name]) {
    const c = offset([1.4, 1], () => (name === 'tall' ? tall() : wide()));
    cache[name] = { name, width: c.W, height: c.H, svg: render(c), slots: c.slots };
  }
  return cache[name];
}
