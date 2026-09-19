import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Aircraft from './Aircraft.jsx'
import { stage, sampleBeats } from './choreography.js'

/* ------------------------------------------------------------------
   Rig — reads scroll progress and eases the camera and model toward
   the sampled beat. The easing is what keeps fast scrolling smooth.
   ------------------------------------------------------------------ */

const REF_ASPECT = 1.9 // the aspect the beats in choreography.js are authored for

function Rig({ onReady }) {
  const model = useRef(null)
  const fans = useRef([])
  const liftRef = useRef(0)
  const { camera, size } = useThree()

  const current = useMemo(
    () => ({
      rot: new THREE.Vector3(0.04, -Math.PI / 2, 0),
      pos: new THREE.Vector3(0, 0.62, 0),
      cam: new THREE.Vector3(0, 0.32, 7.0),
      fov: 38,
      scale: 1.9,
    }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // engine fans, always turning
    for (let i = 0; i < fans.current.length; i++) {
      fans.current[i].rotation.x += delta * 11
    }

    const beat = sampleBeats(stage.progress)
    // frame-rate independent damping
    const k = 1 - Math.pow(0.0015, delta)

    current.rot.x += (beat.rot[0] - current.rot.x) * k
    current.rot.y += (beat.rot[1] - current.rot.y) * k
    current.rot.z += (beat.rot[2] - current.rot.z) * k
    current.pos.x += (beat.pos[0] - current.pos.x) * k
    current.pos.y += (beat.pos[1] - current.pos.y) * k
    current.pos.z += (beat.pos[2] - current.pos.z) * k
    current.cam.x += (beat.cam[0] - current.cam.x) * k
    current.cam.y += (beat.cam[1] - current.cam.y) * k
    current.cam.z += (beat.cam[2] - current.cam.z) * k
    current.fov += (beat.fov - current.fov) * k
    current.scale += (beat.scale - current.scale) * k

    const g = model.current
    if (g) {
      // A slow idle on top of the scroll choreography, so the aircraft is alive
      // even when the page is not being scrolled. The hero is a symmetrical
      // head-on shot, so the yaw and roll components are kept very small —
      // anything larger reads as a wobble and breaks the elevation.
      const swayY = Math.sin(t * 0.23) * 0.022
      const swayX = Math.sin(t * 0.31 + 1.2) * 0.012
      const bob = Math.sin(t * 0.42) * 0.032
      const roll = Math.sin(t * 0.19 + 0.6) * 0.012

      g.rotation.set(
        current.rot.x + swayX + stage.py * 0.02,
        current.rot.y + swayY + stage.px * 0.035,
        current.rot.z + roll
      )
      g.position.set(current.pos.x, current.pos.y + bob + liftRef.current, current.pos.z)
      g.scale.setScalar(current.scale)
    }

    /* Responsive framing.

       The beats are authored against a wide desktop frame. As the viewport
       narrows the horizontal field of view collapses, so a camera distance
       that frames the aircraft on desktop crops its wingtips on a phone.
       Pull the camera back in proportion to the lost horizontal angle, and
       on portrait lift the aircraft into the upper half so it never sits on
       top of the copy below it. */
    const aspect = size.width / Math.max(1, size.height)
    const camMult = aspect < REF_ASPECT ? Math.min(4.8, (REF_ASPECT / aspect) * 0.95) : 1
    const camZ = current.cam.z * camMult

    if (aspect < 1) {
      const visibleH = 2 * camZ * Math.tan((current.fov * Math.PI) / 360)
      liftRef.current += (visibleH * 0.17 - liftRef.current) * k
    } else {
      liftRef.current += (0 - liftRef.current) * k
    }

    camera.position.set(current.cam.x, current.cam.y, camZ)
    camera.lookAt(0, 0, 0)
    if (Math.abs(camera.fov - current.fov) > 0.01) {
      camera.fov = current.fov
      camera.updateProjectionMatrix()
    }
  })

  const handleModelReady = (pivots) => {
    fans.current = pivots || []
    onReady?.()
  }

  return (
    <group ref={model}>
      <Aircraft onReady={handleModelReady} />
    </group>
  )
}

/* ------------------------------------------------------------------
   Environment — a bright studio with a soft green floor, so a white
   aircraft on a white page still reads as a lit, solid object
   ------------------------------------------------------------------ */

