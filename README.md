# Stathmas

An advent calendar of Jason Statham action vehicles, dressed as a printed card calendar from about 1962. Thirty-one paper doors are hidden in a snowy village on Christmas Eve, one for each day of December. Each opens at midnight in the visitor's own time zone and shows a small painted picture of that night's film: a tin shark for *The Meg*, a honeybee on a skep for *The Beekeeper*. The calendar plays Christmas completely straight.

The design direction, and the reasoning behind it, is in [docs/design.md](docs/design.md).

## The films

Thirty-one films, one per door. Twenty-eight are every film where Statham is the lead in an action or crime picture, from *The Transporter* (2002) to *Mutiny* (2026). Three more are there by choice: *Lock, Stock and Two Smoking Barrels* and *Snatch*, the Guy Ritchie films that started it, and *The Expendables* as the one ensemble wildcard. The rest of the ensembles and supporting turns are left out: the *Fast & Furious* films, *Hobbs & Shaw*, the *Expendables* sequels, *The Italian Job*, *Cellular*, *Spy*, *13* and the rest.

The order is random and drawn once per year, the first time that year's calendar is requested. After that it's stored, so every visitor gets the same calendar. (If the catalog ever has fewer films than days, the spare days become encores of films already shown.)

Facts (director, runtime, release year, character) come from Wikipedia; `scripts/fetch_films.py` is the research pull. Loglines and the dry "briefing" notes are written for this site. The catalog lives in `server/data/films.json`, and the database is synced to it each time the server starts: edited entries are updated, new ones added, and any film no longer in the JSON is deleted. A film can't be deleted while a stored calendar still has it behind a door; the server refuses to start and names the film and the year, and you reshuffle that year first (see [Redrawing the calendar](#redrawing-the-calendar)) or put the film back.

## Running it

Needs Node 22.13 or newer. There are no dependencies to install.

```bash
node server/index.js
```

Then open http://localhost:4747. `npm start`, `npm run dev` (restarts on file changes, with preview mode on) and `npm test` work too if npm is installed.

The server sends its files with `ETag` and `Last-Modified` validators and `Cache-Control: no-cache`, so a returning browser asks whether each file has changed and gets a bodiless 304 when it hasn't, while an edit is picked up on the very next load after a deploy. It does not compress anything: if you put it on the internet, run it behind a reverse proxy (Caddy, nginx) and let the proxy do gzip or brotli.

### Tests

```bash
npm test
```

Unit tests for the calendar logic, the drawing modules, the database layer and the HTTP API, all on Node's built-in test runner with nothing to install. They run on every push and pull request (`.github/workflows/test.yml`).

There is also a browser smoke test that drives the real page in headless Chromium. It needs the one development dependency, Playwright, and a browser, so it is a separate script:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

Playwright is pinned to the version whose Chromium build the review environment already has, so bump it deliberately.

### Preview mode

Before December every door is locked. To pretend it's another date, start the server with preview mode on and add `?preview=2026-12-14` to the URL. A pencilled note under the card shows the preview date; click it to rub it out, or use `?preview=off`. While previewing, the list of doors has a "close all my doors again" link. While preview mode is on, http://localhost:4747/catalog.html shows every film at once, with its picture, logline and note, in release order. It gives the whole calendar away, so it's switched off along with preview mode.

Preview mode is off by default. `npm run dev` turns it on (it passes `--preview`); otherwise start the server with `TIME_TRAVEL=1 node server/index.js` or `node server/index.js --preview`. When it is on, the server prints "Preview mode is on" at startup.

## How it works

**Backend** (`server/`): a plain Node HTTP server using the built-in `node:sqlite`. It serves the site and a small JSON API:

| Route | What it does |
| --- | --- |
| `GET /api/calendar` | All 31 doors with their state for this visitor. Locked or unopened doors carry no film data. |
| `GET /api/doors/:day` | Full details for a door this visitor has opened. |
| `POST /api/doors/:day/open` | Opens a door. Refused with 403 before its date. |
| `POST /api/doors/:day/watched` | Marks a film watched (`{"watched": false}` to undo). |
| `POST /api/reset` | Closes all of this visitor's doors. |
| `GET /api/catalog` | Every film in release order. Preview mode only. |
| `GET /api/health` | Liveness check for uptime monitors and the Docker healthcheck; answers `{"ok": true}`. |

The server decides what's unlocked, so there's no peeking at future films through the browser's developer tools. Visitors are identified by an anonymous cookie; there are no accounts. The client sends its time zone in an `X-Timezone` header so doors open at local midnight.

**The season** runs from the 1st of December to Twelfth Night, the 6th of January, when the decorations come down. Until then the API keeps serving the December just gone, with all 31 doors unlocked, so a visitor who missed a night can still catch up and the ribbon tag reads "That was Stathmas 2026". From the 7th of January the site switches to the coming December: every door is locked, the tag counts down to the 1st, and that year's calendar is drawn the first time it's requested. `seasonYear` in `server/calendar.js` makes the choice; the date is `SEASON_END` next to it. `?year=` on the API still asks for any year explicitly.

**Frontend** (`public/`): plain HTML, CSS and JavaScript modules with no build step.

- `js/scene.js` draws the village as SVG in two compositions: a wide card for desktop and a tall one for phones, each with 31 door slots. Door numbers are scattered by composition; the church's big double door is always 24, Christmas Eve.
- `js/doors.js` prints the front of each paper door (a lit window, a front door, a star, a parcel on the sled), and `js/emblems.js` draws the 31 film pictures behind them.
- `js/svg.js` is the shared drawing kit. Every shape is printed twice, a flat ink plate slightly off register under a key line plate, which is where the cheap-print look comes from.
- `js/app.js` lays the doors over the picture as HTML so they can swing open, and runs the film card, the ribbon tag, the picture house bill (the latest film opened, in slot-in letters), the list of doors and the glitter.

