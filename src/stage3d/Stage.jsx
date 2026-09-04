import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Aircraft from './Aircraft.jsx'
import { stage, sampleBeats } from './choreography.js'

/* ------------------------------------------------------------------
   Environment — a dark studio with a horizon glow, so the aircraft
   reads as a lit product rather than a floating object
   ------------------------------------------------------------------ */

function Stars({ count = 500 }) {
  const geo = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // far enough out that the portrait camera pull-back never enters the shell
      const r = 55 + Math.random() * 45
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [count])

  const ref = useRef(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.008
  })

  return (
    <points ref={ref} geometry={geo}>
      {/* sizeAttenuation off: stars stay a constant pixel size whatever the
          camera distance, which varies hugely between desktop and portrait */}
      <pointsMaterial
        size={1.7}
        color="#ece6d7"
        transparent
        opacity={0.5}
        sizeAttenuation={false}
        depthWrite={false}
      />
    </points>
  )
}

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
      fans.current[i].rotation.x += delta * 9
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

function Lights() {
  return (
    <>
      {/* The aircraft is white, so the green must stay a rim only. Earlier
          values tinted the whole fuselage green. Keep the key dominant and
          well ahead of the rim, and keep ambient close to neutral. */}
      <ambientLight intensity={0.26} color="#2f3a38" />
      {/* key: high and camera-left, raking along the fuselage */}
      <directionalLight position={[-6, 5, 4]} intensity={3.6} color="#fff8ec" />
      {/* rim: behind and to the right, just enough to cut the silhouette out */}
      <directionalLight position={[7, 1.5, -6]} intensity={0.85} color="#cdeadb" />
      {/* warm bounce so the underside and gear are not dead black */}
      <directionalLight position={[1, -5, 2]} intensity={0.55} color="#c9a24b" />
      <hemisphereLight args={['#3d4744', '#0a1610', 0.26]} />
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

  return (
    <div className="stage" aria-hidden="true" ref={shell}>
      <GLBoundary>
        <Canvas
          dpr={[1, typeof window !== 'undefined' && window.innerWidth < 860 ? 1.5 : 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0.35, 7.4], fov: 40 }}
          style={{ pointerEvents: 'none' }}
        >
          <Lights />
          <Stars />
          <Rig onReady={() => setReady(true)} />
        </Canvas>
      </GLBoundary>
    </div>
  )
}
