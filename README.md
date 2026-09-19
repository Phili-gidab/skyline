# Skyline Travel Solution — website

A scroll-driven 3D marketing site for a visa and travel consultancy based on Bole Road, Addis Ababa.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # serve the production build on :4173
```

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 5 + React 18 |
| Animation | GSAP 3 + ScrollTrigger |
| Smooth scroll | Lenis, driven from the GSAP ticker so ScrollTrigger stays in sync |
| 3D | three.js via @react-three/fiber (hand-written shaders, no helper libs) |
| Type | Instrument Serif / Inter Tight / Archivo Expanded / JetBrains Mono / Noto Sans Ethiopic |

The 3D stage is a lazy chunk, so three never blocks first paint. The whole build is ~1.8 MB,
of which the aircraft is 628 KB.

## The architecture

The page is built around **one aircraft in one fixed canvas**, in the manner of
[drone.riotters.com](https://drone.riotters.com/). Scroll does not *trigger* 3D animations — it
**scrubs** them, which is what makes the motion feel attached to the scroll rather than fired by it.

```
.stage-sky        z-index -3 — the sky, as CSS
.stage-wordmark   z-index -2 — the giant ghosted "skyline"
<Stage/>          z-index -1 — the 3D canvas, TRANSPARENT
<Story/>          z-index  1 — five panels scrolling over the stage
<div.ground>      z-index  2 — opaque; covers the stage for the content sections
```

The canvas being transparent is the whole hero effect: the aircraft **occludes** an
enormous ghosted wordmark sitting behind it. Set `alpha: false` on the renderer, or
reintroduce an in-scene backdrop, and the wordmark disappears behind an opaque sky.

- [`src/stage3d/choreography.js`](src/stage3d/choreography.js) — the `BEATS` array. Each beat pins a
  camera position, model rotation/position and field of view for one panel. `sampleBeats(p)`
  interpolates between them with a smootherstep ease, so beat boundaries are not corners.
- [`src/stage3d/Stage.jsx`](src/stage3d/Stage.jsx) — the fixed canvas. A `ScrollTrigger` with
  `scrub: true` writes normalised progress into the shared `stage` object; the render loop *damps*
  toward the sampled beat rather than snapping to it, which is what keeps fast scrolling smooth.
  The damping is frame-rate independent (`1 - pow(k, delta)`).
- [`src/components/Story.jsx`](src/components/Story.jsx) — the five panels and their copy.

Two rules the choreography depends on:

- **`rot.y` stays in a narrow band** (about -0.2 to -1.5). A `rot.y` of `-PI/2` points the nose at
  camera; past about -3.0 the aircraft reads as flying *tail-first*. Vary `rot.x` for plan-versus-side
  views and `rot.z` for bank — never spin with `rot.y`.
- **Each panel must fit one viewport.** Panels are `min-height: 100svh` and vertically centred, so
  content taller than the viewport rides up under the fixed nav. Keep panel copy tight.

The aircraft also carries a permanent idle — a slow sway, bob and roll layered on top of the scroll
choreography in `Stage.jsx` — so it is alive even when nobody is scrolling.

To re-choreograph the page, edit `BEATS`. Nothing else needs to change.

### The aircraft model

[`src/stage3d/Aircraft.jsx`](src/stage3d/Aircraft.jsx) is **model-agnostic**. It loads
`public/models/aircraft.glb`, centres it on its own bounding box and scales its longest axis to
`TARGET_LENGTH`, so the choreography keeps working whatever model you supply. It also infers the
nose axis from the bounding box; if a model still loads sideways or belly-up, correct it with
`MODEL_ROTATION_OFFSET` rather than editing the choreography. If the file is absent, a procedural
placeholder stands in and the page still runs.

Current model: **Boeing 777-300ER by hakai315** via Sketchfab, licensed **CC BY 4.0** — the type
Ethiopian Airlines actually flies out of Bole.

**The engine fans spin.** The model's mesh names are Blender defaults, so the fans are found by name
prefix (`Cylinder.029`/`028` to port, `Cylinder.026`/`025` to starboard), re-parented onto a pivot at
their own centre, and rotated about the model's X axis. This is why the optimise script runs with
`--join false --flatten false`: joining meshes by material would fuse the fans into the airframe and
they could never be animated. If you swap the model, update `FAN_PREFIXES` in `Aircraft.jsx` — the
fans will simply sit still if the names do not match, rather than breaking anything.

> CC BY permits commercial use **but requires the author to be credited**. At the client's
> direction the credit is **not rendered on the site** — they are attributing on social media
> instead. Nothing in the code enforces this, so if the site is ever handed to someone else, the
> obligation travels with it: see `public/models/README.md`.

Models under **GPL** (including Flightradar24's open aircraft set) were rejected: copyleft is not
appropriate for a commercial client site.

#### Optimising a source model

The Sketchfab download is **68 MB / 2.2M triangles** — unshippable, and especially so for this
client, whose audience is largely on Ethiopian mobile data. The source is kept out of both the
bundle and the repo in `model-source/` (gitignored), and compressed into `public/models/`:

```bash
npm run model:optimize   # model-source/aircraft-source.glb → public/models/aircraft.glb
npm run model:inspect    # report on the optimised file
```

That takes **68.26 MB → 2.66 MB** (26×) via meshoptimizer simplification plus meshopt compression.

Two settings are load-bearing and were learned the hard way:

- **`--simplify-ratio 0.45`.** An earlier pass used `0.06` — keeping 6% of vertices — which got the
  file to 866 KB but tore visible holes in the fuselage and faceted the nose. Curved surfaces do not
  survive that much decimation. Do not drop below about `0.3`.
- **`--simplify-lock-border true`.** Locks topological borders so open edges are not collapsed. This
  is the specific fix for gaps appearing along seams.

Joining meshes would shrink it further, but costs the animated fans.

Compression is **meshopt, not Draco**, deliberately: the meshopt decoder ships inside three, so
there are no decoder `.wasm` files to host and keep in sync. It is registered in `Aircraft.jsx` via
`loader.setMeshoptDecoder(MeshoptDecoder)` — remove that and a compressed model will fail to load.

## The logo

The client supplied only rasters (a 1280px PNG and a 640px JPG, both soft), so the artwork is
**traced** rather than redrawn — [`tools/trace-logo.py`](tools/trace-logo.py) recovers its real
outlines instead of approximating them:

```bash
python tools/trace-logo.py     # brand-source/*.png -> public/logo*.svg + favicon
```

Marching squares extracts sub-pixel contours at the alpha half-level, Douglas-Peucker simplifies
them, and each colour band becomes one even-odd path. Three details matter:

- **The source is upsampled 3x before tracing.** Marching squares interpolates between corner
  values, so tracing a Lanczos upsample of an antialiased edge gives genuinely smoother contours
  than tracing at native size.
- **Simplification is per band.** The tolerance that suits the mark destroys small type.
- **The two-tone wordmark is split by contour centroid, never by masking a column range.** Masking
  cut straight through the "Y" and left a visible seam where the two paths butted together. Splitting
  whole contours by centroid means a letter is never divided — 7 contours for 7 letters.

**The tagline is not traced.** It is only ~39px tall in the supplied raster and its letterforms are
already eroded there, so tracing faithfully reproduces the damage. It is set as live type in
[`Logo.jsx`](src/components/Logo.jsx) instead, which stays crisp at any size. `--logo-w` drives both
the artwork and the tagline so they scale together.

Generated assets, all from the one script so they cannot drift:

| File | Use |
| --- | --- |
| `logo-lockup.svg` | mark + wordmark + TRAVEL SOLUTION, cream lettering — the footer's deep emerald |
| `logo-lockup-color.svg` | same, original brand colour — white grounds (the preloader) |
| `logo-compact.svg` / `logo-compact-dark.svg` | mark + wordmark only — the nav, light over deep emerald, dark over white |
| `logo.svg` / `logo-color.svg` | full lockup including the traced tagline, if ever needed flat |
| `favicon.svg` | the mark alone; anything with type is illegible at 32px |

Brand greens sampled from the source: **`#0e8f47`** dark, **`#23ad68`** light, lifted to `#25b06b` /
`#3ecb84` on the dark ground. Raster originals live in `brand-source/`, deliberately outside
`public/` so 630 KB of source never ships.

