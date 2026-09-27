// The small painted picture behind each door, one per film. Each is a
// Christmas object first and a Statham reference second. Drawn on a
// 100 × 100 grid in the calendar's seven inks.

import { INK, rect, circ, ellipse, poly, path, line, star, offset } from './svg.js';

const { card, night, snow, shade, fir, berry, candle, key } = INK;

const g = (transform, content) => `<g transform="${transform}">${content}</g>`;
const loop = (x, y) => circ(x, y, 4, 'none') + line(x, y + 4, x, y + 8);
const st = (d, color, width) => path(d, 'none', 'st', { stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });

function saloon(body = key) {
  return path('M10,62 H90 V53 L79,50 L68,38 H36 L25,50 L10,52 Z', body)
    + poly([[39, 41], [50, 41], [50, 50], [29, 50]], shade)
    + poly([[53, 41], [66, 41], [75, 50], [53, 50]], shade)
    + circ(28, 63, 8, key) + circ(28, 63, 3, card, 'nl')
    + circ(74, 63, 8, key) + circ(74, 63, 3, card, 'nl');
}

function heart(cx, cy, s, fill) {
  return path(`M${cx},${cy + s * 0.9} C${cx - s * 1.1},${cy + s * 0.2} ${cx - s * 1.1},${cy - s * 0.8} ${cx - s * 0.5},${cy - s * 0.8} C${cx - s * 0.2},${cy - s * 0.8} ${cx},${cy - s * 0.55} ${cx},${cy - s * 0.35} C${cx},${cy - s * 0.55} ${cx + s * 0.2},${cy - s * 0.8} ${cx + s * 0.5},${cy - s * 0.8} C${cx + s * 1.1},${cy - s * 0.8} ${cx + s * 1.1},${cy + s * 0.2} ${cx},${cy + s * 0.9} Z`, fill);
}

function diamond(cx, cy, s) {
  return poly([[cx - s, cy - s * 0.35], [cx - s * 0.5, cy - s * 0.8], [cx + s * 0.5, cy - s * 0.8], [cx + s, cy - s * 0.35], [cx, cy + s]], snow)
    + line(cx - s, cy - s * 0.35, cx + s, cy - s * 0.35) + line(cx - s * 0.5, cy - s * 0.8, cx, cy + s) + line(cx + s * 0.5, cy - s * 0.8, cx, cy + s)
    + poly([[cx - s * 0.5, cy - s * 0.8], [cx, cy - s * 0.35], [cx - s, cy - s * 0.35]], shade, 'nl');
}

function shotgun() {
  return rect(12, 46, 62, 5, key) + rect(12, 51, 54, 3, key)
    + poly([[72, 44], [90, 47], [95, 60], [83, 61], [72, 54]], candle)
    + path('M66,54 Q68,62 74,58', 'none', 'lo');
}

