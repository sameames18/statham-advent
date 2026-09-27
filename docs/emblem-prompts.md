# Emblem image prompts

Prompts for replacing the 31 hand-built SVG emblems in `public/js/emblems.js` with generated images. The objects are the ones listed in the "Behind the doors" section of `docs/design.md`. Each prompt describes that object as a Christmas thing first and a Statham reference second, as the design asks.

## What the page needs from each image

An emblem shows up in three places: inside an opened door (`.recess` in `public/styles.css`), on the film card, and in `public/catalog.html`. In a door it is small: most doors are 60–90 units wide in the scene, and the church door is the biggest. On a phone that can be about 40 px across. Behind the picture, the recess is card-stock cream, with a candle-glow radial gradient that fades in when the door opens. That glow only shows if the picture has no background of its own.

That gives four requirements:

1. **Transparent background.** Ask for it in the API (`background: "transparent"`, with `output_format` set to `"png"` or `"webp"`) as well as in the prompt. If the image has an opaque backdrop, it covers the glow.
2. **Square, with one object in the middle.** Generate at `1024x1024`. The object should fill about 80% of the frame, with space around it.
3. **It has to read at thumbnail size.** A bold outline, a few flat shapes, a clear silhouette. Fine detail is lost at 40 px.
4. **Named by slug.** Save each as `public/emblems/<slug>.png` (for example `the-beekeeper.png`), using the slugs below, which match `server/data/films.json`. Then scale each down to 512 px as WebP for the site. 1024 px is far larger than any place the page shows it.

## Workflow: settle the style before making all 31

A batch of separate text-only prompts will drift: different line weights, different colours, some flat and some glossy. Make one anchor image first, then draw the rest from it.

1. **Style test.** Generate four emblems from text alone: The Beekeeper, The Meg, The Transporter and The Expendables. Between them they cover an animal, a creature, a vehicle and lettered text. Put the style block in front of each object prompt. Generate each 3–4 times and keep the best.
2. **Pick an anchor.** Choose the one that looks most like a scan of a 1962 card. Look at each finalist at 64 px as well as full size.
3. **Make the rest with the anchor as a reference.** Use the image edit endpoint, or in ChatGPT attach the anchor image, and start the prompt with the reference line below. Using one or two finished emblems as references keeps the line weight and palette consistent far better than repeating the words.
4. **Check each one with the checklist at the bottom** before it goes into `public/emblems/`.

A caveat on model names and parameters: at the time of writing (Sep 2026), search results say OpenAI's current image models are the GPT Image 2 family, with GPT Image 2.5 released in September 2026, and that they support transparent backgrounds. I couldn't open OpenAI's documentation to confirm this, so check the model name and parameters against the current API reference. `background`, `output_format`, `size` and `quality` have been image-API parameters since `gpt-image-1`. Some models also take an input-fidelity setting on edits, which helps the output stick closer to the reference. Use `quality: "high"` for the final images.

## Style block

Put this in front of every object prompt, word for word, so each prompt carries the same instructions:

> A small spot illustration for a printed-card Christmas advent calendar from about 1962, the kind of little picture found behind a numbered paper door. Mid-century children's-book illustration: simple geometric shapes in flat solid colour, like a two-colour screen print. No gradients, no airbrushing, no 3D rendering, no glossy highlights, no photographic lighting, no drop shadow. Shading, where it is needed at all, is one flat darker shape. Use only these printing inks: warm cream (#EFE4CC), midnight navy (#1E2B4A), snow white (#F7F3EA), cool blue-grey (#C9D3DE), fir green (#2E5A3E), berry red (#B3302A), candle gold (#E8B04A), and a warm brown-black (#2A211C) for every outline. Every shape has a bold, even brown-black outline. The colour fills sit very slightly off their outlines, up and to the right, as if the colour plates were printed a hair out of register. A faint paper-fibre texture shows inside the colour fills. Exactly one object, centred, filling about 80% of a square frame, in a simple front or side view, with a strong silhouette that still reads when shrunk to 64 pixels. Transparent background: no scenery, no ground, no floor shadow, no frame, no border, no vignette. No text or lettering unless the description asks for it.

When you use a reference image, add this line before the style block:

> Match the reference image exactly in drawing style, outline weight, colour palette, amount of detail, texture and how much of the frame the object fills. Draw a different object:

## Object prompts

Each entry gives the slug (the file name), the prompt, and a short note on the film link, so you can tell whether the picture works.

### Door objects in catalog order

**`lock-stock-and-two-smoking-barrels`** — Lock, Stock and Two Smoking Barrels
> Two antique double-barrelled shotguns crossed in an X, like the crossed emblem on a hunting-lodge wall plaque. Brown-black barrels, candle-gold wooden stocks. Where they cross, a sprig of two fir-green holly leaves and three round berry-red berries.

*The two barrels of the title.*

