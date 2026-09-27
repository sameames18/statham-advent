# Stathmas

An advent calendar of Jason Statham action vehicles, dressed as a printed card calendar from about 1962. Thirty-one paper doors are hidden in a snowy village on Christmas Eve, one for each day of December. Each opens at midnight in the visitor's own time zone and shows a small painted picture of that night's film: a tin shark for *The Meg*, a honeybee on a skep for *The Beekeeper*. The calendar plays Christmas completely straight.

The design direction, and the reasoning behind it, is in [docs/design.md](docs/design.md).

## The films

Thirty-one films, one per door. Twenty-eight are every film where Statham is the lead in an action or crime picture, from *The Transporter* (2002) to *Mutiny* (2026). Three more are there by choice: *Lock, Stock and Two Smoking Barrels* and *Snatch*, the Guy Ritchie films that started it, and *The Expendables* as the one ensemble wildcard. The rest of the ensembles and supporting turns are left out: the *Fast & Furious* films, *Hobbs & Shaw*, the *Expendables* sequels, *The Italian Job*, *Cellular*, *Spy*, *13* and the rest.

Facts (director, runtime, release year, character) come from Wikipedia; `scripts/fetch_films.py` is the research pull. Loglines and the dry "briefing" notes are written for this site. The catalog lives in `server/data/films.json`, and it is checked when the server starts: a film missing a field, or two films with the same slug, stop it with the problem named.

**The order** is random, different every year, and the same for every visitor. Nothing stores it. It is worked out from the year and a secret, `CALENDAR_SECRET`, so every copy of the server (and every Vercel function instance) arrives at the same calendar, and without the secret nobody can work out the doors still to come, even with this source code in hand. Three things redraw a year's calendar: changing the secret, adding or removing a film, and changing the draw code in `server/calendar.js`. Reordering `films.json` or editing a film's text does not. Do any of the three before December, never during it: visitors' opened doors are remembered by day number, so a redraw mid-month would put their marks on the wrong films. (If the catalog ever has fewer films than days, the spare days become encores of films already shown.)

## Running it

Needs Node 22.13 or newer. There are no dependencies to install.

```bash
npm run dev
```

Then open http://localhost:4747. That runs the server in preview mode (see below), restarting it when files change, and it needs no secret. To run it the way it runs for real, with preview off:

```bash
CALENDAR_SECRET=$(openssl rand -hex 32) npm start
```

Without `CALENDAR_SECRET` the server refuses to start, and it refuses a secret shorter than 16 characters. Generate one once and keep it for the whole season.

The server sends its files with `ETag` and `Last-Modified` validators and `Cache-Control: no-cache`, so a returning browser asks whether each file has changed and gets a bodiless 304 when it hasn't, while an edit is picked up on the very next load after a deploy. It does not compress anything: on Vercel the platform does that, and behind Docker a reverse proxy should.

### Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `CALENDAR_SECRET` | none; required unless previewing | Decides every year's draw. Keep it secret and keep it the same all season. |
| `TIME_TRAVEL` | off | `1` turns preview mode on. Never on for a real December. `npm run dev` turns it on with `--preview` instead. |
| `SECURE_COOKIES` | on for Vercel, off elsewhere | Marks the door cookies HTTPS-only. `1` or `0` overrides. |
| `DEFAULT_TZ` | `America/Los_Angeles` | The time zone used when a browser doesn't send its own. |
| `PORT` | `4747` | The Node server's port. Not used on Vercel. |

### Tests

```bash
npm test
```

Unit tests for the calendar logic, the catalog and the draw, the door cookie, the settings, the page's wording, the drawing modules and the HTTP API, plus the Vercel function, all on Node's built-in test runner with nothing to install. They run on every push and pull request (`.github/workflows/test.yml`), on Node 22.13, 22 and 24.

The page itself (`public/js/app.js`: opening doors, the not-yet note, "Seen it", the list of doors, reset, preview, the phone layout, the keyboard, reduced motion and the glitter) is tested in headless Chromium. That needs the one development dependency, Playwright, and a browser, so it is a separate script:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

