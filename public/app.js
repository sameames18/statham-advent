const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PREVIEW_KEY = 'stathmas.preview';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const TENS = { 20: 'Twenty', 30: 'Thirty', 40: 'Forty' };
const LOCKED_LINES = [
  'Patience is a Statham virtue.',
  'He would wait. So can you.',
  'The package stays closed.',
  'Rule two: never open the package early.',
];

const state = {
  data: null,
  details: new Map(), // day -> door detail with film
  sheetDay: null,
};

// ---------- storage (best effort) ----------

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* ignore */ } },
};

{
  const params = new URLSearchParams(location.search);
  if (params.has('preview')) {
    storage.set(PREVIEW_KEY, /^\d{4}-\d{2}-\d{2}$/.test(params.get('preview')) ? params.get('preview') : null);
    history.replaceState(null, '', location.pathname);
  }
}

// ---------- api ----------

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

// ---------- helpers ----------

const words = (n) => (n <= 20 ? NUMBER_WORDS[n] : TENS[n - (n % 10)] + (n % 10 ? '-' + NUMBER_WORDS[n % 10].toLowerCase() : ''));
const pad = (n) => String(n).padStart(2, '0');
const longestWord = (title) => Math.max(5, ...title.split(/\s+/).map((w) => w.length));
const fmtRuntime = (m) => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;

function daysBetween(a, b) {
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

let toastTimer;
function toast(message) {
  const t = $('[data-toast]');
  t.textContent = message;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2600);
}

const lockIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/>';
  return svg;
};

const checkIcon = () => {
  const wrap = el('span', { class: 'check', title: 'Watched' });
  wrap.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return wrap;
};

// ---------- rendering ----------

function posterContent(day, film, { encore, watched }) {
  return [
    el('span', { class: 'poster-day' },
      el('span', { text: `DEC ${pad(day)}` }),
      watched ? checkIcon()
        : encore ? el('span', { class: 'badge', text: 'Encore' }) : null),
    el('span', {},
      el('span', { class: 'poster-title', style: `--len:${longestWord(film.title)}`, text: film.title }),
      el('span', { class: 'poster-sub', text: `${film.year} · as ${film.character}` })),
  ];
}

function doorLabel(d) {
  if (d.opened) return `December ${d.day}: ${d.film.title}${d.watched ? ', watched' : ''}`;
  if (d.unlocked) return `December ${d.day}: ready to open`;
  return `December ${d.day}: locked`;
}

function renderDoor(d) {
  const cls = ['door'];
  if (!d.unlocked) cls.push('is-locked');
  else if (!d.opened) cls.push('is-ready');
  if (d.opened) cls.push('is-open');
  if (d.watched) cls.push('is-watched');
  if (d.isToday) cls.push('is-today');

  const poster = el('div', { class: 'poster', style: d.film ? `--h:${d.film.hue}` : null },
    d.film ? posterContent(d.day, d.film, d) : []);

  const foot = !d.unlocked
    ? el('span', { class: 'panel-foot' }, el('span', { text: `Dec ${d.day}` }), lockIcon())
    : el('span', { class: 'panel-foot' }, el('span', { text: d.isToday ? 'Today' : 'Open me' }));

  const panel = el('div', { class: 'panel', 'aria-hidden': 'true' }, el('span', { class: 'panel-num', text: d.day }), foot);

  return el('li', {},
    el('button', {
      type: 'button',
      class: cls.join(' '),
      'data-day': d.day,
      'aria-label': doorLabel(d),
      'aria-disabled': d.unlocked ? null : 'true',
    }, poster, panel));
}

function render() {
  const { data } = state;
  const cal = $('[data-calendar]');
  const spacers = Array.from({ length: data.firstWeekday }, () => el('li', { class: 'spacer', 'aria-hidden': 'true' }));
  cal.replaceChildren(...spacers, ...data.doors.map(renderDoor));
  renderStatus();
  renderPreview();
}