**`snatch`** — Snatch
> A round berry-red rubber dog's squeaky ball with a candle-gold stripe around it and a few small tooth marks. Resting against it, a large brilliant-cut diamond drawn as a simple faceted gem in snow white and blue-grey, with one small four-pointed white sparkle beside it.

*The dog that swallows the diamond.*

**`the-transporter`** — The Transporter
> A 1960s tin toy saloon car in brown-black, seen from the side, with blue-grey windows and cream hubcaps. Its boot lid is propped open, and inside the boot sits a small berry-red parcel tied with candle-gold ribbon. No badges, logos or number plates.

*Rule three: never open the package.*

**`transporter-2`** — Transporter 2
> The same 1960s tin toy saloon car in brown-black, turned completely upside down mid-somersault, with a long berry-red ribbon streaming from it in a loose loop, as if the toy were tumbling off a Christmas tree branch. No badges, logos or number plates.

*The barrel roll that scrapes a bomb off the car.*

**`chaos`** — Chaos
> A snow globe on a berry-red base. Inside the glass dome, a small cream classical bank building with four columns and a triangular pediment, surrounded by white snowflakes. The glass is pale blue-grey, with one flat curved white stripe as its only highlight.

*A bank heist, all shaken up.*

**`revolver`** — Revolver
> A chess king piece made as a berry-red Christmas tree ornament: a stepped round base, a tapering body, a crown band, and a small cross on top with a brown-black hanging loop above it.

*The chess and con games.*

**`crank`** — Crank
> A heart-shaped gingerbread biscuit in candle gold, iced across the middle with a thick snow-white jagged heartbeat line like a hospital heart-monitor trace, with small white icing dots around the edge.

*His heart has to keep racing.*

**`war`** — War
> A round berry-red paper lantern with candle-gold caps at the top and bottom, thin vertical rib lines, and a gold tassel hanging below, hung from a small brown-black loop.

*The yakuza–triad war.*

**`the-bank-job`** — The Bank Job
> A long metal safe-deposit box in blue-grey with a small candle-gold number plate and a keyhole on its front, tied up like a Christmas present with a berry-red ribbon and a big bow on top.

*The Baker Street deposit boxes.*

**`in-the-name-of-the-king`** — In the Name of the King
> A candle-gold crown Christmas ornament with five points, each point tipped with a small round berry-red bead, a band of small red and fir-green jewels, and a brown-black hanging loop on top.

*The king, played by Burt Reynolds.*

**`death-race`** — Death Race
> A chunky 1960s tin toy race car in berry red, seen from the side, with riveted blue-grey armour plates bolted over its body and windows, big brown-black wheels, and a plain candle-gold circle on its door with no number in it.

*The prison race in armoured cars.*

**`transporter-3`** — Transporter 3
> A candle-gold charm bracelet laid in an oval, drawn as a chain of small round gold links. Two charms hang from the bottom: a small gold star and a small berry-red heart.

*The bracelet that explodes if he leaves the car.*

**`crank-high-voltage`** — Crank: High Voltage
> An old-fashioned boxy car battery in brown-black with two cream terminals marked + and −, wrapped round in a loose spiral of candle-gold tinsel garland, with a small gold zig-zag spark jumping from one terminal.

*The artificial heart that needs charging.*

**`the-expendables`** — The Expendables
> A round berry-red Christmas bauble with a candle-gold cap and a brown-black hanging loop, with two wavy candle-gold bands around it. Across the middle, the name "Lee" is hand-lettered in snow-white script. The only text in the image is the word "Lee".

*His character is called Lee Christmas.*

**`the-mechanic`** — The Mechanic
> An open candle-gold pocket watch on a short gold chain. Cream dial, brown-black hands and hour marks, and a sprig of fir-green holly with two red berries tucked through the chain.

*The meticulous hitman who times everything.*

**`blitz`** — Blitz
> A wooden hurling stick (an Irish hurley, with a flat, curved, widening blade) in candle gold, lying diagonally, with a small snow-white leather ball with a raised seam beside the blade and a berry-red bow tied round the handle.

*The hurley in the opening scene.*

**`killer-elite`** — Killer Elite
> An open brass pocket compass in candle gold, with a cream face, a berry-red and brown-black needle, and a small gold star at the north point.

*Tracking down ex-SAS men.*

**`safe`** — Safe
> A small squat fir-green safe shaped like a cube, with a large round candle-gold combination dial, a brown-black handle, and a berry-red Christmas bow on top.

*The girl who carries the code in her head.*

**`parker`** — Parker
> A tin toy fairground Ferris wheel on a small stand, with a candle-gold rim and spokes, and six little gondolas alternating berry red and fir green.

*The opening heist at the Ohio State Fair.*

**`hummingbird`** — Hummingbird
> A clip-on glass Christmas tree ornament shaped like a hummingbird: fir-green body, berry-red throat, candle-gold wings spread wide, and a long thin brown-black beak, seen from the side.