The last browser test reports how much of the page's scripts the others exercised and fails if that drops. Playwright is pinned to the version whose Chromium build the review environment already has, so bump it deliberately.

CI also runs an offline `vercel build` against a stand-in project, so a broken `vercel.json` fails there rather than on deploy.

### Preview mode

Before December every door is locked. With preview mode on, the page can pretend it's another date: add `?preview=2026-12-14` to the URL. A pencilled note under the card shows the preview date; click it to rub it out, or use `?preview=off`. While previewing, the list of doors has a "close all my doors again" link, and http://localhost:4747/catalog.html shows every film at once, with its picture, logline and note, in release order.

Preview mode gives the whole calendar away, so it is **off unless asked for**: `npm run dev` turns it on, and so does `TIME_TRAVEL=1`. With it off, preview dates are ignored and `/catalog.html` has nothing to show. If the server prints "Preview mode is on" at startup, it is on.

## How it works

**Backend** (`server/`): a plain Node HTTP server with no database. It serves the site and a small JSON API:

| Route | What it does |
| --- | --- |
| `GET /api/calendar` | All 31 doors with their state for this visitor. Locked or unopened doors carry no film data. |
| `GET /api/doors/:day` | Full details for a door this visitor has opened. |
| `POST /api/doors/:day/open` | Opens a door. Refused with 403 before its date. |
| `POST /api/doors/:day/watched` | Marks a film watched (`{"watched": false}` to undo). |
| `POST /api/reset` | Closes all of this visitor's doors for the year. |
| `GET /api/catalog` | Every film in release order. Preview mode only. |
| `GET /api/health` | Liveness check for uptime monitors and the Docker healthcheck; answers `{"ok": true}`. |

The server decides what's unlocked, so there's no peeking at future films through the browser's developer tools. The client sends its time zone in an `X-Timezone` header so doors open at local midnight.

**Each visitor's doors** live in their own browser, in one cookie per year: `stathmas-2026=<opened>.<seen>`, two bitmasks in hex, one bit per day (`server/marks.js`). There are no accounts and nothing about a visitor is stored on the server. The cookie needs no protection from its owner: the server hands out a film only once its date has come, whatever the cookie claims, so a forged "opened" mark shows nothing its owner couldn't open anyway. A visitor who clears their cookies, or switches browser, starts with every door closed.

**The season** runs from the 1st of December to Twelfth Night, the 6th of January, when the decorations come down. Until then the API keeps serving the December just gone, with all 31 doors unlocked, so a visitor who missed a night can still catch up and the ribbon tag reads "That was Stathmas 2026". From the 7th of January the site switches to the coming December: every door is locked and the tag counts down to the 1st. `seasonYear` in `server/calendar.js` makes the choice; the date is `SEASON_END` next to it. `?year=` on the API still asks for any year from 2000 to 2100 explicitly.

**Frontend** (`public/`): plain HTML, CSS and JavaScript modules with no build step.

