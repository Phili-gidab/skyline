/**
 * Shared state for the pinned 3D stage.
 *
 * One aircraft lives in a single fixed canvas for the whole page. Scroll does
 * not trigger discrete animations; it scrubs a normalised progress value, and
 * the renderer interpolates the camera and model between choreographed beats.
 * That scrub is what makes the motion feel attached to the scroll rather than
 * fired by it.
 */

export const stage = {
  /** 0..1 across the whole scroll-driven story, written by ScrollTrigger. */
  progress: 0,
  /** Pointer in -1..1, for parallax. */
  px: 0,
  py: 0,
  /** Set once the model (or its fallback) is ready, so the page can reveal. */
  ready: false,
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'mousemove',
    (e) => {
      stage.px = (e.clientX / window.innerWidth) * 2 - 1
      stage.py = -((e.clientY / window.innerHeight) * 2 - 1)
    },
    { passive: true }
  )
}

/**
 * Choreography. Each beat pins the aircraft and camera for one narrative
 * section; `at` is that section's position along the story.
 *
 * rot — model rotation (radians).
 *
 *   The model's nose points along +X, so a `rot.y` of 0 is a pure side profile
 *   with the nose to the right. IMPORTANT: every beat's `rot.y` is kept inside
 *   a narrow band (about -0.2 to -1.5). Rotating past roughly -1.6 swings the
 *   nose away from the viewer, and past -3.0 the aircraft reads as flying
 *   tail-first — which is exactly what it did before. Vary `rot.x` for plan
 *   versus side views and `rot.z` for bank; do not use `rot.y` to spin it.
 *
 * pos — model position, used to slide it clear of whichever side the copy
 *       occupies, and to lift it above centred copy.
 * cam   — camera position. It always looks at the origin.
 * fov   — narrower reads as a longer lens: flatter, more product-like.
 * scale — per-beat size. The hero is deliberately much larger than the rest;
 *         scaling here rather than raising TARGET_LENGTH keeps every other
 *         beat's framing untouched.
 */
export const BEATS = [
  {
    id: 'hero',
    at: 0.0,
    // Dead-on front elevation, filling the frame: rot.y of exactly -PI/2
    // points the model's +X nose straight down +Z at the camera, and rot.z
    // of 0 keeps the wings level. The symmetry is the point here, so the
    // idle sway and pointer parallax are damped right down in Stage.jsx.
    rot: [0.04, -Math.PI / 2, 0],
    pos: [0, 0.62, 0],
    cam: [0, 0.32, 7.0],
    fov: 38,
    scale: 1.9,
  },
  {
    id: 'capabilities',
    scale: 1,
    at: 0.24,
    // front three-quarter, seen slightly from below so it looks airborne
    rot: [-0.07, -1.28, -0.06],
    pos: [-1.45, 0.05, 0.3],
    cam: [0, -0.15, 7.4],
    fov: 36,
  },
  {
    id: 'routes',
    scale: 1,
    at: 0.48,
    // plan view from above: rot.x does the work, not rot.y
    rot: [1.18, -0.78, 0.14],
    pos: [1.3, 0.05, 0],
    cam: [0, 0.4, 8.6],
    fov: 38,
  },
  {
    id: 'process',
    scale: 1,
    at: 0.72,
    // three-quarter from above and ahead. A true profile on an aircraft this
    // long reads as a sliver, so it is swung toward the camera for bulk.
    rot: [0.19, -0.86, 0.05],
    pos: [-1.2, -0.05, 0.5],
    cam: [0, 0.55, 7.6],
    fov: 36,
  },
  {
    id: 'numbers',
    scale: 1,
    at: 1.0,
    // small, high and well back: the statistics are centred, so the aircraft
    // has to clear them entirely rather than merely sit behind them
    rot: [0.5, -1.1, 0.22],
    pos: [0.5, 3.8, -5.2],
    cam: [0, 0.75, 11.5],
    fov: 42,
    scale: 0.86,
  },
]

const lerp = (a, b, t) => a + (b - a) * t
const lerp3 = (a, b, t, out) => {
  out[0] = lerp(a[0], b[0], t)
  out[1] = lerp(a[1], b[1], t)
  out[2] = lerp(a[2], b[2], t)
  return out
}

// smootherstep — eases each segment so beat boundaries are not corners
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10)

const _rot = [0, 0, 0]
const _pos = [0, 0, 0]
const _cam = [0, 0, 0]

/** Interpolate the choreography at a normalised progress. */
export function sampleBeats(p) {
  const clamped = Math.min(1, Math.max(0, p))

  let i = 0
  while (i < BEATS.length - 2 && clamped > BEATS[i + 1].at) i++

  const a = BEATS[i]
  const b = BEATS[i + 1] ?? a
  const span = b.at - a.at
  const local = span > 0 ? ease((clamped - a.at) / span) : 0

  return {
    rot: lerp3(a.rot, b.rot, local, _rot),
    pos: lerp3(a.pos, b.pos, local, _pos),
    cam: lerp3(a.cam, b.cam, local, _cam),
    fov: lerp(a.fov, b.fov, local),
    scale: lerp(a.scale ?? 1, b.scale ?? 1, local),
  }
}
