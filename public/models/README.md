# Aircraft model

`aircraft.glb` here is the **optimised, shippable** model. Do not edit it by hand — it is generated.

The site loads `/models/aircraft.glb` automatically. It is normalised on load — centred on its own
bounding box, scaled so its longest axis matches `TARGET_LENGTH`, and rotated so the nose points
along +X — so the scroll choreography keeps working whatever model you supply. If the file is
absent, a procedural placeholder aircraft is used instead.

## Replacing it

1. Put the source `.glb` at `model-source/aircraft-source.glb` (that folder is gitignored; use the
   .glb export, not .obj/.gltf/.fbx).
2. Run `npm run model:optimize`.
3. Check the result with `npm run model:inspect`, and look at the hero in a browser.
4. If it loads facing the wrong way, set `MODEL_ROTATION_OFFSET` in `src/stage3d/Aircraft.jsx`.

## Current model and licence

Boeing 777-300ER Model by **hakai315**, via Sketchfab.
https://sketchfab.com/3d-models/boeing-777-300er-model

Licensed **CC BY 4.0**: commercial use is permitted, but the licence requires that the author be
credited.

**That credit is deliberately not rendered on the site.** The client has chosen to attribute on
social media instead. Nothing in the code enforces the obligation, so it is recorded here: if this
project changes hands, or the social-media credit lapses, the attribution requirement still applies
and the usual remedy is a line in the site footer or an about/colophon page.

Source was 68.26 MB / 2.2M triangles; optimised to 628 KB / 106k vertices.
