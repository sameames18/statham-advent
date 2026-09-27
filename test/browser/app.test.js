// Drives the real page (public/js/app.js) in headless Chromium. Not part of
// `npm test`, because it needs the `playwright` devDependency and a browser:
//   npm install && npx playwright install chromium && npm run test:browser
//
// Every test gets a fresh browser context (so fresh cookies and storage), a
// fixed time zone, and a server whose clock is stopped at 27 September 2026,
// so nothing depends on the day the tests run. Most tests preview the 14th
// of December, when doors 1 to 14 are open to open.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { createHandler } from '../../server/app.js';
import { loadCatalog } from '../../server/catalog.js';
import { lineCoverage } from './coverage.js';

const PREVIEW = '2026-12-14';
const catalog = loadCatalog({ secret: 'a test secret, not the real one' });

let server;
let origin;
let browser;
const coverage = [];

before(async () => {
  server = createServer(createHandler(catalog, {
    timeTravel: true,
    clock: () => new Date('2026-09-27T20:00:00Z'),
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
});

// ---------- helpers ----------

// Open the page in a new context, run `fn`, then collect coverage, close up
// and check nothing threw on the page.
async function withPage({ preview = PREVIEW, path = '/', wait = true, setup, ...options }, fn) {
  const context = await browser.newContext({ timezoneId: 'Europe/London', ...options });
  const page = await context.newPage();
  // Stay off the network: the page should need nothing but this server.
  await page.route((url) => url.origin !== origin, (route) => route.abort());
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  try {
    if (setup) await setup(page);
    await page.goto(`${origin}${path}${preview ? `?preview=${preview}` : ''}`);
    if (wait) await loaded(page);
    await fn(page, context);
  } finally {
    coverage.push(...await page.coverage.stopJSCoverage());
    await context.close();
  }
  assert.deepEqual(errors, [], 'no errors on the page');
}

// The calendar has arrived once the doors carry their labels.
const loaded = (page) => page.waitForFunction(() => document.querySelector('.door[data-day="31"]')?.hasAttribute('aria-label'));

const door = (page, day) => page.locator(`.door[data-day="${day}"]`);
const filmCard = (page) => page.locator('dialog[data-film]');
const text = async (page, sel) => (await page.locator(sel).textContent()).trim();
const isOpen = (dialog) => dialog.evaluate((el) => el.open);
const hasClass = (locator, cls) => locator.evaluate((el, c) => el.classList.contains(c), cls);

async function cookie(context, year = 2026) {
  return (await context.cookies()).find((c) => c.name === `stathmas-${year}`)?.value;
}

// Doors sit on a picture with overlays, so skip Playwright's actionability checks.
async function openDoor(page, day) {
  await door(page, day).click({ force: true });
  await filmCard(page).waitFor({ state: 'visible' });
  assert.equal(await text(page, '[data-f-day]'), String(day));
}

// ---------- loading ----------

test('the calendar loads 31 doors in date order, and only today\'s and earlier can open', async () => {
  await withPage({}, async (page) => {
    const days = await page.locator('.door').evaluateAll((els) => els.map((el) => Number(el.dataset.day)));
    assert.deepEqual(days, Array.from({ length: 31 }, (_, i) => i + 1));
    const disabled = await page.locator('.door').evaluateAll((els) => els.map((el) => el.getAttribute('aria-disabled')));
    assert.deepEqual(disabled, [...Array(14).fill(null), ...Array(17).fill('true')]);

    assert.equal(await page.locator('.door.is-today').count(), 1);
    assert.equal(await hasClass(door(page, 14), 'is-today'), true);
    assert.equal(await door(page, 7).getAttribute('aria-label'), 'December 7: ready to open');
    assert.equal(await door(page, 20).getAttribute('aria-label'), 'December 20: not yet');

    assert.equal(await text(page, '[data-tag-line]'), 'The 14th of December.');
    assert.equal(await text(page, '[data-tag-sub]'), 'Door 14 is lit.');
    assert.match(await text(page, '.marquee'), /COMING SOON/);
    assert.equal(await text(page, '[data-preview-note]'), 'preview: 14 Dec (rub out)');
    assert.equal(new URL(page.url()).search, '', 'the preview date is tidied out of the address bar');

    const [w, h] = await page.locator('.scene-svg').evaluate((svg) => [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height]);
    assert.ok(w > h, 'the wide picture on a desktop screen');
  });
});

test('without a preview the page shows the real date: a countdown, every door shut', async () => {
  await withPage({ preview: null }, async (page) => {
    assert.equal(await text(page, '[data-tag-line]'), 'The first door opens on the 1st of December.');
    assert.equal(await text(page, '[data-tag-sub]'), '65 days to go.');
    assert.equal(await page.locator('.door[aria-disabled="true"]').count(), 31);
    assert.equal(await page.locator('[data-preview-note]').isHidden(), true);
  });
});

test('after Christmas the tag looks back and every door can open', async () => {
  await withPage({ preview: '2027-01-03' }, async (page) => {
    assert.equal(await text(page, '[data-tag-line]'), 'That was Stathmas 2026.');
    assert.equal(await text(page, '[data-tag-sub]'), '0 of 31 seen.');
    assert.equal(await page.locator('.door[aria-disabled]').count(), 0);
  });
});

test('if the calendar cannot be fetched, the tag says so and the doors do nothing', async () => {
  const setup = (page) => page.route('**/api/calendar', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' }));
  await withPage({ setup, wait: false }, async (page) => {
    await page.waitForFunction(() => document.querySelector('[data-tag-line]').textContent.includes('could not'));
    assert.equal(await text(page, '[data-tag-line]'), 'The calendar could not be fetched.');
    assert.equal(await text(page, '[data-tag-sub]'), 'Server error');
    await door(page, 3).click({ force: true });
    await page.locator('[data-open-list]').click();
    assert.equal(await isOpen(filmCard(page)), false);
    assert.equal(await isOpen(page.locator('dialog[data-list]')), false);
  });
});

// ---------- opening doors ----------

test('opening a door shows its film card, and the door stays open after a reload', async () => {
  await withPage({}, async (page, context) => {
    await openDoor(page, 7);
    const film = catalog.day(2026, 7).film;
    assert.equal(await text(page, '[data-f-title]'), film.title);
    assert.equal(await text(page, '[data-f-date]'), 'The 7th of December');
    assert.equal(await text(page, '[data-f-credit]'), `${film.year} · Directed by ${film.director} · ${film.runtime} minutes`);
    assert.equal(await text(page, '[data-f-as]'), `Jason Statham as ${film.character}`);
    assert.equal(await text(page, '[data-f-logline]'), film.logline);
    assert.equal(await text(page, '[data-f-note]'), film.note);
    assert.match(await page.locator('[data-f-wiki]').getAttribute('href'), /^https:\/\/en\.wikipedia\.org\/wiki\//);
    assert.equal(await page.locator('[data-f-emblem] img.emblem-image').count(), 1);
    assert.equal(await page.locator('[data-seen]').getAttribute('aria-checked'), 'false');

    assert.equal(await hasClass(door(page, 7), 'is-open'), true);
    assert.equal(await door(page, 7).getAttribute('aria-label'), `December 7: ${film.title}`);
    assert.equal(await door(page, 7).getAttribute('title'), film.title);
    assert.equal(await door(page, 7).locator('.recess img.emblem-image').count(), 1, 'the emblem sits behind the door');
    assert.match(await text(page, '.marquee'), /NOW SHOWING/);
    assert.equal(await cookie(context), '40.0', 'door 7 is bit 6 of the cookie');

    await page.reload();
    await loaded(page);
    assert.equal(await hasClass(door(page, 7), 'is-open'), true);
    await door(page, 7).click({ force: true });
    await filmCard(page).waitFor({ state: 'visible' });
    assert.equal(await text(page, '[data-f-title]'), film.title, 'an opened door shows its card again');
  });
});

test('opening today\'s door changes the tag', async () => {
  await withPage({}, async (page) => {
    await openDoor(page, 14);
    assert.equal(await text(page, '[data-tag-sub]'), 'See you tomorrow.');
  });
});

test('the picture house letters a long title over two rows', async () => {
  await withPage({}, async (page) => {
    const title = catalog.day(2026, 9).film.title.toUpperCase();
    assert.ok(title.length > 16 && !title.includes(':'), 'door 9 holds a long title with no subtitle');
    await openDoor(page, 9);
    const rows = await page.locator('.marquee .marquee-letters:not(.small)').allTextContents();
    assert.equal(rows.length, 2);
    assert.equal(rows.join(' '), title);
  });
});

test('a locked door wobbles, says when it opens, and asks the server nothing', async () => {
  await withPage({}, async (page, context) => {
    const posts = [];
    page.on('request', (req) => { if (req.method() === 'POST') posts.push(req.url()); });
    await door(page, 20).click({ force: true });
    const note = page.locator('.early');
    await note.waitFor({ state: 'attached' });
    assert.equal(await note.textContent(), 'Not until 20 December.');
    assert.equal(await hasClass(note, 'is-shown'), true);
    assert.equal(await hasClass(door(page, 20), 'is-wobble'), true);
    assert.equal(await isOpen(filmCard(page)), false);
    assert.deepEqual(posts, []);
    assert.equal(await cookie(context), undefined);
    // A second locked door reuses the same note.
    await door(page, 25).click({ force: true });
    assert.equal(await page.locator('.early').count(), 1);
    assert.equal(await note.textContent(), 'Not until 25 December.');
  });
});

test('if the server refuses a door the page thought was open, it gets the not-yet note', async () => {
  const setup = (page) => page.route('**/api/doors/7/open', (route) => route.fulfill({
    status: 403, contentType: 'application/json', body: '{"error":"Too early","message":"Door 7 opens on December 7."}',
  }));
  await withPage({ setup }, async (page) => {
    await door(page, 7).click({ force: true });
    await page.locator('.early.is-shown').waitFor();
    assert.equal(await text(page, '.early'), 'Not until 7 December.');
    assert.equal(await hasClass(door(page, 7), 'is-open'), false);
    assert.equal(await hasClass(door(page, 7), 'is-busy'), false, 'the door can be tried again');
  });
});

// ---------- the film card ----------

test('"Seen it" ticks the card and the door, survives a reload, and unticks', async () => {
  await withPage({}, async (page, context) => {
    await openDoor(page, 3);
    const seen = page.locator('[data-seen]');
    const posted = page.waitForResponse('**/api/doors/3/watched');
    await seen.click();
    await posted;
    assert.equal(await seen.getAttribute('aria-checked'), 'true');
    await page.locator('.door[data-day="3"].is-seen .recess .tick').waitFor({ state: 'attached' });
    assert.equal(await door(page, 3).getAttribute('aria-label'), `December 3: ${catalog.day(2026, 3).film.title}, seen`);
    assert.equal(await cookie(context), '4.4');

    await page.reload();
    await loaded(page);
    assert.equal(await hasClass(door(page, 3), 'is-seen'), true);
    await door(page, 3).click({ force: true });
    await filmCard(page).waitFor({ state: 'visible' });
    assert.equal(await seen.getAttribute('aria-checked'), 'true');

    const unposted = page.waitForResponse('**/api/doors/3/watched');
    await seen.click();
    await unposted;
    assert.equal(await seen.getAttribute('aria-checked'), 'false');
    await page.waitForFunction(() => !document.querySelector('.door[data-day="3"] .tick'));
    assert.equal(await hasClass(door(page, 3), 'is-seen'), false);
    assert.equal(await cookie(context), '4.0');
  });
});

test('a quick second tap on "Seen it" undoes the first, on the page and on the server', async () => {
  // Hold each request back, so the second tap lands before the first answer.
  const setup = (page) => page.route('**/api/doors/*/watched', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await withPage({ setup }, async (page, context) => {
    await openDoor(page, 5);
    const seen = page.locator('[data-seen]');
    const bothAnswered = new Promise((resolve) => {
      let n = 0;
      page.on('response', (res) => { if (res.url().endsWith('/watched') && ++n === 2) resolve(); });
    });
    await seen.click();
    await seen.click();
    assert.equal(await seen.getAttribute('aria-checked'), 'false', 'the checkbox follows the taps at once');
    await bothAnswered;
    await page.waitForTimeout(50);
    assert.equal(await seen.getAttribute('aria-checked'), 'false');
    assert.equal(await hasClass(door(page, 5), 'is-seen'), false);
    assert.equal(await cookie(context), '10.0', 'door 5 open, not seen');
  });
});

test('if marking a film seen fails, the checkbox goes back', async () => {
  const setup = (page) => page.route('**/api/doors/*/watched', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' }));
  await withPage({ setup }, async (page) => {
    await openDoor(page, 2);
    const seen = page.locator('[data-seen]');
    await seen.click();
    await page.waitForFunction(() => document.querySelector('[data-seen]').getAttribute('aria-checked') === 'false');
    assert.equal(await hasClass(door(page, 2), 'is-seen'), false);
  });
});

test('the card closes with the printed ×, a tap outside it, or Escape', async () => {
  await withPage({}, async (page) => {
    const card = filmCard(page);
    await openDoor(page, 1);
    await card.locator('[data-close]').click();
    assert.equal(await isOpen(card), false);

    await door(page, 1).click({ force: true });
    await card.waitFor({ state: 'visible' });
    // A click on the dialog itself, outside the card, lands on the backdrop.
    await page.mouse.click(5, 5);
    assert.equal(await isOpen(card), false);

    await door(page, 1).click({ force: true });
    await card.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(card), false);
  });
});

// ---------- the list of doors ----------

test('the list of doors lists all 31 and opens a door from the list', async () => {
  await withPage({}, async (page) => {
    const list = page.locator('dialog[data-list]');
    await page.locator('[data-open-list]').click();
    assert.equal(await isOpen(list), true);
    const items = list.locator('[data-list-items] li');
    assert.equal(await items.count(), 31);
    assert.match(await items.nth(19).textContent(), /20\s*Opens on the 20th of December/);
    assert.match(await items.nth(6).textContent(), /Ready to open/);
    assert.equal(await items.nth(19).locator('button').count(), 0, 'a locked door is not a button');

    await items.nth(6).locator('button').click();
    assert.equal(await isOpen(list), false);
    await filmCard(page).waitFor({ state: 'visible' });
    assert.equal(await text(page, '[data-f-day]'), '7');
    await page.keyboard.press('Escape');

    // Opened now, so the list names the film, and choosing it shows the card.
    await page.locator('[data-open-list]').click();
    const title = catalog.day(2026, 7).film.title;
    assert.match(await items.nth(6).textContent(), new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await items.nth(6).locator('button').click();
    await filmCard(page).waitFor({ state: 'visible' });
    assert.equal(await text(page, '[data-f-title]'), title);
  });
});

test('the list marks seen films, and keeps up while it is open', async () => {
  await withPage({}, async (page) => {
    await openDoor(page, 4);
    const posted = page.waitForResponse('**/api/doors/4/watched');
    await page.locator('[data-seen]').click();
    await posted;
    await page.keyboard.press('Escape');
    await page.locator('[data-open-list]').click();
    const item = page.locator('[data-list-items] li').nth(3);
    assert.equal(await item.locator('.seen-mark').count(), 1);
    assert.equal(await page.locator('[data-reset]').isVisible(), true, 'reset is offered while previewing');
  });
});

test('reset closes every door and clears the cookie', async () => {
  await withPage({}, async (page, context) => {
    await openDoor(page, 1);
    await page.keyboard.press('Escape');
    await openDoor(page, 2);
    await page.keyboard.press('Escape');
    assert.equal(await cookie(context), '3.0');

    await page.locator('[data-open-list]').click();
    await page.locator('[data-reset]').click();
    await page.waitForFunction(() => !document.querySelector('.door.is-open'));
    assert.equal(await isOpen(page.locator('dialog[data-list]')), false);
    assert.equal(await cookie(context), undefined);
    assert.match(await text(page, '.marquee'), /COMING SOON/);
  });
});

test('if reset fails, the doors and the list stay as they were', async () => {
  const setup = (page) => page.route('**/api/reset', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' }));
  await withPage({ setup }, async (page) => {
    await openDoor(page, 1);
    await page.keyboard.press('Escape');
    await page.locator('[data-open-list]').click();
    const failed = page.waitForResponse('**/api/reset');
    await page.locator('[data-reset]').click();
    await failed;
    await page.waitForTimeout(50);
    assert.equal(await isOpen(page.locator('dialog[data-list]')), true);
    assert.equal(await hasClass(door(page, 1), 'is-open'), true);
  });
});

// ---------- preview ----------

test('rubbing out the preview note goes back to the real date', async () => {
  await withPage({}, async (page) => {
    await page.locator('[data-preview-note]').click();
    await page.waitForFunction(() => document.querySelector('[data-tag-sub]').textContent.includes('days to go'));
    assert.equal(await page.locator('[data-preview-note]').isHidden(), true);
    assert.equal(await page.locator('.door[aria-disabled="true"]').count(), 31);
    assert.equal(await page.evaluate(() => localStorage.getItem('stathmas.preview')), null);

    await page.reload();
    await loaded(page);
    assert.equal(await page.locator('[data-preview-note]').isHidden(), true, 'and it stays rubbed out');
  });
});

test('?preview=off forgets a stored preview date', async () => {
  await withPage({}, async (page) => {
    await page.goto(`${origin}/?preview=off`);
    await loaded(page);
    assert.equal(await page.locator('[data-preview-note]').isHidden(), true);
    assert.equal(await text(page, '[data-tag-sub]'), '65 days to go.');
  });
});

// ---------- phones, keyboards, motion ----------

test('a phone gets the tall picture, and the doors keep their state when it turns', async () => {
  await withPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
    const shape = () => page.locator('.scene-svg').evaluate((svg) => svg.viewBox.baseVal.height > svg.viewBox.baseVal.width);
    assert.equal(await shape(), true, 'tall on a phone');
    await openDoor(page, 2);
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => document.querySelector('.scene-svg').viewBox.baseVal.width > document.querySelector('.scene-svg').viewBox.baseVal.height);
    assert.equal(await page.locator('.door').count(), 31);
    assert.equal(await hasClass(door(page, 2), 'is-open'), true);
    assert.equal(await door(page, 2).locator('.recess img.emblem-image').count(), 1);
  });
});

test('the keyboard reaches the doors in date order and Enter opens one', async () => {
  await withPage({}, async (page) => {
    await page.locator('[data-open-list]').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '1');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.day), '2');
    await page.keyboard.press('Enter');
    await filmCard(page).waitFor({ state: 'visible' });
    assert.equal(await text(page, '[data-f-day]'), '2');
  });
});

test('glitter catches the light as the pointer moves or the phone tilts', async () => {
  await withPage({}, async (page) => {
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(100 + i * 60, 200 + i * 20);
      await page.waitForTimeout(120);
    }
    assert.ok(await page.locator('.speck.glint').count() > 0, 'the pointer made something glint');
    await page.waitForFunction(() => !document.querySelector('.speck.glint'));

    for (let i = 0; i < 4; i++) {
      await page.evaluate((g) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 30, gamma: g })), i * 10);
      await page.waitForTimeout(120);
    }
    assert.ok(await page.locator('.speck.glint').count() > 0, 'tilting made something glint');
  });
});

