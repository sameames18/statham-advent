// The printed front of each paper door. Each kind matches the thing it's
// cut into: a lit window, a front door, a star, a parcel on the sled.

import { INK, rect, circ, ellipse, poly, path, line, star, offset } from './svg.js';

const numeral = (x, y, size, n, fill, halo) =>
  `<text class="num" x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="${fill}"${halo ? ` stroke="${halo}" stroke-width="${size * 0.14}" paint-order="stroke" stroke-linejoin="round"` : ''}>${n}</text>`;

// A full moon filling the round door, a few craters printed in card.
function fullMoon(cx, cy, r) {
  return circ(cx, cy, r, INK.candle)
    + circ(cx - r * 0.5, cy - r * 0.48, r * 0.17, INK.card, undefined, { opacity: 0.75 })
    + circ(cx + r * 0.66, cy - r * 0.2, r * 0.12, INK.card, undefined, { opacity: 0.75 })
    + circ(cx - r * 0.6, cy + r * 0.45, r * 0.12, INK.card, undefined, { opacity: 0.75 })
    + circ(cx + r * 0.42, cy + r * 0.66, r * 0.09, INK.card, undefined, { opacity: 0.75 });
}

const ribbonFor = { [INK.berry]: INK.candle, [INK.fir]: INK.berry, [INK.candle]: INK.berry };

// Returns { art, over } for a door's front: art is printed in two plates,
// over (the numeral) sits on top in register.
function face(slot, w, h, leaf) {
  const m = Math.min(w, h);
  const n = slot.n;
  switch (slot.kind) {
    case 'window':
      return {
        art: rect(0, 0, w, h, INK.candle) + line(w / 2, 0, w / 2, h) + line(0, h / 2, w, h / 2),
        over: numeral(w / 2, h / 2 + m * 0.2, m * 0.56, n, INK.berry, INK.candle),
      };
    case 'door': {
      const col = slot.color ?? INK.berry;
      return {
        art: rect(0, 0, w, h, col)
          + rect(w * 0.16, h * 0.46, w * 0.68, h * 0.44, 'none', 'lo')
          + circ(w / 2, h * 0.2, w * 0.2, 'none', 'st', { stroke: INK.fir === col ? INK.card : INK.fir, 'stroke-width': w * 0.1 })
          + circ(w / 2, h * 0.2 + w * 0.2, w * 0.06, INK.berry === col ? INK.candle : INK.berry, 'nl')
          + circ(w * 0.8, h * 0.55, 3, INK.candle),
        over: numeral(w / 2, h * 0.78, m * 0.5, n, INK.snow),
      };
    }
    case 'star':
      return {
        art: rect(0, 0, w, h, INK.night, 'nl') + star(w / 2, h / 2 + 2, m * 0.47, INK.candle),
        over: numeral(w / 2, h / 2 + m * 0.15, m * 0.34, n, INK.key),
      };
    case 'moon':
      return {
        art: fullMoon(w / 2, h / 2, m / 2 - 1),
        over: numeral(w / 2, h / 2 + m * 0.17, m * 0.46, n, INK.berry, INK.candle),
      };
    case 'poster':
      return {
        art: rect(0, 0, w, h, INK.card) + star(w / 2, h * 0.2, m * 0.13, INK.berry)
          + line(w * 0.2, h * 0.84, w * 0.8, h * 0.84) + line(w * 0.3, h * 0.91, w * 0.7, h * 0.91),
        over: numeral(w / 2, h * 0.64, m * 0.56, n, INK.berry),
      };
    case 'entrance':
      return {
        art: rect(0, 0, w, h, INK.berry) + rect(w * 0.1, h * 0.08, w * 0.35, h * 0.62, INK.candle) + rect(w * 0.55, h * 0.08, w * 0.35, h * 0.62, INK.candle)
          + line(w / 2, 0, w / 2, h) + rect(w * 0.36, h * 0.44, 3, h * 0.14, INK.key, 'nl') + rect(w * 0.6, h * 0.44, 3, h * 0.14, INK.key, 'nl'),
        over: numeral(w / 2, h * 0.9, m * 0.34, n, INK.snow),
      };
    case 'parcel': {
      const col = slot.color ?? INK.berry;
      const rib = ribbonFor[col] ?? INK.candle;
      return {
        art: rect(0, h * 0.12, w, h * 0.88, col)
          + rect(w * 0.62, h * 0.12, w * 0.12, h * 0.88, rib) + rect(0, h * 0.42, w, h * 0.12, rib)
          + ellipse(w * 0.6, h * 0.1, w * 0.12, h * 0.1, rib) + ellipse(w * 0.76, h * 0.1, w * 0.12, h * 0.1, rib),
        over: numeral(w * 0.31, h * 0.4, m * 0.36, n, col === INK.candle ? INK.key : INK.snow),
      };
    }
    case 'snow':
      return {
        art: circ(w / 2, h / 2, m / 2, INK.snow, 'nl') + circ(w * 0.78, h * 0.3, 3.2, INK.key, 'nl') + circ(w * 0.8, h * 0.62, 3.2, INK.key, 'nl'),
        over: numeral(w * 0.44, h / 2 + m * 0.17, m * 0.48, n, INK.berry),
      };
    case 'church': {
      const digits = String(n);
      const d = leaf === 'left' ? digits[0] : digits[1] ?? '';
      const edge = leaf === 'left' ? w - 7 : 7;
      return {
        art: rect(0, 0, w, h, INK.fir)
          + line(w * 0.33, 0, w * 0.33, h) + line(w * 0.66, 0, w * 0.66, h)
          + rect(leaf === 'left' ? 0 : w * 0.35, h * 0.2, w * 0.65, 6, INK.key, 'nl') + rect(leaf === 'left' ? 0 : w * 0.35, h * 0.72, w * 0.65, 6, INK.key, 'nl')
          + circ(edge, h * 0.55, 5, 'none', 'st', { stroke: INK.candle, 'stroke-width': 2.2 }),
        over: numeral(w / 2, h * 0.58, h * 0.42, d, INK.snow, INK.fir),
      };
    }
    default:
      return { art: rect(0, 0, w, h, INK.card), over: numeral(w / 2, h / 2 + m * 0.18, m * 0.5, n, INK.berry) };
  }
}

export function faceSvg(slot, leaf = 'single') {
  const w = leaf === 'single' ? slot.w : slot.w / 2;
  const { art, over } = offset([0.9, 0.7], () => face(slot, w, slot.h, leaf));
  return `<svg class="face-svg" viewBox="0 0 ${w} ${slot.h}" preserveAspectRatio="none" aria-hidden="true">${art}${over}</svg>`;
}
