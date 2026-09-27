// Drives the real page in headless Chromium. Not part of `npm test`, because
// it needs the `playwright` devDependency and a browser:
//   npm install && npx playwright install chromium && npm run test:browser
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { openDb } from '../../server/db.js';
import { createHandler } from '../../server/app.js';

let store;
let server;
let origin;
let browser;

before(async () => {
  store = openDb(':memory:');
  server = createServer(createHandler(store, { timeTravel: true }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server.close();
  store.close();
  await once(server, 'close');
});

test('clicking an unlocked door opens the film card with a title', async () => {
  const page = await browser.newPage();
  // Stay off the network: the page asks Google Fonts for its typefaces, and a
  // slow or absent connection must not fail the test.
  await page.route((url) => url.origin !== origin, (route) => route.abort());
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${origin}/?preview=2026-12-14`);
  const door = page.locator('button.door[data-day="7"]');
  await door.waitFor();
  // The calendar arrives after the page loads; an unlocked door drops
  // aria-disabled once it does.
  await page.waitForFunction(() => !document.querySelector('button.door[data-day="7"]')?.hasAttribute('aria-disabled'));
  // Doors sit on a picture with overlays, so skip the actionability checks.
  await door.click({ force: true });

  const dialog = page.locator('dialog.film[data-film]');
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.evaluate((el) => el.open), true);
  const title = (await page.locator('[data-f-title]').textContent()).trim();
  assert.ok(title.length > 0, 'the film card shows a title');
  assert.equal(await page.locator('[data-f-day]').textContent(), '7');

  // The server agrees the door is open, and it is the same film.
  const opened = store.doorStates(await visitorCookie(page), 2026);
  assert.ok(opened.has(7), 'door 7 is recorded as opened for this visitor');
  assert.equal(title, store.days(2026).find((d) => d.day === 7).film.title);

  assert.deepEqual(errors, []);
  await page.close();
});

async function visitorCookie(page) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === 'visitor')?.value;
}