test('with reduced motion the glitter stays still and the card opens at once', async () => {
  await withPage({ reducedMotion: 'reduce' }, async (page) => {
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(100 + i * 60, 200);
      await page.waitForTimeout(120);
    }
    assert.equal(await page.locator('.speck.glint').count(), 0);

    const opened = page.waitForResponse('**/api/doors/9/open');
    await door(page, 9).click({ force: true });
    await opened;
    // Without reduced motion the card waits 950 ms for the door to swing.
    await filmCard(page).waitFor({ state: 'visible', timeout: 500 });
  });
});

// ---------- the programme page ----------

test('the programme page lists every film while preview mode is on', async () => {
  await withPage({ path: '/catalog.html', preview: null, wait: false }, async (page) => {
    await page.locator('.film-entry').first().waitFor();
    assert.equal(await page.locator('.film-entry').count(), catalog.films().length);
    assert.equal(await page.locator('.film-entry .emblem-image').count(), catalog.films().length);
  });
});

// ---------- coverage ----------

// Runs last. The floors sit a little under what the tests above reach, so
// a new code path that nothing exercises shows up here.
test('the tests above exercise the page scripts', (t) => {
  for (const [file, floor] of [['/js/app.js', 97], ['/js/words.js', 100]]) {
    const result = lineCoverage(coverage, file);
    assert.ok(result, `${file} was loaded`);
    t.diagnostic(`${file}: ${result.hit}/${result.total} lines (${result.percent.toFixed(1)}%), ${result.strict.toFixed(1)}% of code characters${result.missed.length ? `; lines not reached: ${result.missed.join(', ')}` : ''}`);
    assert.ok(result.percent >= floor, `${file} line coverage ${result.percent.toFixed(1)}% is under ${floor}%`);
  }
});