- `js/scene.js` draws the village as SVG in two compositions: a wide card for desktop and a tall one for phones, each with 31 door slots. Door numbers are scattered by composition; the church's big double door is always 24, Christmas Eve.
- `js/doors.js` prints the front of each paper door (a lit window, a front door, a star, a parcel on the sled), and `js/emblems.js` draws the 31 film pictures behind them.
- `js/svg.js` is the shared drawing kit. Every shape is printed twice, a flat ink plate slightly off register under a key line plate, which is where the cheap-print look comes from.
- `js/app.js` lays the doors over the picture as HTML so they can swing open, and runs the film card, the ribbon tag, the picture house bill (the latest film opened, in slot-in letters), the list of doors and the glitter. What those say (the tag's lines, the bill, the door labels) is worked out in `js/words.js`, which has no DOM so it can be unit-tested.

Seven inks only (card, midnight, snow, fir, berry, candlelight, key), with Fraunces for numerals and titles, Libre Caslon Text for words, Berkshire Swash for the wordmark and Reenie Beanie for pencil notes. The fonts are served from `public/fonts/` (Latin subsets, cut by `scripts/subset_fonts.sh`) rather than from Google Fonts, so a visit makes no third-party request.

## Deploying to Vercel

The repository is set up for Vercel as it stands: `public/` is served as the static site, and `api/index.js` is a single function that answers every `/api/*` request (`vercel.json` rewrites them to it). There is no build step and nothing to install.

1. Import the repository in Vercel (**Add New… → Project**). Leave the framework preset as **Other**; `vercel.json` sets the output directory to `public`.
2. Under **Settings → Environment Variables**, add `CALENDAR_SECRET` for the **Production** environment. Generate it with `openssl rand -hex 32`, and keep a copy somewhere safe: if it's lost, the next deploy draws a different calendar.
3. Deploy. Check that `https://<your-domain>/api/health` answers `{"ok":true}` and that `/api/catalog` answers 404, which means preview mode is off.

A few things worth knowing:

- **Vercel's "Preview" deployments are not preview mode.** Vercel builds a "Preview" deployment for every branch; those have preview mode off like production unless you add `TIME_TRAVEL=1` to the Preview environment's variables, which is a handy way to test a branch. Without `TIME_TRAVEL=1` they need a `CALENDAR_SECRET` of their own, or they refuse to answer. Never give them production's secret: with preview mode on, anyone with the link could open every door of the real calendar.
- **If the secret is missing**, every `/api/*` request answers 500 and the function log says why.
- **Node version:** `package.json` asks for Node 22.13 or newer, below 25, and Vercel picks the newest it has in that range (24 at the time of writing). Node 22 leaves long-term support in April 2027.
- **Cookies** are marked `Secure` automatically on Vercel, which always serves HTTPS.
- **Headers:** `vercel.json` adds the same `X-Content-Type-Options` and `Referrer-Policy` headers to the static files that the Node server sends.

## Deploying with Docker

The site is also one Node process with no dependencies and no state, so a small VPS with Docker and a reverse proxy is enough.

The `Dockerfile` at the root builds from the official `node:22.22-slim` image (`.node-version` pins the same minor for fnm, nodenv and other version managers that read it), copies `package.json`, `server/` and `public/`, runs as the unprivileged `node` user, and starts the server with the same command as `npm start`. There is no `npm install` step because there is nothing to install. It has a `HEALTHCHECK` that asks `/api/health` every 30 seconds. There is no volume, because there is nothing to keep.

```bash
docker build -t stathmas .
docker run -d --name stathmas --restart unless-stopped \
  -p 127.0.0.1:4747:4747 -e CALENDAR_SECRET=... stathmas
```

`docker-compose.yml` is the same thing written down, with `restart: unless-stopped`. It reads `CALENDAR_SECRET` from your shell or from a `.env` file beside it (which `.gitignore` keeps out of git), and refuses to start without one.

```bash
docker compose up -d --build
docker compose logs -f
```

Put a reverse proxy in front of the container to terminate HTTPS and compress responses. Caddy needs the least configuration, because it fetches and renews the certificate itself:

```
stathmas.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4747
}
```

Once HTTPS is in place, set `SECURE_COOKIES=1`, so browsers only send the door cookies over HTTPS. Don't set it without HTTPS: a browser drops a `Secure` cookie that arrives over `http://`, and no door would stay open.

## Before December

- **Preview mode must be off.** It is unless `TIME_TRAVEL=1` is set or the server was started with `--preview`. Check that `/api/catalog` answers 404.
- **The secret must be set, and must not change** until Twelfth Night. Changing it redraws the calendar.
- **Leave `films.json` alone in December.** Adding or removing a film redraws the calendar; fixing a typo in a logline is fine.
- **Point an uptime check at `GET /api/health`.** It answers `{"ok": true}` with a 200.
- **Time zone fallback.** Doors open at midnight in the visitor's own time zone, sent by the browser. `DEFAULT_TZ` is only used when a client doesn't send one.