const E = {
  'lock-stock-and-two-smoking-barrels': () =>
    g('rotate(34 50 50)', shotgun()) + g('translate(100 0) scale(-1 1) rotate(34 50 50)', shotgun())
    + ellipse(41, 44, 10, 5, fir, undefined, { transform: 'rotate(-30 41 44)' })
    + ellipse(59, 44, 10, 5, fir, undefined, { transform: 'rotate(30 59 44)' })
    + circ(46, 49, 3.5, berry) + circ(54, 49, 3.5, berry) + circ(50, 45, 3.5, berry),

  snatch: () =>
    circ(40, 60, 22, berry)
    + path('M19,54 C30,62 50,64 61,52 L62,60 C50,72 30,70 19,62 Z', candle)
    + circ(33, 50, 3, key, 'nl')
    + diamond(72, 30, 14)
    + star(88, 14, 4, snow, 'nl'),

  'the-transporter': () =>
    poly([[80, 50], [93, 34], [96, 36], [85, 52]], key)
    + rect(79, 40, 13, 12, berry) + line(85.5, 40, 85.5, 52) + line(79, 46, 92, 46)
    + saloon(),

  'transporter-2': () =>
    g('rotate(-162 52 52)', saloon())
    + st('M6,30 C22,8 44,10 48,24', berry, 4)
    + st('M94,78 C80,94 60,92 56,80', berry, 4),

  chaos: () =>
    poly([[28, 78], [72, 78], [78, 92], [22, 92]], berry)
    + circ(50, 48, 30, shade)
    + poly([[36, 51], [50, 41], [64, 51]], card) + rect(38, 51, 24, 16, card)
    + line(43, 53, 43, 65) + line(48, 53, 48, 65) + line(53, 53, 53, 65) + line(58, 53, 58, 65)
    + rect(34, 67, 32, 5, card)
    + [[30, 30], [62, 26], [40, 22], [70, 40], [28, 44], [66, 60], [52, 32]].map(([x, y]) => circ(x, y, 1.8, snow, 'nl')).join('')
    + path('M30,34 A24,24 0 0 1 46,22', 'none', 'st', { stroke: snow, 'stroke-width': 3, 'stroke-linecap': 'round' }),

  revolver: () =>
    loop(50, 6)
    + rect(32, 82, 36, 8, berry)
    + poly([[36, 82], [64, 82], [60, 73], [40, 73]], berry)
    + poly([[42, 73], [58, 73], [54, 44], [46, 44]], berry)
    + rect(39, 39, 22, 6, berry)
    + poly([[41, 39], [59, 39], [63, 28], [37, 28]], berry)
    + rect(48, 14, 4, 14, berry) + rect(43, 18, 14, 4, berry),

  crank: () =>
    heart(50, 52, 34, candle)
    + st('M20,54 H34 L39,42 L46,66 L53,36 L58,58 L62,50 H80', snow, 3.5)
    + [[30, 34], [70, 34], [50, 78], [26, 64], [74, 64]].map(([x, y]) => circ(x, y, 2, snow, 'nl')).join(''),

  war: () =>
    line(50, 4, 50, 20)
    + ellipse(50, 52, 27, 31, berry)
    + ellipse(50, 52, 15, 31, 'none', 'lo') + line(50, 21, 50, 83)
    + rect(37, 18, 26, 7, candle) + rect(37, 79, 26, 7, candle)
    + rect(47, 86, 6, 10, candle),

  'the-bank-job': () =>
    rect(16, 36, 68, 46, shade)
    + rect(22, 42, 56, 34, 'none', 'lo')
    + rect(46, 36, 8, 46, berry) + rect(16, 54, 68, 8, berry)
    + ellipse(41, 30, 9, 6, berry) + ellipse(59, 30, 9, 6, berry) + circ(50, 32, 4, berry)
    + circ(68, 70, 3, key, 'nl') + rect(67, 71, 2, 5, key, 'nl'),

  'in-the-name-of-the-king': () =>
    poly([[22, 62], [22, 32], [36, 48], [50, 26], [64, 48], [78, 32], [78, 62]], candle)
    + rect(22, 62, 56, 16, candle)
    + circ(36, 70, 4, berry) + circ(50, 70, 4.5, fir) + circ(64, 70, 4, berry)
    + circ(22, 30, 3.5, snow) + circ(50, 24, 3.5, snow) + circ(78, 30, 3.5, snow),

  'death-race': () =>
    path('M12,64 H90 V54 L80,52 L72,42 H34 L24,52 L12,54 Z', fir)
    + poly([[4, 53], [12, 53], [12, 65], [4, 65]], key)
    + rect(35, 44, 16, 8, shade) + rect(54, 44, 15, 8, shade)
    + [[37, 46], [49, 46], [56, 46], [67, 46], [37, 50], [49, 50]].map(([x, y]) => circ(x, y, 1, key, 'nl')).join('')
    + circ(52, 58, 6, card) + `<text x="52" y="61" font-size="9" text-anchor="middle" class="lo-text" fill="${key}">14</text>`
    + circ(28, 66, 9, key) + circ(28, 66, 3.5, candle, 'nl')
    + circ(74, 66, 9, key) + circ(74, 66, 3.5, candle, 'nl'),

  'transporter-3': () =>
    ellipse(50, 44, 30, 22, 'none', 'lo')
    + Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      return circ(50 + Math.cos(a) * 30, 44 + Math.sin(a) * 22, 2.2, candle, 'nl');
    }).join('')
    + line(36, 64, 36, 70) + star(36, 75, 6, candle)
    + line(50, 66, 50, 72) + heart(50, 78, 7, berry)
    + line(64, 64, 64, 68) + rect(59, 68, 11, 13, key) + circ(64.5, 74, 3, berry, 'nl'),

  'crank-high-voltage': () =>
    rect(28, 26, 10, 10, berry) + rect(62, 26, 10, 10, shade)
    + rect(18, 34, 64, 46, key)
    + poly([[53, 42], [41, 60], [50, 60], [45, 76], [62, 54], [52, 54], [58, 42]], candle)
    + st('M12,48 L22,56 L32,44 L42,58 L52,44 L62,58 L72,44 L88,54', candle, 3),

  'the-expendables': () =>
    loop(50, 8)
    + rect(43, 20, 14, 9, candle)
    + circ(50, 56, 28, berry)
    + `<text x="50" y="64" font-size="22" text-anchor="middle" class="script" fill="${snow}">Lee</text>`
    + st('M24,44 Q37,38 50,44 T76,44', candle, 2.5)
    + st('M24,70 Q37,64 50,70 T76,70', candle, 2.5),

  'the-mechanic': () =>
    st('M50,20 C70,10 88,20 90,40', candle, 2.5)
    + circ(50, 17, 5, 'none') + rect(46, 22, 8, 8, candle)
    + circ(50, 56, 28, candle) + circ(50, 56, 22, card)
    + line(50, 37, 50, 41) + line(50, 71, 50, 75) + line(31, 56, 35, 56) + line(65, 56, 69, 56)
    + line(50, 56, 50, 42) + line(50, 56, 61, 61) + circ(50, 56, 2, key, 'nl'),

  blitz: () =>
    g('rotate(-30 50 50)',
      rect(46, 4, 8, 60, candle)
      + path('M42,62 C36,80 44,94 60,92 C70,90 70,78 62,70 L54,62 Z', candle)
      + rect(45, 16, 10, 8, berry))
    + circ(76, 74, 9, snow) + path('M69,70 Q76,76 83,70', 'none', 'lo') + path('M69,78 Q76,72 83,78', 'none', 'lo'),

  'killer-elite': () =>
    circ(50, 14, 5, 'none') + rect(46, 18, 8, 6, candle)
    + circ(50, 54, 30, candle) + circ(50, 54, 23, card)
    + line(50, 33, 50, 37) + line(50, 71, 50, 75) + line(29, 54, 33, 54) + line(67, 54, 71, 54)
    + poly([[50, 36], [55, 54], [45, 54]], berry) + poly([[50, 72], [55, 54], [45, 54]], key)
    + circ(50, 54, 2.5, candle, 'nl'),

  safe: () =>
    rect(26, 80, 8, 7, key) + rect(66, 80, 8, 7, key)
    + rect(20, 22, 60, 58, fir)
    + rect(27, 29, 46, 44, 'none', 'lo')
    + circ(48, 51, 12, card)
    + Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return line(48 + Math.cos(a) * 9, 51 + Math.sin(a) * 9, 48 + Math.cos(a) * 12, 51 + Math.sin(a) * 12);
    }).join('')
    + circ(48, 51, 3.5, key) + rect(66, 44, 4, 14, candle),

  parker: () =>
    rect(26, 88, 48, 6, key)
    + line(50, 46, 32, 88) + line(50, 46, 68, 88)
    + circ(50, 46, 32, 'none') + circ(50, 46, 6, candle)
    + Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const x = 50 + Math.cos(a) * 32, y = 46 + Math.sin(a) * 32;
      return line(50, 46, x, y) + rect(x - 5, y, 10, 8, [berry, candle, fir, shade][i % 4]);
    }).join(''),

  hummingbird: () =>
    loop(50, 4)
    + poly([[32, 62], [12, 76], [20, 62], [10, 52]], fir)
    + ellipse(46, 58, 21, 11, fir, undefined, { transform: 'rotate(-25 46 58)' })
    + circ(65, 42, 9, fir)
    + st('M73,39 L95,29', key, 2)
    + ellipse(61, 50, 6, 4, berry)
    + path('M42,52 C32,26 46,14 60,18 C56,30 54,42 50,54 Z', shade)
    + circ(67, 40, 1.8, key, 'nl'),

  homefront: () =>
    st('M14,60 C6,66 6,78 14,86', key, 1.5)
    + circ(32, 71, 6, candle) + circ(64, 71, 6, candle)
    + path('M14,60 C20,46 60,44 80,50 L95,55 L80,60 C60,68 24,70 14,60 Z', fir)
    + [[28, 50], [38, 47], [48, 46], [58, 46]].map(([x, y]) => circ(x, y, 3.5, fir)).join('')
    + poly([[84, 57], [86, 61], [88, 57]], snow, 'nl') + poly([[89, 57], [91, 61], [93, 57]], snow, 'nl')
    + circ(71, 49, 3.5, card) + circ(72, 49, 1.6, key, 'nl'),

  'wild-card': () =>
    rect(26, 14, 48, 70, card, undefined, { rx: 4 })
    + heart(50, 50, 16, berry)
    + `<text x="33" y="28" font-size="12" class="lo-text" fill="${berry}" text-anchor="middle">A</text>`
    + `<text x="67" y="78" font-size="12" class="lo-text" fill="${berry}" text-anchor="middle" transform="rotate(180 67 74)">A</text>`,

  'mechanic-resurrection': () =>
    g('rotate(18 60 40)', rect(56, 12, 8, 34, shade) + circ(60, 13, 12, shade) + rect(55.5, -1, 9, 13, card, 'nl') + line(55.5, 1, 55.5, 12) + line(64.5, 1, 64.5, 12) + line(55.5, 12, 64.5, 12))
    + path('M34,24 H64 V60 C64,76 56,88 40,88 H26 C16,88 14,76 22,72 L34,64 Z', berry)
    + rect(31, 20, 36, 12, snow),

  'the-meg': () =>
    poly([[44, 40], [54, 18], [61, 40]], shade)
    + path('M6,54 C22,38 60,34 82,44 L96,34 L92,52 L96,68 L82,60 C60,70 22,68 6,54 Z', shade)
    + path('M8,56 C24,64 58,66 80,58 C60,68 24,70 8,56 Z', snow, 'nl')
    + line(30, 46, 28, 56) + line(34, 45, 32, 56)
    + circ(20, 49, 2.2, key, 'nl')
    + poly([[10, 56], [13, 59], [16, 56]], snow, 'nl') + poly([[16, 57], [19, 60], [22, 57]], snow, 'nl')
    + [[46, 48], [56, 47], [66, 48]].map(([x, y]) => circ(x, y, 1.2, key, 'nl')).join('')
    + rect(56, 66, 4, 10, key) + ellipse(52, 78, 5, 3, key) + ellipse(64, 78, 5, 3, key),

  'wrath-of-man': () =>
    rect(10, 32, 70, 36, fir)
    + rect(80, 44, 14, 24, fir) + rect(83, 47, 8, 8, shade)
    + rect(16, 38, 20, 4, key, 'nl') + rect(54, 38, 20, 4, key, 'nl')
    + line(45, 32, 45, 68)
    + circ(62, 52, 6, candle)
    + circ(26, 70, 8, key) + circ(26, 70, 3, card, 'nl')
    + circ(74, 70, 8, key) + circ(74, 70, 3, card, 'nl'),

  'operation-fortune': () =>
    line(58, 36, 74, 12)
    + poly([[20, 22], [80, 22], [50, 56]], shade)
    + poly([[26, 28], [74, 28], [50, 52]], candle, 'nl')
    + circ(58, 36, 6, fir) + circ(58, 36, 2, berry, 'nl')
    + rect(48, 56, 4, 24, shade) + ellipse(50, 82, 18, 4, shade),

  'meg-2': () =>
    rect(54, 18, 4, 16, key) + rect(54, 18, 11, 4, key)
    + rect(38, 32, 22, 18, candle)
    + ellipse(48, 58, 38, 16, candle)
    + [30, 46, 62].map((x) => circ(x, 58, 5, card)).join('')
    + poly([[86, 58], [95, 48], [95, 68]], key),

  'the-beekeeper': () =>
    path('M18,86 C16,38 84,38 82,86 Z', candle)
    + path('M22,70 Q50,64 78,70', 'none', 'lo') + path('M20,78 Q50,72 80,78', 'none', 'lo') + path('M26,60 Q50,54 74,60', 'none', 'lo') + path('M33,50 Q50,45 67,50', 'none', 'lo')
    + path('M43,86 V80 A7,7 0 0 1 57,80 V86 Z', key, 'nl')
    + ellipse(68, 22, 5, 7, snow, undefined, { opacity: 0.9 }) + ellipse(77, 22, 5, 7, snow, undefined, { opacity: 0.9 })
    + ellipse(72, 32, 10, 6.5, candle)
    + st('M69,26 V38', key, 2.5) + st('M74,26 V38', key, 2.5)
    + circ(82, 32, 3.5, key),

  'a-working-man': () =>
    path('M22,66 C22,32 78,32 78,66 Z', candle)
    + path('M10,66 H90 C90,74 10,74 10,66 Z', candle)
    + rect(46, 34, 8, 32, candle)
    + line(24, 60, 76, 60),

  shelter: () =>
    poly([[58, 26], [96, 12], [96, 40]], candle, 'nl', { opacity: 0.45 })
    + poly([[42, 26], [4, 12], [4, 40]], candle, 'nl', { opacity: 0.45 })
    + path('M20,92 C24,80 36,80 42,84 C50,78 64,78 80,92 Z', shade)
    + poly([[37, 86], [63, 86], [57, 36], [43, 36]], snow)
    + poly([[41.8, 48], [58.2, 48], [59.2, 58], [40.8, 58]], berry)
    + poly([[39.8, 68], [60.2, 68], [61.2, 78], [38.8, 78]], berry)
    + rect(38, 33, 24, 4, key) + rect(43, 22, 14, 11, candle)
    + poly([[40, 22], [50, 12], [60, 22]], berry),

  mutiny: () =>
    path('M14,40 H68 C76,40 78,44 82,46 H90 V58 H82 C78,60 76,64 68,64 H14 C7,64 7,40 14,40 Z', shade)
    + rect(90, 45, 7, 14, candle)
    + path('M20,60 C34,56 50,62 66,58', 'none', 'st', { stroke: night, 'stroke-width': 2, opacity: 0.5 })
    + line(38, 55, 38, 42) + line(50, 55, 50, 40)
    + poly([[38, 43], [38, 53], [47, 53]], card) + poly([[50, 41], [50, 53], [61, 53]], card)
    + path('M26,55 H62 L58,61 H30 Z', berry)
    + path('M16,44 H40', 'none', 'st', { stroke: snow, 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
};

export const EMBLEM_SLUGS = Object.keys(E);

export function emblemSvg(slug, cls = 'emblem-svg') {
  const art = offset([1.2, 0.9], E[slug] ?? (() => star(50, 50, 30, candle)));
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${art}</svg>`;
}
