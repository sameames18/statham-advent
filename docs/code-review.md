# Stathmas code review

Reviewed at commit `53e0776` on 2026-09-27, one day after the design direction was written and roughly nine weeks before the first door opens.

## Status after the follow-up change (same day)

The follow-up removed the database. Each year's draw is now worked out from the year and `CALENDAR_SECRET` (`server/catalog.js`, `drawSeed` in `server/calendar.js`), and each visitor's doors live in a per-year cookie (`server/marks.js`). That was chosen so the site can run on Vercel, whose functions have no persistent disk, and it settles several findings by removing the code they were about. The findings below are kept as written, for the record.

| ID | Now |
| --- | --- |
| DB-1 | Moot: there is no database. |
| SEC-1 | Fixed: preview is off unless `TIME_TRAVEL=1` or `--preview`, in the code, the image and on Vercel. |
| SEC-2 | Fixed: the API writes nothing on the server (the only state is the visitor's own cookie), and preview dates outside 2000–2100 are ignored. |
| DB-2 | Moot: nothing is drawn early and stored. New trade-off: adding or removing a film now redraws every year, so `films.json` must be left alone in December (README, "Before December"). |
| DB-3 | Moot: past calendars no longer pin films. |
| TEST-1 | Addressed, and the original finding overstated the gap. The one smoke test already ran about 70% of `app.js`'s lines (67% of its code characters); what it lacked was assertions, since it checked one outcome. Now the page's text logic is in `public/js/words.js` with unit tests, and 24 browser tests cover every interaction. Together they run every line of `app.js` and 98% of its code characters, and the last test fails if that drops. |
| OPS-1 | Moot: `scripts/reshuffle.js` is gone. |
| FE-2 | Fixed: a second tap on "Seen it" now undoes the first (taps are applied at once and sent in order), and the reset and delayed-card paths no longer leave unhandled rejections. |
| CI-1 | Partly: `permissions: contents: read`, Node 24 in the matrix, and an offline `vercel build` job were added. Still open: a Docker build-and-boot job, and a linter. |
| DEP-1, SEC-3, API-1, FE-1, DEP-2, PERF-1, API-2, DOC-1 | Unchanged. DEP-1 applies to Docker only. |

New risks the change brings, for a future review. **The secret is now the one thing that keeps future doors secret.** It must be long (the server refuses one under 16 characters) and must never be given to a deployment with preview mode on. **A visitor's doors are per browser.** That was already true in practice, since the old visitor ID was also a cookie, but it is now also true if the server is rebuilt from scratch. **A secret shorter than about 16 random characters could in principle be brute-forced** by someone who knows the films behind the doors already opened; the length check is the mitigation.

## How this review was done, and how to read it

Every source file was read in full: the server (`server/`), the frontend (`public/`), the tests, the scripts, the Dockerfile, the compose file, the CI workflow, the README and `docs/design.md`. The test suite was run (57 tests, all passing, about 0.6 s) with Node's built-in coverage. Then two copies of the server were started against scratch databases and probed with `curl` to confirm or reject each suspected problem. Wherever a finding says **Verified**, the behaviour was reproduced and the command or output is quoted. Wherever it says **Reasoned**, it comes from reading the code and was not reproduced.

Each finding has a stable ID (for example `DB-1`), a severity, the files and lines it concerns, the evidence, and a recommended fix. An agent picking up a single finding should be able to act on that section alone. Severities are relative to this application's threat model, which is a small public seasonal site with anonymous visitors, no accounts and no personal data. The one asset worth protecting is the surprise: nobody should see a film before its door opens. A finding that would be minor for a bank can be high here if it gives the surprise away, and the reverse also holds.

| Severity | Meaning here |
| --- | --- |
| High | Breaks the product or serves errors to visitors in a plausible, documented situation. Fix before December. |
| Medium | A real defect or operational trap that will bite eventually, or a notable gap in testing. |
| Low | Hardening, polish, or a small bug with an easy workaround. |
| Nit | Taste, tidiness, or documentation drift. |

## Verdict

This is a well-made small project. The architecture fits the job: one Node process, no runtime dependencies, one SQLite file and no build step. The server enforces the no-peeking rule rather than trusting the browser, and there are tests for the unglamorous edge cases (path traversal, malformed request targets, oversized bodies, ETag semantics) that most projects this size never write. The README is unusually honest about operations, including the WAL backup trap and why `SECURE_COOKIES` is explicit rather than inferred.

The serious problems are in how the process meets the outside world. Two High findings would plausibly cause trouble in the first week of December. The SQLite connection has no busy timeout, so the README's own `docker compose exec … reshuffle.js` workflow makes live requests fail with 500s (DB-1, verified). Preview mode, which gives away every door, is on by default in both the code and the Docker image, and only the compose file turns it off (SEC-1). Below those sit a handful of Medium issues about who can write to the database and when calendars get drawn, and one about the frontend's interaction code being almost untested despite a 99.6% coverage figure.

The code follows the design document closely. The deviations are small, and several of them are the design document not having caught up with decisions made during the build.

## Findings index

| ID | Sev. | Area | One-line summary |
| --- | --- | --- | --- |
| DB-1 | High | Reliability | No SQLite busy timeout: a second process (reshuffle, a second server) causes 500s or a failed start. |
| SEC-1 | High | Security / deploy | Preview mode defaults on in code and in the Docker image; one missing env var spoils every door. |
| SEC-2 | Medium | Security / perf | Unbounded anonymous writes: any cookieless POST to a past year adds a row; any year can gain a calendar. |
| DB-2 | Medium | Correctness | Any visitor can fix a future year's draw early via `?year=`; later catalog edits silently miss it. |
| DB-3 | Medium | Maintainability | Past calendars pin films forever; the only way to retire a film is to rewrite past years. |
| TEST-1 | Medium | Tests | `public/js/app.js` (427 lines, all interaction logic) has one happy-path browser test; coverage excludes it. |
| DEP-1 | Low | Deploy | Node runs as PID 1 and ignores SIGTERM: every `docker stop` waits 10 s and then SIGKILLs. |
| OPS-1 | Low | Ops safety | `reshuffle.js` will happily redraw a year mid-December, which the README warns against three times. |
| SEC-3 | Low | Security | No Content-Security-Policy or frame-ancestors; cheap defence in depth, and `index.html` already complies. |
| API-1 | Low | Correctness | Malformed JSON is read as `{}`, so a garbled "unwatch" marks the film watched. |
| FE-1 | Low | Design / FE | Tilt-to-glitter never fires on iPhones: iOS requires a permission prompt for `deviceorientation`. |
| FE-2 | Low | Frontend | Double-tapping "Seen it" is swallowed; two unhandled promise rejections. |
| CI-1 | Low | CI | No `permissions:` block, no Docker build or boot check, no lint; stale comment in the smoke test. |
| DEP-2 | Low | Deploy | Node 22 leaves LTS on 2027-04-30; `node:sqlite` is still experimental. Fine for 2026, not for 2027. |
| PERF-1 | Low | Leanness | Fraunces ships every variation axis (125 KB, 58% of font bytes); the CSS uses a narrow slice. |
| API-2 | Nit | API | HEAD on `/api/health` is 404; wrong methods get 404 not 405; health checks mint cookies. |
| LEAN-1 | Nit | Leanness | `gross`, `hue` and the `encore` field are carried end to end but never shown. |
| DOC-1 | Nit | Design adherence | Off-palette colours, two drop shadows, a fourth typeface, and no status record in the design doc. |

---

## High

### DB-1: no SQLite busy timeout, so a second process causes errors

**Severity:** High. **Where:** `server/db.js:51` (the PRAGMA line in `openDb`), and indirectly every write path. **Status:** Verified.

Some background first. SQLite is a single file, and only one connection at a time may write to it. When a second connection wants to write while the first holds the lock, SQLite can either return `SQLITE_BUSY` ("database is locked") immediately, or retry for a while. Which it does is set by the *busy timeout*, and the default is zero, meaning fail immediately. WAL mode, which this project correctly enables, lets readers and a writer work at the same time, but two writers still queue for the lock.

Within the server that never matters, because `node:sqlite` is synchronous and there is only one process. It does matter when a second process opens the same file. The README recommends exactly that, as the way to redraw a calendar on a live deployment:

```
docker compose exec stathmas node scripts/reshuffle.js 2026
```

That runs a second Node process against `/data/stathmas.db` while the server is serving. Both situations below were reproduced.

In the first, another process held a write transaction for 1.5 s, the way `reshuffle.js` does while it deletes, syncs and redraws. During that window a visitor opened a door:

```
POST /api/doors/3/open?year=2025   ->  {"error":"Server error"}  500
server log: Error: database is locked  errcode: 5
```

In the second, two server processes were started against the same file at the same moment, as can happen during a restart that overlaps an old container. One of them died at startup, in `db.exec(SCHEMA)`, with `database is locked`.

**Fix.** Add `PRAGMA busy_timeout = 5000;` to the PRAGMA line in `openDb`. This was verified in isolation: with the pragma set, a write blocked behind an 800 ms transaction waited 833 ms and succeeded; without it, the write failed at once. As a second, smaller step, make the two write transactions `BEGIN IMMEDIATE` rather than `BEGIN`, and have `ensureCalendar` re-check for an existing calendar *inside* the transaction. As written, the server and `reshuffle.js` could both see "no calendar for 2026", and the second would then fail on the primary key. It's rare, but the fix costs one line.

**Test to add.** Open two `openDb()` handles on one temporary file, hold `BEGIN IMMEDIATE` on one for about 200 ms, and assert that a write on the other succeeds. This is the test that would have caught the bug.

### SEC-1: preview mode is on unless someone remembers to turn it off

**Severity:** High, because it defeats the one property the product exists for. **Where:** `server/index.js:9`, `server/app.js:116` (`timeTravel = true`), `Dockerfile:5-7` (no `TIME_TRAVEL`), `docker-compose.yml:16`. **Status:** Verified by reading and by starting the server with no environment set. It printed "Preview mode is on".

With preview on, anyone can send `X-Preview-Date: 2026-12-31` (or visit `?preview=2026-12-31`) and open every door, and `/catalog.html` lists every film. The README says so plainly, and the compose file sets `TIME_TRAVEL: "0"`. The problem is the direction of the default. The code, `npm start`, and the Docker image all fail *open*. The compose file is the only place that makes production safe, and anyone who runs `docker run stathmas` without copying the README's `-e TIME_TRAVEL=0`, or who deploys to a platform that reads the Dockerfile but not the compose file, gets a spoiled calendar with no error. The README even carries a sentence hedging against its own drift ("Check the top of `server/index.js` … if the README and the code disagree"), which is a sign that this setting has already moved at least once.

**Fix, in order of preference.** The smallest change is `ENV TIME_TRAVEL=0` in the Dockerfile's `ENV` block, so the *image* is safe and development via `npm run dev` is unchanged. Better still, invert the default in code: off unless `TIME_TRAVEL=1`, with `npm run dev` setting it, since that is the only place it is wanted. The trade-off is that someone running `node server/index.js` bare during the prototype phase will see locked doors until they set the flag. For a site whose whole joke depends on the doors staying shut, that is the right way round.

**What would change this rating:** if the site will only ever be deployed from this compose file, by the same person who wrote it, the practical risk is lower. The default still matters, because the image is the thing that gets reused.

---

## Medium

### SEC-2: anonymous visitors can grow the database without limit

**Severity:** Medium. **Where:** `server/app.js:165-168` (visitor minting and the `year` parameter), `server/calendar.js:83` (`parseDate` accepts any four-digit year), `server/calendar.js:92` (`isUnlocked`). **Status:** Verified.

Each request without a cookie gets a new visitor ID, and `POST /api/doors/N/open` stores a row for that visitor. Doors are normally locked, which would limit this, but `?year=` accepts anything from 2000 to 2100, and every door of a *past* year is unlocked. So, with preview off and production settings:

```
200 × POST /api/doors/{1..31}/open?year=2000   (no cookie)
-> door_states rows: 200, distinct visitors: 200
```

Each row is only around 100 bytes, so filling a disk takes millions of requests. This is not an emergency, but it is the only unbounded resource in the app, and nothing rate-limits it. Two related gaps exist. `?year=` creates a stored calendar for any year in the range on a plain GET. With preview on, `X-Preview-Date: 9999-12-01` also creates a calendar for year 9999, because `parseDate` has no year bounds and the default year comes from the preview date without the 2000–2100 clamp. Years 1, 5000 and 9999 were all created this way during probing.

**Fix.** Restrict `year` to what the site shows, which is the current season and the one before it, unless preview is on. That removes the "all doors unlocked" loophole for writes and stops arbitrary calendar creation. Apply the same 2000–2100 clamp to preview dates. For real protection against volume, rate-limit `POST /api/*` at the reverse proxy. nginx has `limit_req` built in, but Caddy needs a third-party module, which is worth knowing before choosing Caddy on simplicity alone. Optionally, add a yearly cleanup of `door_states` for seasons more than a year old.

### DB-2: a future year's calendar can be drawn before its catalog is final

**Severity:** Medium. **Where:** `server/db.js:148` (`ensureCalendar`, called from every read), `server/app.js:167`. **Status:** Verified (`GET /api/calendar?year=2031` created the 2031 calendar).

A year's draw is fixed the first time anyone asks for it, and after that edits to `films.json` don't reach it. In practice the draw happens on 7 January, when `seasonYear` rolls over, or earlier if anyone requests `?year=` for a future year. From then on, a film added to `films.json` (a 2027 release, say) is not in that December's calendar, and nothing says so. The catalog is also exactly 31 films for 31 days. Once a 32nd film is added, `buildCalendar` quietly leaves one out at random, and nothing records which.

The README tells the operator to reshuffle before December, so a careful operator is covered. The trap is that nothing prompts them.

**Fix.** Pick one or more of these. Only draw a year's calendar from 1 November onwards, or on an explicit `reshuffle`, and until then serve locked doors with no draw behind them (locked doors carry no film data anyway). Refuse `?year=` for future years (see SEC-2). Have the server log a warning at startup when `films.json` contains films absent from the upcoming year's stored calendar.

### DB-3: past calendars pin films forever

**Severity:** Medium (maintainability; also a leanness opportunity). **Where:** `server/db.js:64-120` (`FilmInUseError`, `seedFilms`), `server/index.js:17-25`, `scripts/reshuffle.js`. **Status:** Reasoned, and exercised by the existing tests in `test/db.test.js`.

The catalog sync deletes films that have left `films.json`. It refuses, and the server refuses to start, when any stored calendar uses that film, and the error message tells the operator to `reshuffle` that year. That is reasonable for the *current* year. For 2026's calendar in the year 2028 it is the wrong remedy. Reshuffling 2026 rewrites history, and because door marks are keyed by day number (as the README notes), every visitor's 2026 "seen" ticks move onto different films. As the years accumulate, every film ever shown becomes impossible to remove without that damage.

**Fix.** Retire films instead of deleting them. Add a `retired` flag (or `retired_at`), have the sync set it on films missing from the JSON and clear it on films that return, and draw new calendars only from films that aren't retired. Old calendars keep their joins. This removes `FilmInUseError`, the start-up refusal in `index.js`, and the `{ seed: false }` special case that `reshuffle.js` needs. It is a net deletion of about 40 lines, plus a schema migration (one `ALTER TABLE … ADD COLUMN`).

### TEST-1: the interaction layer is barely tested, and the coverage figure hides it

**Severity:** Medium. **Where:** `public/js/app.js`, `test/browser/smoke.test.js`. **Status:** Verified (coverage report).

`node --test --experimental-test-coverage` reports 99.6% line coverage, but only for files a Node test imports. `public/js/app.js` needs a DOM, so it is not in the report at all. That file is the largest piece of logic in the frontend. It holds opening doors, the not-yet note, the seen toggle, the list of doors, reset, preview handling, the marquee and the tag text. It is covered by a single Playwright test that opens one door, and that test doesn't run under `npm test`. FE-2 below is the kind of bug this gap lets through.

**Fix, two layers.** The first is cheap and needs no browser. Move the pure functions (`ordinal`, `daysUntilDecember`, `splitTitle`, `doorLabel`, and the text choice inside `renderTag`) into a small module and unit-test them. The "One more sleep" and "That was Stathmas 2026" branches are exactly the date logic that breaks at year boundaries. The second layer adds four or five Playwright cases: a locked door shows "Not until N December" and makes no API write; "Seen it" toggles on and off and the pencil tick appears on the door; the list of doors opens a door; reset closes them; and at a 390 px viewport the tall composition is used.

---

## Low

### DEP-1: Node as PID 1 ignores SIGTERM

**Where:** `Dockerfile:31`, `server/index.js`. **Status:** Verified. Node was run as PID 1 in a fresh PID namespace and sent SIGTERM, and it was still running three seconds later. A control process that was not PID 1 exited immediately.

Background: Linux gives PID 1 (the first process in a container) special treatment. Signals it hasn't explicitly registered a handler for are ignored, rather than killing it. The Dockerfile's `CMD ["node", …]` makes Node PID 1, and the server registers no handler. `docker stop` therefore sends SIGTERM, waits the 10 s grace period, and then sends SIGKILL. SQLite in WAL mode survives being killed without data loss, so this costs deploy time rather than data. Still, every restart takes ten seconds longer than it needs to, and in-flight requests are cut rather than finished.

**Fix.** Either add `init: true` to the compose service (Docker then runs a tiny init process as PID 1 that forwards signals), or, better because it works everywhere, handle `SIGTERM` and `SIGINT` in `server/index.js` by calling `server.close()`, then `store.close()`, then exiting.

### OPS-1: `reshuffle.js` has no guard against the dangerous case

**Where:** `scripts/reshuffle.js:8`. **Status:** Reasoned.

The README warns three times not to reshuffle once December has started, because visitors' marks would land on the wrong films. The script doesn't enforce it. It also defaults the year to `new Date().getFullYear()`. From 1 to 6 January that is the *new* year, not the season being shown, and inside the container it is evaluated in UTC.

**Fix.** Refuse when door 1 of that year is already unlocked (`isUnlocked(year, 1, today)`) unless `--force` is passed, and use `seasonYear` for the default.

### SEC-3: no Content-Security-Policy

**Where:** `server/app.js:12` (`SECURITY_HEADERS`). **Status:** Verified (only `nosniff` and `Referrer-Policy` are sent).

The current XSS exposure is small. Every `innerHTML` in the frontend inserts either SVG built from trusted `films.json` data or strings passed through `esc()`, and user-visible film text goes in through `textContent`. A CSP is inexpensive insurance against a future edit that gets this wrong. `index.html` already has no inline script or style, and setting `element.style.left` from JavaScript is allowed under a strict policy. `catalog.html` has one inline `<style>` and one inline module script, which would need moving to files or a hash.

**Suggested header:** `default-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. The `data:` source is needed for the paper-grain SVG in the stylesheet. `frame-ancestors 'none'` also closes off clickjacking of the reset link. Separately, Caddy doesn't send `Strict-Transport-Security` by default. Add it to the README's Caddyfile once HTTPS is known to work.

### API-1: garbled JSON is treated as "mark watched"

**Where:** `server/app.js:105`, used by the `watched` action. **Status:** Verified. The existing test `a malformed or oversized POST body is handled` asserts this behaviour.

`readJson` returns `{}` for unparseable bodies, and `watched !== false` then reads that as true. A client that meant to *un*-tick and sent a truncated body gets the opposite. Return `400 Bad request` for a non-empty body that isn't valid JSON, and update the test.

### FE-1: the tilt glitter is dead on iPhones

**Where:** `public/js/app.js:418`. **Status:** Reasoned from platform behaviour; not tested on a device (see Limitations).

Since iOS 13, Safari doesn't deliver `deviceorientation` events until the page calls `DeviceOrientationEvent.requestPermission()` from a user gesture, which produces a system prompt. Without that call the listener never fires, so the design's "shimmers as … the phone tilts" works on Android but not on iPhone. The trade-off is real. A permission prompt is exactly the kind of app chrome the design rejects, so the honest options are to request it quietly on the first door tap, or to accept pointer-and-tap glitter only on iOS and record that decision in the design doc.

### FE-2: small interaction bugs

**Where:** `public/js/app.js:302` (`toggleSeen`), `:410` (reset), `:262`. **Status:** Reasoned.

`toggleSeen` reads the current state from `state.details`, which is only updated when the server replies. Two quick taps both compute "watched = true", so the second tap, meant to un-tick, is lost. Fix by updating the local state optimistically before the request, or by ignoring taps while one is in flight, as `openDoor` already does with `is-busy`. The reset handler awaits the API with no `catch`, so a failure becomes an unhandled promise rejection and the list stays open. The `setTimeout(() => showFilm(day))` after opening a door has the same exposure.

### CI-1: workflow hygiene

**Where:** `.github/workflows/test.yml`, `test/browser/smoke.test.js:35`.

The workflow has no `permissions:` block, so the job token gets whatever the repository default is, which may include write. Add `permissions: { contents: read }`. It runs on both `push` and `pull_request`, so a PR branch runs everything twice. There is no job that builds the Docker image and checks that it starts and reports healthy with `TIME_TRAVEL=0`. That job would catch a broken `COPY` line and, if it asserts `/api/catalog` is 404, it guards SEC-1 permanently. There is no linter. Given the no-dependencies stance, even `node --check` on every file is better than nothing, and ESLint as a dev dependency like Playwright would be consistent. The smoke test's comment says the page "asks Google Fonts for its typefaces". Since `2cb8321` the fonts are local, so the comment is stale, although the network block it justifies is still sensible.

### DEP-2: runtime lifetime

**Where:** `Dockerfile:3`, `package.json` engines, `.node-version`.

Node 22 stays in maintenance LTS until 30 April 2027, so this December is covered and next December is not. `node:sqlite` is still marked experimental in Node 22 (hence `--disable-warning=ExperimentalWarning`). Pinning the image to the 22.22 minor and testing the 22.13 floor in CI is the right mitigation. Plan a move to Node 24 during 2027, and keep the CI matrix testing the exact minor that ships in the image.

### PERF-1: the variable display font is larger than it needs to be

**Where:** `public/fonts/fraunces-latin.woff2` (125 KB), `scripts/subset_fonts.sh`.

The page preloads about 158 KB of fonts, and Fraunces alone is 125 KB, because the subset keeps every axis (weight 100–900, optical size 9–144, SOFT, WONK). The stylesheet uses weights of about 700–800 with SOFT and WONK. `fontTools.varLib.instancer` can restrict axis ranges, for example limiting `wght` to 700–800 while keeping SOFT and WONK, and that would likely cut the file substantially. That estimate hasn't been measured, so measure it before committing. Everything else is already lean. The JavaScript is about 58 KB uncompressed, the generated wide scene is 65 KB of SVG built in the browser, and static files are revalidated with 304s. Compression is correctly left to the proxy.

---

## Nits

### API-2: HTTP method handling

`HEAD /api/health` returns 404 (some uptime monitors use HEAD), and a wrong method on a real route (for example `DELETE /api/calendar`) returns 404 rather than 405. Every health check also mints a fresh visitor cookie, because `visitorId` runs before routing. That is harmless, since no row is written, but it is easy to avoid by routing `/api/health` before building the context.

### LEAN-1: data carried but never shown

`films.json` and the `films` table carry `gross` and `hue`, which `filmDetail` strips out (`server/app.js:42`). They are left over from v1, which the design retired. The `encore` flag is computed, stored and sent in every opened door, but the frontend never reads it (`grep encore public/js` finds nothing), and the design decided on 31 films with no encores. Keeping the encore *algorithm* in `buildCalendar` as a fallback for a shrinking catalog is sensible. Either drop the field from the API or give it a caption ("an encore"), so the fallback is visible if it is ever used. The `TIME_TRAVEL` explanation comment is also duplicated between `server/index.js` and `server/app.js`, as is the `America/Los_Angeles` default.

### DOC-1: design adherence details

Covered in the next section.

---

## Adherence to the design document

The implementation matches `docs/design.md` closely. The following were checked against the code rather than assumed.

These match the design:

- There are 31 doors, numbered 1 to 31, with door 24 as the church's double door, at least 1.8 times the next-largest door and three times a typical one. Tests enforce all of this for both compositions.
- Doors are scattered by composition, but the keyboard visits them in date order.
- There is a separate tall composition for phones, with a test that every door is at least 34 px on a 390 px phone.
- Locked doors look like closed doors, answer with a wobble and a printed "Not until N December", and are marked `aria-disabled` without being removed from the tab order.
- Today's door has a candle glow, and opened doors stay folded back showing their emblem.
- The film card holds the fields the design lists, in its order. It has a pencil tick for "Seen it", mirrored on the door, and closes by tapping outside it or on the printed ×.
- A "List of doors" link on the ribbon tag gives a plain numbered alternative to the scene.
- Reduced motion stops the door swing, the tick drawing, the wobble and the glitter.
- Preview mode has left the page and lives in `?preview=`, with a pencilled note.
- Box office figures are gone from the card.
- The ink plate is offset from the key plate, which gives the misregistration, and a paper-grain texture covers the card.
- The seven inks are defined once, in `svg.js` and as CSS variables.

These deviate, roughly in order of how much they matter against the design's own test ("could a screenshot pass for a scan of a real 1962 card?"):

- **Colours outside the seven inks.** The design says "every colour on the page comes from this list; there is no separate UI palette". The CSS adds `--wall: #16203a` (a deeper midnight, also used as `theme-color` in `index.html:8`), `--pencil: #58524c` for the handwritten notes, and `#4a3f37` for the italic note text (`styles.css:595`). All three are defensible: a room behind the card, graphite, and softened ink. Either fold them into existing inks at an opacity, or add a "not printed" row to the ink table, so the rule and the code agree.
- **Drop shadows.** The design allows one soft contact shadow, under the card itself, and otherwise "no gradients and no drop shadows". There are also shadows on the ribbon tag (`styles.css:201`) and on the "not yet" tag (`styles.css:415`). The radial gradients behind opened doors are arguably the candle glow the design asks for, so they are fine.
- **A fourth typeface.** The design names three type roles. The build adds Reenie Beanie for pencil marks, which fits the design's "pencilled note" but is not in its type list, so the README now documents four faces and the design doc three.
- **The design doc has no status.** It sets out five build phases, each gated on Sam's sign-off, and four "Decisions for Sam", two of which are recommendations awaiting an answer: verses versus prose, and who draws. The repository shows all five phases built, on the same day the design was written, and the notes are still prose. Nothing records which gates were passed or what was decided. A short "Status" section in the design doc would stop a future reader (or agent) from treating open questions as settled, or settled ones as open.

## Tests: what's strong and what's missing

The suite is fast, has no dependencies, and tests behaviour rather than implementation. The HTTP tests run the real handler on a real socket against an in-memory database, and they cover the cases that usually go unwritten: `GET //[`, `/%ZZ`, encoded path traversal, a body over the size limit, weak and strong ETag comparison, `If-Modified-Since` precedence, and the "no film data before the door is open" invariant. The database tests exercise the sync's rollback and the multi-year error message. That is a good base.

The gaps line up with the findings above. The interaction layer has no tests (TEST-1). No test opens two database handles at once (DB-1). Nothing checks that the shipped image starts with preview off (SEC-1 / CI-1). Nothing covers `year` or preview-date bounds (SEC-2). One existing test enshrines questionable behaviour, junk JSON meaning "watched" (API-1), so fixing that finding means changing a test deliberately rather than deleting it.

## Deployment: what's strong and what's missing

The strengths are real. The image has no dependencies, runs as the unprivileged `node` user, and has a healthcheck that needs neither curl nor wget. There is a named volume, the port is bound to localhost behind the proxy, and the `Secure` cookie is an explicit setting rather than inferred from a header a misconfigured proxy might omit. The backup instructions are correct about WAL (copying `stathmas.db` alone would lose recent writes) and use `VACUUM INTO` for a consistent live snapshot.

What's missing is covered above: the image's preview default (SEC-1), lock contention with the documented `exec` workflow (DB-1), signal handling (DEP-1), and HSTS and rate limiting at the proxy (SEC-3, SEC-2). If you want to harden the compose file further at little cost, add `read_only: true` with the `/data` volume as the only writable path, `cap_drop: [ALL]`, and `security_opt: [no-new-privileges:true]`. None of these is required for a site with this threat model.

## Suggested order of work

Before December, do DB-1 (one pragma and a test) and SEC-1 (one Dockerfile line, ideally the inverted default) first. They are small, and they are the two things most likely to go wrong in public. Then do SEC-2 and DB-2 together, since restricting `?year=` addresses both, and add the CI image check so SEC-1 can't regress. DEP-1 and OPS-1 are each a few lines. TEST-1 is the largest piece of work. It is worth doing before any more frontend changes, because the frontend is where most future edits will land. DB-3 can wait until the first time a film needs to leave, but it will be easier to do before there are several past calendars to migrate.

## Limitations of this review

- Nothing was tested on a real phone, in Safari, or with a screen reader. The accessibility observations come from reading the markup and ARIA attributes, and FE-1 comes from documented iOS behaviour rather than a device. The design's own phase-4 gate ("checked on a real phone and by keyboard alone") remains the right test.
- The visual judgement ("could this pass for a 1962 scan?") was not attempted. That is a taste call for the person who wrote the design.
- The Docker image was not built here. Findings about it come from reading the Dockerfile and from reproducing the PID-1 and SQLite behaviour outside Docker.
- The severities assume a small public site. If it will only ever be shared with friends, SEC-2 falls to a nit. If it gets real traffic, or is linked somewhere large in December, SEC-2 and rate limiting move up.