Seven inks only (card, midnight, snow, fir, berry, candlelight, key), with Fraunces for numerals and titles, Libre Caslon Text for words, Berkshire Swash for the wordmark and Reenie Beanie for pencil notes. The fonts are served from `public/fonts/` (Latin subsets, cut by `scripts/subset_fonts.sh`) rather than from Google Fonts, so a visit makes no third-party request.

**Data** lives in `data/stathmas.db`, which is created on first run and ignored by git.

### Redrawing the calendar

```bash
node scripts/reshuffle.js 2026
```

This draws a new order for that year and prints it. Do it before December: visitors' opened and watched marks are stored by day number, so a mid-month reshuffle would put them on the wrong films.

Reshuffling also syncs the catalog with `films.json` before drawing, so this is the way to take a film out of a year that already has a calendar: remove it from the JSON, reshuffle the year, then start the server.

## Deploying

The site is one Node process with no dependencies and one SQLite file, so a small VPS with Docker and a reverse proxy is enough. Everything below assumes that shape.

### The image

The `Dockerfile` at the root builds from the official `node:22.22-slim` image (`.node-version` pins the same minor for fnm, nodenv and other version managers that read it), copies `package.json`, `server/`, `public/` and `scripts/reshuffle.js`, runs as the unprivileged `node` user, and starts the server with the same command as `npm start`. There is no `npm install` step because there is nothing to install. The image sets `PORT=4747`, `DB_FILE=/data/stathmas.db` and `TIME_TRAVEL=0`, declares `/data` as a volume, and has a `HEALTHCHECK` that asks `/api/health` every 30 seconds.

```bash
docker build -t stathmas .
docker run -d --name stathmas --restart unless-stopped \
  -p 127.0.0.1:4747:4747 -v stathmas-data:/data -e TIME_TRAVEL=0 stathmas
```

`docker-compose.yml` is the same thing written down, with `restart: unless-stopped` and a named volume. Restart matters: an unhandled error can end the Node process, and nothing inside the container will start it again, so Docker has to.

```bash
docker compose up -d --build
docker compose logs -f
```

### The database is the only state

`DB_FILE` must point at a persistent volume. Everything the site remembers is in that one SQLite file: the year's calendar order, and which doors each visitor has opened and marked watched. The film catalog is not state; it is loaded from `server/data/films.json` at every start. If the file is lost, the next start creates an empty database, draws a new random calendar, and every visitor's doors close. The compose file keeps it in a named volume called `stathmas-data`. If you bind-mount a host directory instead, it must be writable by uid 1000, the `node` user inside the image.

To back it up, don't copy `stathmas.db` on its own: the server keeps the database in WAL mode, so recent writes sit in `stathmas.db-wal` beside it until a checkpoint. Either stop the container and copy all three files, or take a consistent snapshot while it runs:

```bash
docker compose exec stathmas node -e \
  'new (require("node:sqlite").DatabaseSync)(process.env.DB_FILE).exec("VACUUM INTO \x27/data/backup.db\x27")'
docker cp stathmas:/data/backup.db ./stathmas-$(date +%F).db
```

### HTTPS, compression and the visitor cookie

Put a reverse proxy in front of the container to terminate HTTPS and compress responses. The Node server speaks plain HTTP and does not gzip; the SVG scene and the JavaScript modules compress well, so let the proxy do it. Caddy needs the least configuration, because it fetches and renews the certificate itself. This complete `Caddyfile` does everything the site needs:

```
stathmas.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4747
}
```

(nginx and Traefik work just as well; the only requirement is that the proxy forwards to port 4747.)

Once HTTPS is in place, start the container with `SECURE_COOKIES=1`. The server then adds the `Secure` attribute to the anonymous visitor cookie, so browsers only send it over HTTPS. The server does not infer this from an `X-Forwarded-Proto` header: it is an explicit setting, so a proxy that forgets to set the header cannot silently downgrade the cookie, and local development over plain `http://` keeps working with the setting left unset. Do not set it without HTTPS, though. A browser drops a `Secure` cookie that arrives over `http://`, so every request would look like a new visitor and no door would stay open.

### Before December

- **Preview mode must be off.** With it on, anyone can open any door by adding `?preview=` to the URL, and `/catalog.html` lists every film. It is off unless the server is started with `TIME_TRAVEL=1` or `--preview`, and the image and the compose file both set `TIME_TRAVEL=0` as well. If the server prints "Preview mode is on" at startup, it is on.
- **Redraw, if you want to, before December 1, never during it.** The calendar order for a year is drawn once, the first time that year is requested, and stored. `node scripts/reshuffle.js 2026` draws a new one. Visitors' opened and watched marks are keyed by day number, so a reshuffle mid-month would put their marks on the wrong films. Inside the container:

  ```bash
  docker compose exec stathmas node scripts/reshuffle.js 2026
  ```

- **Point an uptime check at `GET /api/health`.** It answers `{"ok": true}` with a 200, needs no cookie, and is what the image's own healthcheck uses. `docker ps` shows the container as `healthy` or `unhealthy` from it.
- **Time zone fallback.** Doors open at midnight in the visitor's own time zone, sent by the browser. `DEFAULT_TZ` (default `America/Los_Angeles`) is only used when a client doesn't send one.
