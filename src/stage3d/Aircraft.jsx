import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/**
 * The aircraft is deliberately model-agnostic.
 *
 * Drop any .glb at `public/models/aircraft.glb` and it is used automatically:
 * it gets normalised to a consistent size and centred on its own bounding box,
 * so the choreography in stage.js keeps working whatever model you supply.
 *
 * Until a model is present, a procedural airliner stands in so the page is
 * reviewable. That fallback is a placeholder, not the intended finish — see
 * "The aircraft model" in the README.
 */

export const MODEL_URL = '/models/aircraft.glb'

/**
 * The white spiral painted on a real engine's spinner cone.
 *
 * It exists on actual aircraft for exactly the reason it is needed here: a
 * fan disc is rotationally symmetric, so spinning it reads as static. The
 * spiral is the asymmetry that makes rotation legible.
 */
function makeSpinnerTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const r = S / 2

  // dark cone, so the mark reads against a pale nacelle
  ctx.fillStyle = '#13181a'
  ctx.beginPath()
  ctx.arc(r, r, r - 2, 0, Math.PI * 2)
  ctx.fill()

  // Archimedean spiral, thickening outward the way a painted one does
  ctx.strokeStyle = '#f3efe4'
  ctx.lineCap = 'round'
  const TURNS = 1.35
  const steps = 220
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps
    const t1 = (i + 1) / steps
    const a0 = t0 * Math.PI * 2 * TURNS
    const a1 = t1 * Math.PI * 2 * TURNS
    const r0 = t0 * (r - 12)
    const r1 = t1 * (r - 12)
    ctx.lineWidth = 3 + t0 * 15
    ctx.beginPath()
    ctx.moveTo(r + Math.cos(a0) * r0, r + Math.sin(a0) * r0)
    ctx.lineTo(r + Math.cos(a1) * r1, r + Math.sin(a1) * r1)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Target length in world units, so any model reads at the same scale. */
const TARGET_LENGTH = 4.6

/**
 * Extra rotation applied after auto-orientation, in radians [x, y, z].
 *
 * The loader guesses the nose axis from the bounding box, which is right for
 * most aircraft. If the model still loads facing the wrong way, nudge it here
 * rather than editing the choreography — for a 180 degree flip use
 * [0, Math.PI, 0]; if it loads belly-up use [Math.PI, 0, 0].
 */
const MODEL_ROTATION_OFFSET = [0, Math.PI, 0]

/* ------------------------------------------------------------------
   Loaded model
   ------------------------------------------------------------------ */