*The title.*

**`homefront`** — Homefront
> A painted wooden pull-along toy alligator in fir green, made of jointed segments, with small cream wheels, a row of white triangular teeth in a grin, and a berry-red ribbon bow round its neck.

*The meth cook is called Gator.*

**`wild-card`** — Wild Card
> A single playing card, the ace of hearts, cream with rounded corners and a brown-black outline, a big berry-red heart in the centre, and a small red letter "A" in the top-left and bottom-right corners. A sprig of fir-green holly is tucked behind one corner. The only text in the image is the letter "A".

*The gambling bodyguard.*

**`mechanic-resurrection`** — Mechanic: Resurrection
> A berry-red Christmas stocking with a snow-white cuff and a heel patch, with a large blue-grey steel spanner (wrench) sticking out of the top at an angle.

*The mechanic is back.*

**`the-meg`** — The Meg
> A shark Christmas tree ornament seen head-on, mouth wide open, showing rows of snow-white triangular teeth and a berry-red inside to the mouth. The body is midnight navy with a blue-grey belly and small round brown-black eyes, with a brown-black hanging loop on top of its head.

*The megalodon.*

**`wrath-of-man`** — Wrath of Man
> A boxy 1960s tin toy armoured security van in blue-grey with midnight-navy trim, seen from the side, with small barred windows, big brown-black wheels, and a small fir-green Christmas wreath with a red bow on its front grille. No logos or lettering.

*The armoured-truck company.*

**`operation-fortune`** — Operation Fortune: Ruse de Guerre
> A stemmed cocktail glass with a V-shaped bowl, outlined in brown-black and filled with pale blue-grey. A berry-red cherry sits on a cocktail stick, and a small sprig of fir-green holly is hooked over the rim.

*The spy's cocktails.*

**`meg-2`** — Meg 2: The Trench
> A candle-gold tin toy submarine seen from the side, with three round cream portholes in a row, a conning tower with a brown-black periscope, and a small brown-black propeller at the tail.

*The dive into the Trench.*

**`the-beekeeper`** — The Beekeeper
> A honeybee with candle-gold and brown-black stripes and cream wings, sitting on top of a traditional domed straw bee skep in candle gold with brown-black coil lines. A sprig of fir-green holly with red berries sits beside the skep's small dark entrance.

*The Beekeepers.*

**`a-working-man`** — A Working Man
> A candle-gold construction hard hat seen from the side, with a brim and a ridge along the top, a berry-red ribbon tied round it like a hat band, and a sprig of fir-green holly tucked into the ribbon.

*The construction foreman.*

**`shelter`** — Shelter
> A berry-red and snow-white striped lighthouse standing on a small snowy grey rock, with a candle-gold lamp room at the top giving off short gold rays and a small fir-green wreath on its door.

*The remote Scottish island.*

**`mutiny`** — Mutiny
> A ship in a bottle: a clear glass bottle, outlined in brown-black and tinted pale blue-grey, lying on its side with a cream cork and a berry-red ribbon tied round its neck. Inside is a small cargo steamer with a berry-red hull, a cream deck house and a brown-black funnel, on a band of midnight-navy sea.

*The cargo ship.*

## Likely refusals and substitutes

Content filters in image models are hard to predict, and so is which prompts they block. The one most likely to trip one is `lock-stock-and-two-smoking-barrels`, because it shows guns. If it is refused, try describing them as "antique fowling pieces on a heraldic shield". If that is refused too, use a different object: two brass shotgun cartridges tied together with holly. Don't mention Jason Statham, a film title or a car brand in any prompt. None of them are needed, and each makes a refusal or an unwanted likeness more likely.

## Checklist for each image

Before an image goes into `public/emblems/`:

- **The background is really transparent.** Put the image on the card cream (#EFE4CC) and on midnight (#1E2B4A). Look for a pale halo or a leftover rectangle around the object.
- **It reads at 64 px.** Scale it down and ask whether someone would name the object.
- **The colours stay within the seven inks.** Models only roughly follow hex codes, so compare against the palette in `docs/design.md`. If colours drift across the set, you can snap every image to the seven inks with a small script, which also makes the set look more like cheap print.
- **It matches the anchor.** Look at it next to the anchor and the last few you accepted. Check the outline weight, the size in the frame, and how flat it is.
- **It has no stray text.** Only `the-expendables` ("Lee") and `wild-card` ("A") should have any lettering.

## After the images exist

The page still draws the SVG emblems. To use the images, change `emblemSvg()` in `public/js/emblems.js`, which is used by `public/js/app.js` and `public/catalog.html`, so it returns an `<img>` pointing at `/emblems/<slug>.webp`. Any rules in `public/styles.css` and `public/catalog.html` that target `.emblem-svg` then need to point at the new element. The SVG versions add their slight misregistration in code (`offset()`), but the images will have it drawn in instead.