If the client can get the original vector (AI/EPS/PDF) from whoever designed the logo, that is still
better than any trace — particularly for the tagline.

## Design system

All tokens live at the top of [src/styles/global.css](src/styles/global.css).

White leads; emerald is the secondary colour and the accent.

- **Ground** `--white`, with `--mist #f3f7f4` for alternating sections (Destinations, Careers)
- **Text** `--ink #0d1d16`, `--text-2` / `--text-3` (ink at 74% / 58%), `--sage` for labels
- **Accent** `--emerald #0b7d3f` — a shade deeper than the logo's `#0e8f47`, which reads at only
  4.2:1 as small text on white; `#0b7d3f` clears AA on white and on the mist
- **Secondary ground** `--emerald-deep #0b3a26` — the split-flap boards, the arrivals board, the
  fly-over's contour ground, the footer and the mobile menu. On it, text is `--on-deep*` and the
  accent is `--mint-glow #7fdca6`, since the brand green is too dark to read there
- Type pairing: an uppercase display serif against a tight grotesk, with mono for all labels
- The giant hero wordmark is **Archivo at width 125** — a hairline serif goes spindly at 21vw and
  reads as noise rather than mass

A faint multiplied grain, a light vignette and an emerald cursor sit above everything as fixed
overlays. The cursor no longer uses a difference blend, which turned green grounds magenta.