function GltfAircraft({ onReady }) {
  // the optimised model is meshopt-compressed; the decoder ships with three
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
  })

  const spinnerTexture = useMemo(() => makeSpinnerTexture(), [])

  const prepared = useMemo(() => {
    const root = gltf.scene.clone(true)

    /* Engine fans.

       Two things make this fiddly:

       1. three's GLTFLoader runs node names through
          PropertyBinding.sanitizeNodeName, which replaces dots with
          underscores. The glTF says "Cylinder.026_Material.005_0"; the
          Object3D is called "Cylinder_026_Material_005_0". Matching the
          glTF name silently finds nothing, which is exactly what happened.
       2. World matrices are stale on a freshly cloned scene, so
          getWorldPosition and expandByObject must not be trusted until
          updateMatrixWorld has run.

       Names are matched loosely, and if that finds nothing the fans are
       located by shape instead — a fan is a thin, round disc sitting well
       off the centreline. That keeps this working if the model is swapped. */
    root.updateMatrixWorld(true)

    const norm = (n) => (n || '').replace(/[^A-Za-z0-9]/g, '_')
    const FAN_PREFIXES = ['Cylinder_026', 'Cylinder_025', 'Cylinder_029', 'Cylinder_028']

    const meshes = []
    root.traverse((o) => {
      if (o.isMesh) meshes.push(o)
    })

    let fanMeshes = meshes.filter((m) => FAN_PREFIXES.some((p) => norm(m.name).startsWith(p)))

    if (!fanMeshes.length) {
      const rootBox = new THREE.Box3().setFromObject(root)
      const rootSize = rootBox.getSize(new THREE.Vector3())
      const rootMid = rootBox.getCenter(new THREE.Vector3())
      const longest = Math.max(rootSize.x, rootSize.y, rootSize.z)
      const b = new THREE.Box3()
      const sz = new THREE.Vector3()
      const mid = new THREE.Vector3()

      const discs = meshes.filter((m) => {
        b.setFromObject(m)
        b.getSize(sz)
        b.getCenter(mid)
        const face = Math.max(sz.y, sz.z)
        const round = Math.min(sz.y, sz.z) / (face || 1)
        return (
          sz.x < face * 0.5 &&
          round > 0.7 &&
          face > longest * 0.02 &&
          face < longest * 0.12 &&
          Math.abs(mid.z - rootMid.z) > rootSize.z * 0.12
        )
      })

      // pull in whatever shares each disc's centre, so the spinner cone
      // spins with its own blades
      fanMeshes = meshes.filter((m) => {
        b.setFromObject(m)
        b.getCenter(mid)
        return discs.some((d) => {
          const db = new THREE.Box3().setFromObject(d)
          const dc = db.getCenter(new THREE.Vector3())
          const dr = Math.max(db.max.y - db.min.y, db.max.z - db.min.z) / 2
          return mid.distanceTo(dc) < dr * 0.6
        })
      })
    }

    const pivots = []
    const bySide = { port: [], star: [] }
    const wp = new THREE.Vector3()
    fanMeshes.forEach((m) => {
      m.getWorldPosition(wp)
      ;(wp.z < 0 ? bySide.port : bySide.star).push(m)
    })

    Object.values(bySide).forEach((group) => {
      if (!group.length) return

      const box = new THREE.Box3()
      group.forEach((m) => box.expandByObject(m))
      const centre = box.getCenter(new THREE.Vector3())

      const pivot = new THREE.Group()
      pivot.position.copy(centre)
      root.add(pivot)
      pivot.updateMatrixWorld(true)

      // attach() re-parents while preserving the world transform
      group.forEach((m) => pivot.attach(m))

      /* The spinner spiral.

         The tail fin sits at +X on this model (which is why
         MODEL_ROTATION_OFFSET flips it), so the intake faces -X. The disc is
         parked clear of the fan group's own forward face rather than at a
         guessed offset, with enough standoff not to z-fight the spinner. */
      const radius = Math.max(box.max.y - box.min.y, box.max.z - box.min.z) / 2
      const halfDepth = (box.max.x - box.min.x) / 2

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.3, 48),
        new THREE.MeshBasicMaterial({
          map: spinnerTexture,
          toneMapped: false, // legible whatever the key light is doing
          side: THREE.DoubleSide,
        })
      )
      disc.rotation.y = -Math.PI / 2 // the +Z face onto -X
      disc.position.set(-halfDepth - radius * 0.12, 0, 0)
      pivot.add(disc)

      pivots.push(pivot)
    })

    // normalise: centre on the bounding box, scale longest axis to TARGET_LENGTH
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z) || 1

    root.position.sub(centre)

    // A supplied model may point down any axis. The fuselage is by far the
    // longest dimension, so treat the longest horizontal axis as the nose and
    // rotate it onto +X, which is what the choreography expects.
    if (size.z > size.x) root.rotation.y = -Math.PI / 2

    const wrapper = new THREE.Group()
    wrapper.add(root)
    wrapper.scale.setScalar(TARGET_LENGTH / longest)
    wrapper.rotation.set(...MODEL_ROTATION_OFFSET)

    wrapper.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false
        o.receiveShadow = false
        if (o.material) o.material.envMapIntensity = 1.1
      }
    })

    return { wrapper, pivots }
  }, [gltf, spinnerTexture])

  useEffect(() => {
    onReady?.(prepared.pivots)
  }, [onReady, prepared])

  return <primitive object={prepared.wrapper} />
}

/* ------------------------------------------------------------------
   Procedural stand-in
   ------------------------------------------------------------------ */

function makeWing({ rootChord, tipChord, span, sweep, thickness }) {
  const shape = new THREE.Shape()
  shape.moveTo(rootChord / 2, 0)
  shape.lineTo(rootChord / 2 - sweep, span)
  shape.lineTo(rootChord / 2 - sweep - tipChord, span)
  shape.lineTo(-rootChord / 2, 0)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geo.translate(0, 0, -thickness / 2)
  geo.rotateX(-Math.PI / 2)
  return geo
}

function makeFin({ rootChord, tipChord, height, sweep, thickness }) {
  const shape = new THREE.Shape()
  shape.moveTo(rootChord / 2, 0)
  shape.lineTo(rootChord / 2 - sweep, height)
  shape.lineTo(rootChord / 2 - sweep - tipChord, height)
  shape.lineTo(-rootChord / 2, 0)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geo.translate(0, 0, -thickness / 2)
  return geo
}

