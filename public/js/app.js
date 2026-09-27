import { composition } from './scene.js';
import { faceSvg } from './doors.js';
import { emblemImage } from './emblems.js';
import { esc } from './svg.js';
import { billText, doorLabel, ordinal, previewNote, tagText } from './words.js';

const $ = (sel, root = document) => root.querySelector(sel);

const PREVIEW_KEY = 'stathmas.preview';
const TICK = '<svg class="tick" viewBox="0 0 40 40" aria-hidden="true"><path d="M6,22 C10,24 13,28 15,33 C19,22 26,12 36,5"/></svg>';

const phone = matchMedia('(max-width: 760px)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  data: null,
  details: new Map(), // day -> door detail with film
  comp: null,
  filmDay: null,
  specks: [],
};

// ---------- storage and API ----------

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
  },
};

// ?preview=2026-12-14 in the URL turns preview on; ?preview=off turns it off.
{
  const params = new URLSearchParams(location.search);
  if (params.has('preview')) {
    const v = params.get('preview');
    storage.set(PREVIEW_KEY, /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    history.replaceState(null, '', location.pathname);
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone };
  const preview = storage.get(PREVIEW_KEY);
  if (preview) headers['X-Preview-Date'] = preview;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.message ?? json.error ?? 'Request failed'), { status: res.status });
  return json;
}

// ---------- the scene and its doors ----------

const pct = (v) => `${(v * 100).toFixed(3)}%`;

function buildDoor(slot, comp) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `door kind-${slot.kind} hinge-${slot.hinge}`;
  b.dataset.day = slot.n;
  b.style.left = pct(slot.x / comp.width);
  b.style.top = pct(slot.y / comp.height);
  b.style.width = pct(slot.w / comp.width);
  b.style.height = pct(slot.h / comp.height);
  const leaves = slot.kind === 'church' ? ['left', 'right'] : ['single'];
  b.innerHTML = '<span class="recess"></span>'
    + leaves.map((l) => `<span class="leaf leaf-${l}"><span class="face">${faceSvg(slot, l)}</span><span class="back"></span></span>`).join('');
  return b;
}

function buildScene() {
  const comp = composition(phone.matches ? 'tall' : 'wide');
  if (state.comp === comp) return;
  state.comp = comp;
  const scene = $('[data-scene]');
  scene.querySelector('.scene-svg')?.remove();
  scene.insertAdjacentHTML('afterbegin', comp.svg);
  // Doors go in the DOM in date order so the keyboard walks 1 to 31,
  // wherever they sit in the picture.
  const slots = [...comp.slots].sort((a, b) => a.n - b.n);
  $('[data-doors]').replaceChildren(...slots.map((s) => buildDoor(s, comp)));
  state.specks = [...scene.querySelectorAll('.speck')];
  if (state.data) applyState();
}

const doorEl = (day) => $(`.door[data-day="${day}"]`);

function fillRecess(el, d) {
  const recess = $('.recess', el);
  if (!d.opened || !d.film) {
    if (recess.dataset.slug) { recess.replaceChildren(); delete recess.dataset.slug; }
    return;
  }
  if (recess.dataset.slug !== d.film.slug) {
    recess.innerHTML = emblemImage(d.film.slug);
    recess.dataset.slug = d.film.slug;
  }
  const tick = $('.tick', recess);
  if (d.watched && !tick) recess.insertAdjacentHTML('beforeend', TICK);
  if (!d.watched && tick) tick.remove();
}

function applyDoor(d) {
  const el = doorEl(d.day);
  if (!el) return;
  el.classList.toggle('is-locked', !d.unlocked);
  el.classList.toggle('is-ready', d.unlocked && !d.opened);
  el.classList.toggle('is-open', d.opened);
  el.classList.toggle('is-today', d.isToday);
  el.classList.toggle('is-seen', d.watched);
  el.setAttribute('aria-label', doorLabel(d));
  if (d.opened) el.title = d.film.title;
  else el.removeAttribute('title');
  if (d.unlocked) el.removeAttribute('aria-disabled');
  else el.setAttribute('aria-disabled', 'true');
  fillRecess(el, d);
}

function applyState() {
  for (const d of state.data.doors) applyDoor(d);
  renderTag();
  renderMarquee();
  renderPreviewNote();
  if ($('[data-list]').open) renderList();
}

// ---------- the ribbon tag, the marquee, the preview note ----------