## Section map

**Over the 3D stage:**

| Panel | Content |
| --- | --- |
| 01 Hero | Wordmark, standfirst, live Addis clock, split-flap departure board |
| 02 Capabilities | Turnaround times as spec readouts |
| 03 Routes | The ten destinations as an IATA route list |
| 04 Process | The catalogue's six steps |
| 05 Record | An arrivals board, bookending the hero's departures board: split-flap stats that riffle in row by row and replay in either scroll direction, then a WhatsApp / Telegram call to action |

**On the ground, below:** Destinations (pinned horizontal gallery of postcards — full-colour photo,
details on a white panel, inclusions and a WhatsApp link on hover or focus), Service catalogue
(accordion, from the client's PDF), Study (an offer sheet for Post University:
a turning seal, four key figures, the programmes with the listed fee struck through, and the merit
awards as a column chart; opened by the fly-over below), Careers, Contact, and the Footer — navigation into every section, service line and destination (a
footer service link opens that line of the catalogue), one compact contact column, and an outlined
wordmark that fills mint on hover, all on the deep emerald ground.

**The Study fly-over.** Study pins for 1.8 screens of scroll under layered art, moved by one
scrubbed GSAP timeline ([Study.jsx](src/components/Study.jsx), `FLIGHT`): the ground far below as a
mint contour map on deep emerald, cloud converging from three sides into a whiteout, then parting off the page while
the 777 — seen from above, with a soft shadow — crosses over the heading. The page is back by just
past halfway; the aircraft finishes its pass over it. No WebGL: an earlier real-time shader version
looked muddy, and layered cut-outs are how the reference builds its own sequence.

The art in `public/flyover/` was rendered offline, not sourced:

- Clouds and ground: `tools/flyover/make_sky.py` (numpy + scipy) — top-down cumulus with a height
  field, lambert shading and marched self-shadow, and the contour map.
