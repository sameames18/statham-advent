# Stathmas — Design Direction v2

Sep 27, 2026 · Sam

> Exported from the Claude Doc "Stathmas — Design Direction v2", where it was drafted and reviewed. The two diagrams in that doc are written out here as text.

Stathmas v2 drops the dark movie-poster grid for a printed 1960s paper advent calendar: one illustrated snowy Christmas scene, numbered doors hidden across it, and a small picture behind each door. The calendar plays Christmas completely straight. Jason Statham is what's behind the doors, and the joke lives in that gap. The backend, film data and API from v1 stay; the whole frontend is redone.

## What's wrong with v1

v1 is built entirely from defaults, and each one is recognisable. None of it says Christmas, and none of it says advent calendar.

| v1 choice | Why it reads as slop |
| --- | --- |
| Near-black background, cream text, one red accent | The stock "premium dark mode" palette. Every AI landing page uses it. |
| Giant condensed all-caps wordmark over an italic serif line | The portfolio-site hero template. |
| Opened / Watched / To go tiles and a progress bar | A SaaS dashboard. Advent calendars don't track your progress. The doors you've opened already do that. |
| 28 "posters" made of the same gradient and diagonal stripe in different hues | A template recoloured, not illustration. Nothing is drawn. |
| Identical rounded cards in a 7-column grid | A calendar app. On a real advent calendar you hunt for the number, and that hunt is half the ritual. |
| Pill buttons, toasts, a dashed "Preview mode" box | App chrome. |
| Film-grain overlay and a red radial glow | A shortcut to "cinematic". |

## The direction

The site is one object: a printed card advent calendar from around 1962, the kind propped on a mantelpiece or in a window. It shows a snowy village on Christmas Eve, with glitter on the rooftops and numbered paper doors tucked into windows, chimneys and shop fronts. It is sincere. Nothing on the calendar winks.

The comedy comes from the contrast, and only from the contrast. Door 14 opens onto a little painted picture of a honeybee, and the caption underneath says *The Beekeeper, 2024*, as calmly as if it said *a rocking horse*. The design never admits it's a joke, so we don't write jokes into the chrome.

Four rules follow from that:

1. **Everything is drawn or printed.** No UI components, no cards, no pills. If something can't exist on a piece of printed card, it needs a very good reason to be on the page.
2. **One picture, not a grid.** The calendar is a single scene you look into, and the doors are scattered across it.
3. **Christmas first.** Snow, candlelight, fir trees, a church steeple, a shop window, stars. Statham appears only behind the doors.
4. **Cheap print, honestly done.** A small ink palette, flat colour, slightly misregistered edges. The warmth of the look comes from those limits.

## What we borrow from the period

The mid-century printed calendar, as Sellmer in Stuttgart made it and exported it to the US, is a specific object with specific habits. We copy the habits, not any one calendar.

| Period habit | What it looked like | What we do with it |
| --- | --- | --- |
| One scene, doors hidden in it | Sellmer's first calendar, *Die kleine Stadt* ("The Little Town", 1945), set the pattern: a snowy town where the doors are its windows and shopfronts. Snowy small towns dominated the 1950s. | Our whole page is one village scene. Doors sit where a door or window would naturally be. |
| Numbers scattered, not in order | Door 1 might sit next to 17. Finding today's number is part of the fun. | Doors are placed by composition, not by date. Today's door gets a faint candle glow so no one is lost for long. |
| A picture behind each door | Small painted objects and figures: toys, candles, angels, animals. | Each film gets a small painted emblem: a shark, a bee, a car, a crown. |
| The big door on the 24th | The 24th was a larger window, usually hiding a Nativity scene. | Our largest door is still the 24th, a double door in the church. |
| Translucent windows | Behind each door sat coloured translucent paper, so a calendar hung in a window glowed. | Opened doors glow warm, as if a candle stood behind the card. |
| Glitter | Fine glitter on snow, stars and fir tips, catching the light as the calendar moved. | Sparse glitter on snow and stars that shimmers slightly as the pointer or phone moves. |
| Cheap colour printing | A handful of inks, flat areas, visible misregistration and paper tone. | A limited palette with deliberate slight misregistration and paper grain. |

For the drawing style beyond calendars, the mid-century American children's-book illustrators are the right neighbourhood: Mary Blair's flat colour, Charley Harper's geometry, the Provensens' storybook towns. They're shape-based, which matters because we'll draw in SVG.

