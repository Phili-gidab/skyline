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
| `logo-lockup.svg` | mark + wordmark + TRAVEL SOLUTION, dark grounds — paired with live tagline |
| `logo-lockup-color.svg` | same, original brand colour, for light grounds |
| `logo-compact.svg` | mark + wordmark only — the nav, where a tagline is unreadable |
| `logo.svg` / `logo-color.svg` | full lockup including the traced tagline, if ever needed flat |
| `favicon.svg` | the mark alone; anything with type is illegible at 32px |

Brand greens sampled from the source: **`#0e8f47`** dark, **`#23ad68`** light, lifted to `#25b06b` /
`#3ecb84` on the dark ground. Raster originals live in `brand-source/`, deliberately outside
`public/` so 630 KB of source never ships.

If the client can get the original vector (AI/EPS/PDF) from whoever designed the logo, that is still
better than any trace — particularly for the tagline.

## Design system

All tokens live at the top of [src/styles/global.css](src/styles/global.css).

- **Ground** `--ink #06130d`, `--ink-2`, `--forest` — a near-black green rather than pure black
- **Paper** `--bone`, `--bone-2` — warm off-white, used inverted for the Study section
- **Accents** `--gold #c9a24b` for editorial highlights, `--signal #57e39a` for live/3D elements
- Type pairing: an uppercase display serif against a tight grotesk, with mono for all labels
- The giant hero wordmark is **Archivo at width 125** — a hairline serif goes spindly at 21vw and
  reads as noise rather than mass

Film grain, a vignette and a difference-blend cursor sit above everything as fixed overlays.

## Section map

**Over the 3D stage:**

| Panel | Content |
| --- | --- |
| 01 Hero | Wordmark, standfirst, live Addis clock, split-flap departure board |
| 02 Capabilities | Turnaround times as spec readouts |
| 03 Routes | Six desks as an IATA route list |
| 04 Process | Four stages |
| 05 Numbers | Headline statistics |

**On the ground, below:** Destinations (pinned horizontal gallery), Services, Study (inverted cream
section with the Post University tables), Careers, Contact, Footer.

The split-flap board ([SplitFlap.jsx](src/components/SplitFlap.jsx)) is a Solari display: each cell
riffles the charset and settles left to right.

## Gotchas worth knowing

- **Never name a source directory after a package.** `src/three/` made Vite resolve
  `import('./three/Stage')` to `three/stage.js` — Windows is case-insensitive and Vite tries `.js`
  before `.jsx` — so three.js silently vanished from the bundle with no error. Hence `src/stage3d/`
  and `choreography.js`.
- Additive blending in the 3D scene is kept very low-alpha, and any `gl_PointSize` is attenuated to
  roughly two device pixels. Raising either turns the scene into a glowing blob.
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

Nearly all copy lives in [src/data/site.js](src/data/site.js) — contact details, destinations with
IATA codes, services, process steps, stats, scholarship tables and open roles.

## Before this goes live

Items taken from the flyers that need the client to confirm them:

1. **Email spelling.** The flyers show both `managmentskyline@gmail.com` and
   `managementskyline@gmail.com`. The site currently uses `managmentskyline@gmail.com`.
2. **Phone numbers.** The hiring flyer lists `+251 986 975 570` / `+251 988 866 060`, which differ
   from the numbers on the visa flyers. Only the visa-flyer numbers are on the site.
3. **Office hours** are a placeholder — see the `TODO` in
   [src/components/Contact.jsx](src/components/Contact.jsx).
4. **The `500+` stat** is derived from the flyer's "hundreds of successful visas". Confirm or replace.
5. **Destination photography** is placeholder Unsplash imagery, hot-linked. Replace with licensed or
   owned photography before launch; cards fall back to a gradient if an image fails to load.
6. The flyers' "100% success rate" claim is deliberately **not** repeated on the site — it is the kind
   of guarantee that invites consumer-protection trouble. "High success rate" is used instead.
7. **Model attribution.** The aircraft is CC BY 4.0, which requires crediting the author. The
   client has opted to do this on social media rather than on the site. If that ever lapses, the
   simplest fix is a credit line in the footer or an about/colophon page.