/**
 * A generated image-based environment.
 *
 * Directional lights alone leave a metal airframe looking like flat plastic —
 * there is nothing for it to reflect. This is a tiny equirectangular gradient
 * (sky above, ground below, a warm band where the key light sits) pushed
 * through PMREM, which gives the fuselage soft, believable falloff across its
 * curvature.
 *
 * Deliberately NOT three's RoomEnvironment: that renders a whole box scene
 * per generation, which stalls first paint on software GL and low-end GPUs —
 * the machines much of this site's audience is on. A 64x32 gradient costs
 * almost nothing, and its darker green floor gives the white airframe the
 * shading it needs against a white page.
 */
function buildEnvTexture() {
  const W = 64
  const H = 32
  const data = new Uint8Array(W * H * 4)

  const sky = [0.9, 0.93, 0.91]
  const ground = [0.3, 0.38, 0.34]
  const key = [1.0, 0.99, 0.96]

  for (let y = 0; y < H; y++) {
    // 0 at the top of the sphere, 1 at the bottom
    const t = y / (H - 1)
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1)
      const mix = Math.pow(t, 0.8)
      let r = sky[0] * (1 - mix) + ground[0] * mix
      let g = sky[1] * (1 - mix) + ground[1] * mix
      let b = sky[2] * (1 - mix) + ground[2] * mix

      // a soft highlight where the key light comes from, so the fuselage
      // picks up a moving specular as it turns
      const dx = Math.min(Math.abs(u - 0.32), 1 - Math.abs(u - 0.32))
      const hot = Math.exp(-(dx * dx) / 0.006) * Math.exp(-((t - 0.3) ** 2) / 0.05)
      r += key[0] * hot * 1.5
      g += key[1] * hot * 1.5
      b += key[2] * hot * 1.5

      const i = (y * W + x) * 4
      data[i] = Math.min(255, r * 255)
      data[i + 1] = Math.min(255, g * 255)
      data[i + 2] = Math.min(255, b * 255)
      data[i + 3] = 255
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function StudioEnvironment({ intensity = 0.55 }) {
  const { gl, scene } = useThree()

  useEffect(() => {
    const src = buildEnvTexture()
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromEquirectangular(src)
    scene.environment = env.texture
    if ('environmentIntensity' in scene) scene.environmentIntensity = intensity

    return () => {
      scene.environment = null
      env.texture.dispose()
      pmrem.dispose()
      src.dispose()
    }
  }, [gl, scene, intensity])

  return null
}

function Lights() {
  return (
    <>
      {/* A white aircraft on a white page: the form has to come from shading,
          so the key rakes hard from above left and the floor stays green-grey,
          leaving the underside and the far side of the fuselage in soft shade. */}
      <ambientLight intensity={0.3} color="#eef4f0" />
      {/* key: high and camera-left, raking along the fuselage */}
      <directionalLight position={[-6, 5, 4]} intensity={2.8} color="#ffffff" />
      {/* rim: behind and to the right, a cool green edge */}
      <directionalLight position={[7, 1.5, -6]} intensity={0.6} color="#cfe9da" />
      <hemisphereLight args={['#ffffff', '#6f8a7c', 0.5]} />
      <StudioEnvironment intensity={0.75} />
    </>
  )
}

class GLBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function Stage() {
  const [, setReady] = useState(false)
  const [covered, setCovered] = useState(false)
  const shell = useRef(null)

  /* On a small screen the aircraft shares the middle of the viewport with the
     panel copy, and the two collide. Past the hero it steps back so the text
     stays readable; on desktop there is room for both, so it does not. */
  useEffect(() => {
    if (!window.matchMedia('(max-width: 860px)').matches) return
    const el = shell.current
    if (!el) return
    const onScroll = () => {
      el.classList.toggle('is-recessed', window.scrollY > window.innerHeight * 0.75)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      el.classList.remove('is-recessed')
    }
  }, [])

  /* Past the story the opaque ground covers the stage completely. Stop
     drawing a scene nobody can see. (+1: the end can never be reached, so
     the trigger never "leaves".) */
  useEffect(() => {
    const ground = document.querySelector('.ground')
    if (!ground) return
    const st = ScrollTrigger.create({
      trigger: ground,
      start: 'top top',
      end: () => ScrollTrigger.maxScroll(window) + 1,
      onToggle: (self) => setCovered(self.isActive),
    })
    return () => st.kill()
  }, [])

  return (
    <div className="stage" aria-hidden="true" ref={shell}>
      <GLBoundary>
        <Canvas
          frameloop={covered ? 'never' : 'always'}
          dpr={[1, typeof window !== 'undefined' && window.innerWidth < 860 ? 1.5 : 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0.35, 7.4], fov: 40 }}
          style={{ pointerEvents: 'none' }}
        >
          <Lights />
          <Rig onReady={() => setReady(true)} />
        </Canvas>
      </GLBoundary>
    </div>
  )
}