function renderTag() {
  const { line, sub } = tagText(state.data);
  $('[data-tag-line]').textContent = line;
  $('[data-tag-sub]').textContent = sub;
}

// The picture house bills the latest film opened, in slot-in letters: a
// small line above, the title, a small line below.
const TILT = [0, -1.6, 0.8, 0, 1.4, -0.6, 0.4, -1.2, 1, 0, -0.8, 1.6];

function billLine(text, x, y, size, cls = '') {
  const tilt = [...text].map((_, i) => TILT[(i * 7 + text.length) % TILT.length]).join(' ');
  return `<text class="marquee-letters ${cls}" x="${x}" y="${y.toFixed(1)}" font-size="${size.toFixed(1)}" text-anchor="middle" rotate="${tilt}">${esc(text)}</text>`;
}

function renderMarquee() {
  const g = $('.marquee');
  if (!g) return;
  const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((k) => Number(g.dataset[k]));
  const cx = x + w / 2;
  const { top, lines, foot } = billText(state.data.doors);
  const longest = Math.max(...lines.map((l) => l.length));
  const mid = y + 19 + (h - 34) / 2;
  let body;
  if (lines.length === 1) {
    const size = Math.min(23, (w - 18) / (longest * 0.74));
    body = billLine(lines[0], cx, mid + size * 0.36, size);
  } else {
    const size = Math.min(13, (w - 18) / (longest * 0.74));
    body = billLine(lines[0], cx, mid - 1.5, size) + billLine(lines[1], cx, mid + size + 0.5, size);
  }
  g.innerHTML = billLine(top, cx, y + 14.5, 10.5, 'small') + body + billLine(foot, cx, y + h - 4, 10.5, 'small');
}

function renderPreviewNote() {
  const note = $('[data-preview-note]');
  const { today } = state.data;
  note.hidden = !today.preview;
  if (today.preview) note.textContent = previewNote(today);
  $('[data-reset]').hidden = !today.preview;
}

// ---------- "not yet" ----------

let earlyTimer;
function notYet(el, day) {
  el.classList.remove('is-wobble');
  void el.offsetWidth;
  el.classList.add('is-wobble');
  let tag = $('.early');
  if (!tag) {
    tag = document.createElement('div');
    tag.className = 'early';
    tag.setAttribute('role', 'status');
    $('[data-scene]').append(tag);
  }
  tag.textContent = `Not until ${day} December.`;
  tag.style.left = `${el.offsetLeft + el.offsetWidth / 2}px`;
  tag.style.top = `${el.offsetTop - 6}px`;
  tag.classList.add('is-shown');
  clearTimeout(earlyTimer);
  earlyTimer = setTimeout(() => tag.classList.remove('is-shown'), 2200);
}

// ---------- opening doors ----------

async function openDoor(el, day) {
  if (el.classList.contains('is-busy')) return;
  el.classList.add('is-busy');
  try {
    const detail = await api(`/api/doors/${day}/open`, { method: 'POST' });
    state.details.set(day, detail);
    const door = state.data.doors[day - 1];
    const { slug, title, year, character } = detail.film;
    Object.assign(door, { opened: true, watched: detail.watched, film: { slug, title, year, character } });
    fillRecess(el, door);
    requestAnimationFrame(() => applyState());
    setTimeout(() => showFilm(day).catch(() => {}), calm.matches ? 0 : 950);
  } catch (err) {
    if (err.status === 403) notYet(el, day);
  } finally {
    el.classList.remove('is-busy');
  }
}

// ---------- the film card ----------

function fillFilm(detail) {
  const { day, film } = detail;
  state.filmDay = day;
  $('[data-f-day]').textContent = day;
  $('[data-f-emblem]').innerHTML = emblemImage(film.slug);
  $('[data-f-date]').textContent = `The ${ordinal(day)} of December`;
  $('[data-f-title]').textContent = film.title;
  $('[data-f-credit]').textContent = `${film.year} · Directed by ${film.director} · ${film.runtime} minutes`;
  $('[data-f-as]').textContent = `Jason Statham as ${film.character}`;
  $('[data-f-logline]').textContent = film.logline;
  $('[data-f-note]').textContent = film.note;
  const seen = $('[data-seen]');
  seen.classList.remove('is-drawing');
  seen.setAttribute('aria-checked', String(detail.watched));
  const wiki = $('[data-f-wiki]');
  wiki.hidden = !film.wikipedia;
  if (film.wikipedia) wiki.href = film.wikipedia;
}