- The aircraft: `tools/flyover/plane.html`, opened on the dev server, renders the site's own
  `aircraft.glb` straight down (orthographic, three's RoomEnvironment); `make_plane.py` trims it,
  sizes it to 1600/2800px and blurs the silhouette into its shadow.

The whiteout (`.flyover__fog`) is exactly `--white`, the section's ground, so lifting it reveals
the page with no seam.
Nav links to Study land at the end of the pin, on the content. With reduced motion there is no pin.

The split-flap board ([SplitFlap.jsx](src/components/SplitFlap.jsx)) is a Solari display: each cell
riffles the charset and settles left to right.

## The nav

The site is white, so the bar is dark ink on a white scrim by default. Over the deep emerald it
carries an explicit `is-dark` state, which swaps both the text colour and the logo file. (It once
used `mix-blend-mode: difference`, which keeps text legible on any ground but inverted the logo's
brand green to **magenta**.) Three things turn it dark: any region marked `data-nav="dark"` (the
footer), the open mobile menu, and the Study fly-over, which says so through the `NAV_TONE` event
([events.js](src/lib/events.js)) because its ground gives way to white partway through its pin. A gradient scrim sits behind the bar at all times so
content scrolling underneath stays readable; that is deliberately CSS-only rather than a
JS-toggled class, which left the bar briefly unreadable mid-scroll.

## Gotchas worth knowing

- **Never name a source directory after a package.** `src/three/` made Vite resolve
  `import('./three/Stage')` to `three/stage.js` — Windows is case-insensitive and Vite tries `.js`
  before `.jsx` — so three.js silently vanished from the bundle with no error. Hence `src/stage3d/`
  and `choreography.js`.
- Additive blending in the 3D scene is kept very low-alpha, and any `gl_PointSize` is attenuated to
  roughly two device pixels. Raising either turns the scene into a glowing blob.
- **Story panels must fit one viewport.** They are `min-height: 100svh` with centred content, so a
  panel whose content overflows pushes itself up under the nav and collides with the neighbouring
  panel's crossfade. The routes and process panels both did this at 1440x900 until their rows were
  tightened; there is a `max-height: 940px` block that tightens them further on short laptops.
- **Never animate one property with two scrubbed tweens.** The story panels used a scrubbed
  fade-in `fromTo` plus a scrubbed fade-out `to` on the same element's opacity. The `to` recorded the
  `fromTo`'s hidden start state as its own start, so scrolling *back up* reversed the fade-out into
  opacity 0 — the copy vanished while the aircraft kept animating. The fade is now a pure function
  of the panel's position (`Story.jsx`), which has no history and is right in both directions.
- Body copy uses `--text-2` / `--text-3`, and no text is set below 0.72rem (the cursor label
  excepted). Small text in the accent uses `--emerald`, never the logo's own green (4.2:1 on
  white). The edge vignette is kept to 6% because it sits over every section.
- Every `.panel--fade` fades out, the last one included. Skipping the last left "THE RECORD" painted
  on top of the Destinations section below it, because the panels sit over a fixed stage.
- **three's GLTFLoader renames nodes.** It runs every node name through
  `PropertyBinding.sanitizeNodeName`, which replaces dots with underscores: the glTF says
  `Cylinder.026_Material.005_0`, the `Object3D` is called `Cylinder_026_Material_005_0`. Matching
  the glTF name finds nothing and fails silently — the engine fans looked wired for weeks and had
  never once turned. `Aircraft.jsx` now normalises names before matching, and falls back to finding
  the fans by shape so a model swap does not break them again.
- **World matrices are stale on a freshly cloned scene.** `getWorldPosition` and
  `Box3.expandByObject` both return garbage until `updateMatrixWorld(true)` has run, which silently
  collapsed both engine fans onto one pivot in the middle of the fuselage.
- **`RoomEnvironment` is too expensive here.** It renders a whole box scene per generation and
  stalled first paint outright on software GL. The environment is a 64x32 procedural gradient
  instead, which is near-free and keeps the scene's own palette.
- Puppeteer's screenshot `clip` is in **page** coordinates, not viewport — clipping at `y: 0` after
  scrolling captures the top of the document, not what is on screen. Worth knowing if you script
  visual checks.
- **The aircraft is white, so the green must stay a rim light only.** Raising the rim's intensity or
  the ambient's saturation tints the whole fuselage green — it has happened twice.
- `gsap.context(fn, root)` scopes selector strings to `root`. The wordmark lives *outside* `.story`,
  so it is animated from a resolved element reference, not a selector — a scoped selector silently
  matches nothing and the tween appears to do nothing at all.
- **Reveal masks crop descenders.** `.mask` and `.word` use `overflow: hidden` to make the line
  reveal work, which cut the tails off the italic serif ("our priority"). They carry a
  `padding-bottom` with an equal negative `margin-bottom`: the tails get room, the layout box is
  unchanged. Any new masked display type needs the same treatment.
- **A 777-300ER is 74 m long**, so a true side elevation is a thin sliver that wastes the frame.
  Every beat is turned at least slightly off pure profile.

## Editing content

The office edits the site at **`/admin`** — contact details, the hero lines, destinations (with
photos), the service lines, extra services, process steps, the arrivals board, the spec readouts,
the study offer, the legal notice and open roles. See **Admin and email** below.

[src/data/site.js](src/data/site.js) holds the built-in defaults: what the site shows with no admin
behind it (a static preview), and the starting content the admin is loaded with on install
(`npm run seed:export` → `php-api/api/seed-data.json`). On each page load the saved content is
fetched and written into those same exports *before* the page mounts (`applyContent`), so the
animations only ever measure one settled version. A list that is empty or wholly hidden in the
admin falls back to its default.