Sources: [Advent calendar (Wikipedia)](https://en.wikipedia.org/wiki/Advent_calendar), [Sellmer company history](https://sellmer-adventskalender.myshopify.com/pages/company-history).

## Structure: one scene, doors hidden in it

The page is a single illustrated calendar card, about 3:2 landscape on desktop. Doors are placed where the drawing already has an opening, so they read as windows and shop doors rather than as a grid laid on top.

The scene has four zones (a diagram in the original doc):

| Zone | What's there | Doors |
| --- | --- | --- |
| Night sky | Stars and the moon | A few small doors |
| Village street | Houses and shops, and the picture house | Most doors, as their windows and front doors |
| Church on the hill | Tower, nave, rose window | Door 24, Christmas Eve: the big double door |
| Foreground | Sled, snowman, parcels, a lamp post | The rest |

Doors are placed by composition, and the numbers are scattered on purpose. Door sizes vary with what they sit on: a star window is small, a shop door is tall, and door 24 is roughly four times the area of the others.

- **The picture house.** A small-town cinema on the main street is period-correct and the one place the scene nods at the films. Its bill shows the latest film opened in slot-in theatre letters: NOW SHOWING, the title, JASON STATHAM. Before the first door it reads COMING SOON.
- **Today's door.** A faint candle glow behind it, so it can be found without hunting for long. The glow is the only indicator; there are no badges or rings.
- **Opened doors** stay folded back, showing their picture, the way a real calendar looks by mid-December.
- **Locked doors** look exactly like closed doors. On a real calendar, the only lock is willpower. Tapping one early gets a small printed note, not an error.

## Visual system

The look should be seven printing inks on cream card stock. Every colour on the page comes from this list; there is no separate "UI" palette.

| Ink | Hex | Used for |
| --- | --- | --- |
| Card stock | `#EFE4CC` | The paper itself, door backs, caption cards |
| Midnight | `#1E2B4A` | Night sky, the page background around the card |
| Snow | `#F7F3EA`, shadow `#C9D3DE` | Snow on roofs and ground, with a cool blue in the shadows |
| Fir green | `#2E5A3E` | Trees, wreaths, shop awnings |
| Berry red | `#B3302A` | Door numerals, ribbons, the church door, a few coats and scarves |
| Candlelight | `#E8B04A` | Lit windows, stars, the glow behind opened doors |
| Key | `#2A211C` | Line work and type. Warm brown-black, never pure black |

The hex values are a starting point. The test is whether a screenshot could pass for a scan of a real 1962 card.

**Type.** Three roles, all period-appropriate:

- **Wordmark:** "Stathmas" is lettered into the sky like the "Fröhliche Weihnachten" banners on German calendars. It is set in [Berkshire Swash](https://fonts.google.com/specimen/Berkshire+Swash), a storybook swash serif, with a snow-white outline.
- **Door numerals and film titles:** [Fraunces](https://fonts.google.com/specimen/Fraunces) at a heavy weight with its Soft axis turned up. It has the rounded, slightly swollen shapes of mid-century display type. Numerals are printed straight onto the doors in berry red, with no labels or boxes.
- **Captions and card text:** [Libre Caslon Text](https://fonts.google.com/specimen/Libre+Caslon+Text), the storybook and greeting-card serif.

Nothing is set in a sans serif, and nothing is in all caps except signage drawn into the scene.

**Texture.** These are what make it feel printed rather than rendered:

- **Paper grain:** a faint fibre texture multiplied over everything, including the doors.
- **Misregistration:** each ink layer is nudged 0.5–1.5 px off the line work, in one fixed direction, so colour slightly misses its outline.
- **Flat fills:** no gradients and no drop shadows. The one exception is a small halftone dot screen for the sky fading toward the horizon.
- **Glitter:** a few dozen specks on snow and stars. They catch the light as the pointer moves, or as a phone tilts. On reduced-motion settings they don't move at all.

**Around the card.** The calendar sits on a plain midnight background with a soft contact shadow, like a card propped on a mantel. Nothing else is on the page.

## Behind the doors

Each door opens onto a small painted picture, drawn like the toys and ornaments behind real 1960s doors. The picture is the film's emblem, drawn with the same inks and line work as the village. The film's title never appears on the door itself, only the picture and a caption.

The emblems below are a first pass, and each is meant to read as a Christmas object first and a Statham reference second.

| Film | Emblem behind the door |
| --- | --- |
| Lock, Stock and Two Smoking Barrels | Two antique shotguns crossed under a sprig of holly |
| Snatch | A dog's squeaky toy, with a diamond |
| The Transporter | A wrapped parcel in the boot of a toy saloon car |
| Transporter 2 | A toy car mid-barrel-roll, trailing a ribbon |
| Chaos | A snow globe with a bank inside |
| Revolver | A chess king ornament |
| Crank | A gingerbread heart iced with a jagged pulse line |
| War | A red paper lantern |
| The Bank Job | A safe-deposit box tied with a bow |
| In the Name of the King | A gold crown ornament |
| Death Race | A tin race car with armour plates |
| Transporter 3 | A charm bracelet |
| Crank: High Voltage | A car battery wrapped in tinsel |
| The Expendables | A glass bauble with "Lee" painted on it |
| The Mechanic | A pocket watch |
| Blitz | A hurling stick and ball |
| Killer Elite | A brass compass |
| Safe | A little safe with a dial |
| Parker | A toy Ferris wheel |
| Hummingbird | A hummingbird ornament |
| Homefront | A toy alligator |
| Wild Card | A playing card |
| Mechanic: Resurrection | A spanner in a stocking |
| The Meg | A shark, head-on, mouth open |
| Wrath of Man | A toy armoured van |
| Operation Fortune | A cocktail glass |
| Meg 2: The Trench | A toy submarine |
| The Beekeeper | A honeybee on a straw skep |
| A Working Man | A hard hat |
| Shelter | A lighthouse |
| Mutiny | A ship in a bottle |

**The card.** Tapping an opened door brings up a small printed card, like the reverse of the calendar where some publishers printed a verse for each day. It holds, in this order:

1. The day numeral and the emblem, larger.
2. The title in Fraunces, then one credit line: "2012 · Directed by Boaz Yakin · 95 minutes".
3. "Jason Statham as Luke Wright."
4. The logline, in Caslon.
5. The note, set as a short italic aside.
6. A printed checkbox, "Seen it", which the site ticks in pencil when pressed. A pencil tick then appears on the door's picture too.
7. A small "Read more on Wikipedia" line at the foot.

Box office numbers, stat grids and buttons are gone. The card closes by tapping outside it or on a small printed ×.

## Motion and interaction

Every movement should be one a piece of card could make. Nothing slides in from off-screen, nothing bounces, and nothing blurs.

| Moment | What happens |
| --- | --- |
| Hover or focus on an openable door | The door's free edge lifts about 2 px and its perforated edge shows. |
| Opening a door | It hinges on one side and folds back about 160° over 0.7 s, showing the plain cream back of the card. The picture behind warms up over about a second, as if a candle were lit behind it. |
| Tapping a door too early | The door gives a small stuck-paper wobble, and a printed tag reads "Not until 14 December." |
| Opening the card | It rises from the bottom on phones and fades in on desktop. The room dims around it; there is no blur. |
| Marking a film seen | A pencil tick draws itself in about 0.4 s, on the card and on the door's picture. |
| Glitter | One or two specks catch the light at a time as the pointer moves or the phone tilts. |

With reduced motion turned on, doors open instantly, the tick appears without drawing, and the glitter is still.

**Before December.** The calendar hangs from a ribbon at the top, like the real thing. A small paper tag on the ribbon carries the only status line on the site: "The first door opens on the 1st of December. 65 days."

**Keyboard and screen readers.** Tab order follows the door numbers, not their position in the picture. A "List of doors" link on the ribbon tag opens a plain numbered list of the doors for anyone who can't use the scene.

**Phones.** A landscape scene shrunk to a phone makes every door too small to tap. Phones get their own tall composition of the same village: sky, church, street and foreground stacked down a narrow hillside lane, with the same doors in new places.

**Preview mode** leaves the page. It stays available through `?preview=2026-12-14` in the URL. While it's on, a pencilled note in the card's corner says "Preview: 14 Dec".

## What goes away from v1

The whole v1 frontend goes: the dark theme, the Archivo and Instrument Serif pairing, the masthead, the stat tiles and progress bar, the gradient posters, the 7-column grid, pill buttons, toasts, the grain overlay, and the preview-mode panel. Box office figures leave the film card.

The backend stays as it is: the film catalog, the random draw, server-side locking, per-visitor opened and seen state, time zones, and the tests. The catalog grows to 31 films, one per door, which is already built.

## Decisions for Sam

1. **How many doors. Decided:** 31, one for each day of December, with one film behind each. Sam added *Lock, Stock and Two Smoking Barrels*, *Snatch* and *The Expendables* (as the one ensemble wildcard), so there are no encores or double features. The big double door stays on the 24th, Christmas Eve, as on period calendars. Doors 25 to 31 are ordinary doors.
2. **Who draws it.** The scene and 31 emblems are most of the work, and quality is the whole point. The options are: I draw everything in SVG in the flat mid-century style; you commission an illustrator; or we use AI image generation. **Recommendation: I draw it, after a style test.** AI images would bring back the look you're trying to get away from, and doors need clean vector edges to be cut out. I'm confident about the system and less confident about illustration quality at full scene scale, so the test goes first and you judge it.
3. **Notes as verses.** Period calendars printed a short verse for each day. The 31 dry notes could become two-line rhyming verses in the same deadpan voice, or stay as prose. This is a taste call.
4. **Phones.** A separate tall composition for phones is the right experience, but it roughly doubles the scene work. The cheaper fallback is the landscape scene with pinch-to-zoom. **Recommendation: the separate composition**, drawn after the desktop scene is approved.

## Build plan

The work runs in five phases, and each one waits for your sign-off on the last. The style test is small on purpose: it's where we find out whether hand-built SVG can carry this look, before the full scene is drawn.

The build order (a diagram in the original doc):

1. **Style test.** One house, three doors, two emblems and one film card, in the real inks and textures. *Gate: Sam approves the look.*
2. **Desktop scene.** The full village, every door placed, door opening, candle glow, the ribbon tag. *Gate: Sam approves the scene.*
3. **Emblems and card.** All 31 emblems, the printed film card, the pencil tick, notes or verses. *Gate: Sam approves the emblems.*
4. **Phones and access.** The tall phone composition, the list of doors, keyboard order, reduced motion. *Gate: checked on a real phone and by keyboard alone.*
5. **Finish.** Glitter, the misregistration pass, a last check of all 31 doors against the backend.

The style test ships as a separate page next to v1, so the two can be compared side by side. v1 stays in the repo's history and is replaced when phase 2 is approved.
