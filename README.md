# Stathmas

An advent calendar of Jason Statham action vehicles, dressed as a printed card calendar from about 1962. Thirty-one paper doors are hidden in a snowy village on Christmas Eve, one for each day of December. Each opens at midnight in the visitor's own time zone and shows a small painted picture of that night's film: a tin shark for *The Meg*, a honeybee on a skep for *The Beekeeper*. The calendar plays Christmas completely straight.

The design direction, and the reasoning behind it, is in [docs/design.md](docs/design.md).

## The films

Thirty-one films, one per door. Twenty-eight are every film where Statham is the lead in an action or crime picture, from *The Transporter* (2002) to *Mutiny* (2026). Three more are there by choice: *Lock, Stock and Two Smoking Barrels* and *Snatch*, the Guy Ritchie films that started it, and *The Expendables* as the one ensemble wildcard. The rest of the ensembles and supporting turns are left out: the *Fast & Furious* films, *Hobbs & Shaw*, the *Expendables* sequels, *The Italian Job*, *Cellular*, *Spy*, *13* and the rest.

The order is random and drawn once per year, the first time that year's calendar is requested. After that it's stored, so every visitor gets the same calendar. (If the catalog ever has fewer films than days, the spare days become encores of films already shown.)

Facts (director, runtime, release year, character, box office) come from Wikipedia; `scripts/fetch_films.py` is the research pull. Loglines and the dry "briefing" notes are written for this site. The catalog lives in `server/data/films.json` and is loaded into the database each time the server starts.

## Running it

Needs Node 22.13 or newer. There are no dependencies to install.

```bash
node server/index.js
```

Then open http://localhost:4747. `npm start`, `npm run dev` (restarts on file changes) and `npm test` work too if npm is installed.

### Preview mode

Before December every door is locked. To pretend it's another date, add `?preview=2026-12-14` to the URL. A pencilled note under the card shows the preview date; click it to rub it out, or use `?preview=off`. While previewing, the list of doors has a "close all my doors again" link. While preview mode is on, http://localhost:4747/catalog.html shows every film at once, with its picture, logline and note, in release order. It gives the whole calendar away, so it's switched off along with preview mode. Preview mode is on by default for the prototype. Turn it off for a real December with `TIME_TRAVEL=0`.

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

The server decides what's unlocked, so there's no peeking at future films through the browser's developer tools. Visitors are identified by an anonymous cookie; there are no accounts. The client sends its time zone in an `X-Timezone` header so doors open at local midnight.

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