async function showFilm(day) {
  let detail = state.details.get(day);
  if (!detail) {
    detail = await api(`/api/doors/${day}`);
    state.details.set(day, detail);
  }
  fillFilm(detail);
  const dlg = $('[data-film]');
  if (!dlg.open) dlg.showModal();
}

// Taps are remembered at once, so a quick second tap undoes the first, and
// sent one at a time, so the server ends up where the last tap left it.
let seenQueue = Promise.resolve();
function toggleSeen() {
  const day = state.filmDay;
  const detail = state.details.get(day);
  const watched = !detail.watched;
  detail.watched = watched;
  const btn = $('[data-seen]');
  btn.classList.add('is-drawing');
  btn.setAttribute('aria-checked', String(watched));
  seenQueue = seenQueue.then(async () => {
    try {
      await api(`/api/doors/${day}/watched`, { method: 'POST', body: { watched } });
      state.data.doors[day - 1].watched = watched;
      applyState();
    } catch {
      detail.watched = !watched;
      if (state.filmDay === day) btn.setAttribute('aria-checked', String(!watched));
    }
  });
  return seenQueue;
}

// ---------- the list of doors ----------

function renderList() {
  const items = state.data.doors.map((d) => {
    const li = document.createElement('li');
    const n = `<span class="n">${d.day}</span>`;
    if (!d.unlocked) {
      li.innerHTML = `<div class="row">${n}<span>Opens on the ${ordinal(d.day)} of December</span></div>`;
    } else {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.goto = d.day;
      const what = d.opened ? d.film.title : 'Ready to open';
      b.innerHTML = `${n}<span><span class="what"></span>${d.watched ? '<span class="seen-mark">seen</span>' : ''}</span>`;
      b.querySelector('.what').textContent = what;
      li.append(b);
    }
    return li;
  });
  $('[data-list-items]').replaceChildren(...items);
}

// ---------- glitter ----------

let lastGlint = 0;
function glint() {
  const now = performance.now();
  if (calm.matches || now - lastGlint < 110 || !state.specks.length) return;
  lastGlint = now;
  for (let i = 0; i < 1 + (Math.random() < 0.4); i++) {
    const s = state.specks[Math.floor(Math.random() * state.specks.length)];
    s.classList.add('glint');
    setTimeout(() => s.classList.remove('glint'), 650);
  }
}

// ---------- load ----------

async function load() {
  try {
    state.data = await api('/api/calendar');
    state.details.clear();
    applyState();
  } catch (err) {
    $('[data-tag-line]').textContent = 'The calendar could not be fetched.';
    $('[data-tag-sub]').textContent = err.message;
  }
}

// ---------- events ----------

$('[data-doors]').addEventListener('click', (e) => {
  const el = e.target.closest('.door');
  if (!el || !state.data) return;
  const day = Number(el.dataset.day);
  const d = state.data.doors[day - 1];
  if (!d.unlocked) notYet(el, day);
  else if (!d.opened) openDoor(el, day);
  else showFilm(day).catch(() => {});
});

for (const dlg of [$('[data-film]'), $('[data-list]')]) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('[data-close]', dlg).addEventListener('click', () => dlg.close());
}

$('[data-seen]').addEventListener('click', toggleSeen);

$('[data-open-list]').addEventListener('click', () => {
  if (!state.data) return;
  renderList();
  $('[data-list]').showModal();
});

$('[data-list-items]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-goto]');
  if (!b) return;
  const day = Number(b.dataset.goto);
  $('[data-list]').close();
  const d = state.data.doors[day - 1];
  if (d.opened) showFilm(day).catch(() => {});
  else {
    const el = doorEl(day);
    el.scrollIntoView({ block: 'center', behavior: calm.matches ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
    openDoor(el, day);
  }
});

$('[data-preview-note]').addEventListener('click', () => { storage.set(PREVIEW_KEY, null); load(); });

$('[data-reset]').addEventListener('click', async () => {
  try {
    await api('/api/reset', { method: 'POST' });
  } catch {
    return; // the doors stay as they were, and so does the list
  }
  $('[data-list]').close();
  load();
});

addEventListener('pointermove', glint, { passive: true });
let lastTilt = null;
addEventListener('deviceorientation', (e) => {
  if (e.gamma == null) return;
  const tilt = Math.round(e.gamma / 3) + Math.round(e.beta / 3) * 100;
  if (tilt !== lastTilt) { lastTilt = tilt; glint(); }
});

phone.addEventListener('change', buildScene);

buildScene();
load();
