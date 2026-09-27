// A tiny drawing kit shared by the scene, the doors and the emblems.
// Pure string-building, so it runs in the browser and in node tests alike.
//
// Every shape is printed in two plates, like cheap colour printing: an ink
// plate (flat fill, no outline) and a key plate (outline only), the ink
// nudged slightly off register so the colour misses its line.
//   default  → filled on the ink plate, outlined on the key plate
//   .nl      → no line: ink plate only
//   .lo      → line only: key plate only
//   .st      → stroked art in its own colour: ink plate only, stroke kept

export const INK = {
  card: '#EFE4CC',
  night: '#1E2B4A',
  snow: '#F7F3EA',
  shade: '#C9D3DE',
  fir: '#2E5A3E',
  berry: '#B3302A',
  candle: '#E8B04A',
  key: '#2A211C',
};

const n = (v) => Math.round(v * 10) / 10;
const attrs = (o) => Object.entries(o)
  .filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => ` ${k}="${typeof v === 'number' ? n(v) : v}"`).join('');

// How far the ink plate misses the key plate, in drawing units. Set per
// drawing with offset(); every shape drawn inside is printed twice, ink then
// key, so later shapes cover earlier lines the way paint does.
let OFF = [1.4, 1];
export function offset(o, draw) {
  const prev = OFF;
  OFF = o;
  try { return draw(); } finally { OFF = prev; }
}

function print(el, cls) {
  const has = (c) => (cls ?? '').split(' ').includes(c);
  const ink = has('lo') ? '' : `<g class="plate-ink" transform="translate(${OFF[0]} ${OFF[1]})">${el}</g>`;
  const key = has('nl') || has('st') ? '' : `<g class="plate-key">${el}</g>`;
  return ink + key;
}

const shape = (tag, a) => print(`<${tag}${attrs(a)}/>`, a.class);

export const rect = (x, y, w, h, fill, cls, extra = {}) => shape('rect', { x, y, width: w, height: h, fill, class: cls, ...extra });
export const circ = (cx, cy, r, fill, cls, extra = {}) => shape('circle', { cx, cy, r, fill, class: cls, ...extra });
export const ellipse = (cx, cy, rx, ry, fill, cls, extra = {}) => shape('ellipse', { cx, cy, rx, ry, fill, class: cls, ...extra });
export const poly = (pts, fill, cls, extra = {}) =>
  shape('polygon', { points: pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' '), fill, class: cls, ...extra });
export const path = (d, fill, cls, extra = {}) => shape('path', { d, fill, class: cls, ...extra });
export const line = (x1, y1, x2, y2, cls = 'lo', extra = {}) => shape('line', { x1, y1, x2, y2, class: cls, ...extra });

// A five-pointed star.
export function star(cx, cy, r, fill = INK.candle, cls, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts, fill, cls);
}


// Deterministic randomness, so the picture is the same on every visit.
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

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