function renderStatus() {
  const { data } = state;
  const { today, year, stats } = data;
  $$('[data-year]').forEach((n) => { n.textContent = `December ${year}`; });
  $('[data-film-count]').textContent = words(data.filmCount);

  const set = (k, v) => { $(`[data-stat="${k}"]`).textContent = v; };
  set('opened', stats.opened);
  set('watched', stats.watched);
  set('togo', 31 - stats.opened);

  const meter = $('.meter');
  meter.setAttribute('aria-valuenow', stats.opened);
  $('.meter-opened').style.width = `${(stats.opened / 31) * 100}%`;
  $('.meter-watched').style.width = `${(stats.watched / 31) * 100}%`;

  let line;
  const inDecember = today.year === year && today.month === 12;
  if (today.year > year) {
    line = `That's a wrap on Stathmas ${year}. <strong>${stats.watched} of 31</strong> watched.`;
  } else if (!inDecember) {
    const n = daysBetween(today, { year, month: 12, day: 1 });
    line = `The first door opens in <strong>${n} ${n === 1 ? 'day' : 'days'}</strong>.`;
  } else {
    const door = data.doors[today.day - 1];
    line = door.opened
      ? `Door ${today.day} is open. <strong>${today.day === 31 ? 'Happy New Year.' : 'Back tomorrow.'}</strong>`
      : `It's December ${today.day}. <strong>Door ${today.day} is waiting.</strong>`;
  }
  if (today.preview) line = `<span class="preview-title">Preview</span>&ensp;` + line;
  $('[data-status]').innerHTML = line;
}

function renderPreview() {
  const { data } = state;
  const box = $('[data-preview]');
  box.hidden = !data.timeTravel;
  const input = $('[data-preview-date]');
  input.value = storage.get(PREVIEW_KEY) ?? '';
  input.min = `${data.year - 1}-01-01`;
  input.max = `${data.year + 1}-12-31`;
}

// ---------- sheet ----------

function fillSheet(detail) {
  const { film, day } = detail;
  const sheet = $('[data-sheet]');
  state.sheetDay = day;

  const poster = $('[data-sheet-poster]');
  poster.style.setProperty('--h', film.hue);
  poster.replaceChildren(
    el('span', { class: 'big-day', 'aria-hidden': 'true', text: pad(day) }),
    el('span', {},
      el('span', { class: 'starring', text: 'Jason Statham' }),
      el('span', { class: 'poster-title', style: `--len:${longestWord(film.title)}`, text: film.title })),
  );

  $('[data-sheet-kicker]', sheet).textContent = `December ${day}${detail.encore ? ' · Encore screening' : ''}`;
  $('[data-sheet-title]', sheet).textContent = film.title;
  $('[data-sheet-meta]', sheet).replaceChildren(
    el('span', { text: film.year }), el('span', { text: `Dir. ${film.director}` }), el('span', { text: fmtRuntime(film.runtime) }));
  $('[data-sheet-as]', sheet).textContent = `Jason Statham as ${film.character}`;
  $('[data-sheet-logline]', sheet).textContent = film.logline;
  $('[data-sheet-note]', sheet).textContent = film.note;

  const facts = [['Released', film.year], ['Runtime', `${film.runtime} min`], ['Box office', film.gross ?? '—']];
  $('[data-sheet-facts]', sheet).replaceChildren(...facts.map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))));

  const watchBtn = $('[data-watched]', sheet);
  watchBtn.setAttribute('aria-pressed', String(detail.watched));
  $('span', watchBtn).textContent = detail.watched ? 'Watched' : 'Mark as watched';

  const wiki = $('[data-wiki]', sheet);
  wiki.hidden = !film.wikipedia;
  if (film.wikipedia) wiki.href = film.wikipedia;

  const opened = state.data.doors.filter((d) => d.opened).map((d) => d.day);
  const idx = opened.indexOf(day);
  $('[data-step="-1"]', sheet).disabled = idx <= 0;
  $('[data-step="1"]', sheet).disabled = idx === -1 || idx >= opened.length - 1;
}