const DIHEDRAL = 0.09

function FallbackAircraft({ onReady }) {
  const parts = useMemo(() => {
    const fuselage = new THREE.CylinderGeometry(0.11, 0.2, 3.5, 36, 1, true)
    fuselage.rotateZ(Math.PI / 2)

    const nose = new THREE.SphereGeometry(0.2, 32, 24)
    nose.scale(1.8, 1, 1)
    nose.translate(1.72, 0, 0)

    const tailCone = new THREE.ConeGeometry(0.11, 0.62, 24)
    tailCone.rotateZ(-Math.PI / 2)
    tailCone.translate(-2.05, 0.1, 0)

    const wing = makeWing({ rootChord: 1.2, tipChord: 0.32, span: 1.8, sweep: 0.88, thickness: 0.05 })
    wing.translate(-0.05, -0.07, 0)

    const stab = makeWing({ rootChord: 0.5, tipChord: 0.18, span: 0.72, sweep: 0.34, thickness: 0.035 })
    stab.translate(-1.7, 0.04, 0)

    const fin = makeFin({ rootChord: 0.78, tipChord: 0.28, height: 0.85, sweep: 0.58, thickness: 0.04 })
    fin.translate(-1.6, 0.11, 0)

    const nacelle = new THREE.CylinderGeometry(0.15, 0.13, 0.7, 24, 1, true)
    nacelle.rotateZ(Math.PI / 2)

    const intake = new THREE.RingGeometry(0.085, 0.15, 24)
    intake.rotateY(Math.PI / 2)
    intake.translate(0.35, 0, 0)

    const pylon = new THREE.BoxGeometry(0.38, 0.24, 0.045)
    pylon.translate(-0.08, 0.19, 0)

    return { fuselage, nose, tailCone, wing, stab, fin, nacelle, intake, pylon }
  }, [])

  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e6e0d2',
        metalness: 0.55,
        roughness: 0.34,
        side: THREE.DoubleSide,
      }),
    []
  )

  const dark = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0c1c14', metalness: 0.6, roughness: 0.3 }),
    []
  )

  useEffect(() => {
    onReady?.([])
  }, [onReady])

  return (
    <group>
      <mesh geometry={parts.fuselage} material={body} />
      <mesh geometry={parts.nose} material={body} />
      <mesh geometry={parts.tailCone} material={body} />
      <mesh geometry={parts.fin} material={body} />

      <group rotation={[DIHEDRAL, 0, 0]}>
        <mesh geometry={parts.wing} material={body} />
      </group>
      <group rotation={[-DIHEDRAL, 0, 0]} scale={[1, 1, -1]}>
        <mesh geometry={parts.wing} material={body} />
      </group>

      <group rotation={[DIHEDRAL * 0.6, 0, 0]}>
        <mesh geometry={parts.stab} material={body} />
      </group>
      <group rotation={[-DIHEDRAL * 0.6, 0, 0]} scale={[1, 1, -1]}>
        <mesh geometry={parts.stab} material={body} />
      </group>

      {[-0.82, 0.82].map((z, i) => (
        <group key={i} position={[0.3, -0.26, z]}>
          <mesh geometry={parts.nacelle} material={body} />
          <mesh geometry={parts.intake} material={dark} />
          <mesh geometry={parts.pylon} material={body} />
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------
   Public component — uses the supplied model when one exists
   ------------------------------------------------------------------ */

class ModelBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail?.()
  }
  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

export default function Aircraft({ onReady }) {
  // `null` = still checking, true/false = model present or not
  const [hasModel, setHasModel] = useState(null)

  useEffect(() => {
    let cancelled = false
    // A ranged 1-byte GET rather than HEAD: some static hosts reject HEAD,
    // and Vite's dev server aborts it, which would wrongly report "no model".
    fetch(MODEL_URL, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
      .then((res) => {
        const type = res.headers.get('content-type') || ''
        // a dev server may answer 200 with index.html for a missing file
        const real = res.status !== 404 && !type.includes('text/html')
        if (!cancelled) setHasModel(real)
      })
      .catch(() => {
        if (!cancelled) setHasModel(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fallback = <FallbackAircraft onReady={onReady} />

  if (hasModel === null) return null
  if (!hasModel) return fallback

  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <GltfAircraft onReady={onReady} />
      </Suspense>
    </ModelBoundary>
  )
}
