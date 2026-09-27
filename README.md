# Stathmas

An advent calendar of Jason Statham action vehicles. Thirty-one doors, one for each day of December. Each door opens at midnight in the visitor's own time zone and reveals the film for that night.

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

Before December every door is locked. Preview mode lets you pretend it's another date: use the controls in the footer, or add `?preview=2026-12-14` to the URL. It's on by default for the prototype. Turn it off for a real December with `TIME_TRAVEL=0`.

## How it works

**Backend** (`server/`): a plain Node HTTP server using the built-in `node:sqlite`. It serves the site and a small JSON API:

| Route | What it does |
| --- | --- |
| `GET /api/calendar` | All 31 doors with their state for this visitor. Locked or unopened doors carry no film data. |
| `GET /api/doors/:day` | Full details for a door this visitor has opened. |
| `POST /api/doors/:day/open` | Opens a door. Refused with 403 before its date. |
| `POST /api/doors/:day/watched` | Marks a film watched (`{"watched": false}` to undo). |
| `POST /api/reset` | Closes all of this visitor's doors. |

The server decides what's unlocked, so there's no peeking at future films through the browser's developer tools. Visitors are identified by an anonymous cookie; there are no accounts. The client sends its time zone in an `X-Timezone` header so doors open at local midnight.

**Frontend** (`public/`): plain HTML, CSS and JavaScript with no build step. Fonts are Archivo and Instrument Serif from Google Fonts.

**Data** lives in `data/stathmas.db`, which is created on first run and ignored by git.

### Redrawing the calendar

```bash
node scripts/reshuffle.js 2026
```

This draws a new order for that year and prints it. Do it before December: visitors' opened and watched marks are stored by day number, so a mid-month reshuffle would put them on the wrong films.