async function showSheet(day) {
  let detail = state.details.get(day);
  if (!detail) {
    detail = await api(`/api/doors/${day}`);
    state.details.set(day, detail);
  }
  fillSheet(detail);
  const sheet = $('[data-sheet]');
  if (!sheet.open) sheet.showModal();
}

function stepSheet(delta) {
  const opened = state.data.doors.filter((d) => d.opened).map((d) => d.day);
  const next = opened[opened.indexOf(state.sheetDay) + delta];
  if (next) showSheet(next).catch((e) => toast(e.message));
}

// ---------- actions ----------

async function openDoor(button, day) {
  button.classList.add('is-loading');
  try {
    const detail = await api(`/api/doors/${day}/open`, { method: 'POST' });
    state.details.set(day, detail);
    const door = state.data.doors[day - 1];
    Object.assign(door, {
      opened: true,
      watched: detail.watched,
      encore: detail.encore,
      film: { slug: detail.film.slug, title: detail.film.title, year: detail.film.year, hue: detail.film.hue, character: detail.film.character },
    });
    state.data.stats.opened += 1;

    const poster = $('.poster', button);
    poster.style.setProperty('--h', detail.film.hue);
    poster.replaceChildren(...posterContent(day, door.film, door));
    button.classList.remove('is-loading', 'is-ready');
    button.classList.add('is-open');
    button.setAttribute('aria-label', doorLabel(door));
    renderStatus();

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => showSheet(day), reduced ? 0 : 750);
  } catch (err) {
    button.classList.remove('is-loading');
    toast(err.message);
  }
}

async function toggleWatched() {
  const day = state.sheetDay;
  const detail = state.details.get(day);
  const watched = !detail.watched;
  try {
    const next = await api(`/api/doors/${day}/watched`, { method: 'POST', body: { watched } });
    state.details.set(day, next);
    const door = state.data.doors[day - 1];
    door.watched = next.watched;
    state.data.stats.watched += watched ? 1 : -1;
    fillSheet(next);
    const li = $(`[data-day="${day}"]`).parentElement;
    li.replaceWith(renderDoor(door));
    renderStatus();
    if (watched) toast(`${next.film.title}: logged.`);
  } catch (err) {
    toast(err.message);
  }
}

async function load() {
  try {
    state.data = await api('/api/calendar');
    state.details.clear();
    render();
  } catch (err) {
    $('[data-status]').textContent = `Couldn't load the calendar: ${err.message}`;
  }
}

// ---------- events ----------

$('[data-calendar]').addEventListener('click', (e) => {
  const button = e.target.closest('.door');
  if (!button) return;
  const day = Number(button.dataset.day);
  const door = state.data.doors[day - 1];
  if (!door.unlocked) {
    toast(`Door ${day} opens December ${day}. ${LOCKED_LINES[day % LOCKED_LINES.length]}`);
  } else if (!door.opened) {
    openDoor(button, day);
  } else {
    showSheet(day).catch((err) => toast(err.message));
  }
});

const sheet = $('[data-sheet]');
$('[data-close]').addEventListener('click', () => sheet.close());
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
sheet.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') stepSheet(-1);
  if (e.key === 'ArrowRight') stepSheet(1);
});
$$('[data-step]').forEach((b) => b.addEventListener('click', () => stepSheet(Number(b.dataset.step))));
$('[data-watched]').addEventListener('click', toggleWatched);

$('[data-preview-date]').addEventListener('change', (e) => {
  storage.set(PREVIEW_KEY, e.target.value || null);
  load();
});
$$('[data-preview-jump]').forEach((b) => b.addEventListener('click', () => {
  const year = state.data.year;
  storage.set(PREVIEW_KEY, b.dataset.previewJump === 'eve' ? `${year}-12-31` : `${year}-12-14`);
  load();
}));
$('[data-preview-clear]').addEventListener('click', () => { storage.set(PREVIEW_KEY, null); load(); });
$('[data-reset]').addEventListener('click', async () => {
  await api('/api/reset', { method: 'POST' });
  toast('All your doors are closed again.');
  load();
});

load();