The client's service catalogue is the source of truth for services, destinations, process and
contact details. The PDF itself is served at `/skyline-service-catalogue.pdf` and linked from the
catalogue section and the footer; replace that file when they issue a new edition.

## Admin and email

Built after the rtgeth project's CMS, which runs on cPanel shared hosting: a dependency-free PHP API
([php-api/api](php-api/api)) and MySQL beside the static site, and a React admin at `/admin`
([src/admin](src/admin)) loaded as its own chunk, so none of the site's 3D or scroll code comes with it.
Deployment to Yegara and the email DNS setup: **[docs/deploy-yegara.md](docs/deploy-yegara.md)**.

- **Content:** one schema list ([src/admin/schemas.js](src/admin/schemas.js)) drives the sidebar, the
  forms and the API. Singletons are JSON documents (`content`); every list is rows in one `items`
  table, so a new section needs no migration.
- **Forms:** a visa enquiry (Contact), a study application (Study) and a job application with a CV
  (Careers) post to `/api/submit`. Each is stored first, then the office is emailed (Reply-To the
  sender, CV attached) and the sender gets a confirmation. Staff answer from *Form submissions*.
  Honeypot plus a per-IP rate limit; no captcha.
- **Mail:** Resend, then the office's cPanel mailbox over SMTP, then PHP `mail()`; every attempt is in
  the *Email log*. The *Mailbox* receives through Resend's inbound webhook and replies in-thread.
- **Staff:** administrators and editors (editors cannot manage the team). No password is ever emailed —
  invitations and resets are one-time links. Disabling someone takes effect on their next request.
- **Differences from rtgeth, on purpose:** the Resend webhook refuses unsigned posts; no SVG uploads
  (an SVG can carry script, and the admin's session sits in the same origin); CVs and mail
  attachments live outside the web root and are served only to signed-in staff.
- **Tests:** `docker/` runs PHP 8.3 + Apache, MySQL and Mailpit locally (`npm run api:up`).

## Before this goes live

**Resolved by the client's service catalogue (received 2026-09-10):** the phone numbers, the office
address, and which tagline is current — it is "You Belong Everywhere", now used site-wide. "Your
Journey, Our Priority" from the earlier flyers is retired. Japan and France were flyer desks the
catalogue does not list, so they are gone.

Still open:

1. **Study section.** It presents Post University in Connecticut with a Fall 2026 intake. The
   catalogue's study destinations are Italy, Austria, Hungary and China; the USA appears only as a
   visit destination. Confirm the partnership is still live, and note that Fall 2026 is now current.
2. **Hungary** is a study destination in the catalogue but was not in the destinations list sent with
   it. It appears in the catalogue section only, not in the destination gallery or route list.
3. **Processing times** (45 days for Turkey and Italy work visas, 60 days for Schengen visits) and the
   no-prepayment terms come from the flyers. The catalogue gives neither — confirm they still hold.
4. **Email spelling.** The flyers show both `managmentskyline@gmail.com` and
   `managementskyline@gmail.com`. The catalogue lists no email at all, so it now appears only on the
   Careers section, as the CV inbox.
5. **Office hours** are a placeholder — confirm them with the office, who can now set them in the
   admin (Contact & brand).
6. **The `500+` stat** is derived from the flyer's "hundreds of successful visas". Confirm or replace.
7. **Destination photography** is hot-linked Unsplash imagery (Armenia is from Pexels, because none of
   the Unsplash candidates actually showed Armenia). Replace with owned or licensed photography
   before launch. Captions name where each photo was taken — Ireland is Cobh, Brazil is Rio — while
   the route badge is the country's gateway airport. Photos are requested at the width they are
   shown via `srcset` (`photoSrcSet` in `site.js`) — about 25–45 KB each rather than the 200–400 KB
   of a fixed 1400px original, which on slow connections left later postcards blank.
8. **Insurance.** The additional-services list carried both "Travel insurance" and "Insurance"; only
   the first is shown. If the second meant something different, add it to `EXTRA_SERVICES`.
9. The flyers' "100% success rate" claim is deliberately **not** repeated. The catalogue's own
   notice — shown in the catalogue section and the footer — says outcomes cannot be guaranteed.
10. **The logo is a trace** from a low-resolution raster, not the original artwork. Ask the client's
    designer for the source vector.
