import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useSmoothScroll, gsap, ScrollTrigger } from './lib/smooth'

import Preloader from './components/Preloader'
import Cursor from './components/Cursor'
import Nav from './components/Nav'
import Story from './components/Story'
import Destinations from './components/Destinations'
import Catalogue from './components/Catalogue'
import Study from './components/Study'
import Careers from './components/Careers'
import Contact from './components/Contact'
import Footer from './components/Footer'

// the 3D stage is code-split so three never blocks first paint
const Stage = lazy(() => import('./stage3d/Stage.jsx'))

export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [showPreloader, setShowPreloader] = useState(true)
  const progressRef = useRef(null)

  useSmoothScroll(loaded)

  useEffect(() => {
    document.body.classList.toggle('is-locked', !loaded)
  }, [loaded])

  const handleLoaded = useCallback(() => {
    setLoaded(true)
    requestAnimationFrame(() => {
      ScrollTrigger.refresh()
      setTimeout(() => setShowPreloader(false), 300)
    })
  }, [])

  // reading-progress bar
  useEffect(() => {
    if (!loaded) return
    const el = progressRef.current
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? (window.scrollY / max) * 100 : 0
      if (el) el.style.width = `${p}%`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [loaded])

  // keep triggers honest when fonts and lazy images land
  useEffect(() => {
    if (!loaded) return
    const refresh = () => ScrollTrigger.refresh()
    if (document.fonts?.ready) document.fonts.ready.then(refresh)
    window.addEventListener('load', refresh)
    const t = setTimeout(refresh, 900)
    return () => {
      window.removeEventListener('load', refresh)
      clearTimeout(t)
    }
  }, [loaded])

  return (
    <>
      {showPreloader && <Preloader onDone={handleLoaded} />}

      <div className="progress" ref={progressRef} />
      <Cursor />
      <Nav ready={loaded} />

      {/* Layers behind the transparent 3D canvas. The wordmark sits between
          the sky and the aircraft, so the aircraft occludes it. */}
      <div className="stage-sky" aria-hidden="true" />
      <div className="stage-wordmark" aria-hidden="true">
        <span>Skyline</span>
      </div>

      <Suspense fallback={null}>
        <Stage />
      </Suspense>

      <main>
        <Story ready={loaded} />

        {/* content sections sit on an opaque ground, covering the stage */}
        <div className="ground">
          <Destinations />
          <Catalogue />
          <Study />
          <Careers />
          <Contact />
        </div>
      </main>

      <Footer />

      <div className="scanlines" />
      <div className="grain" />
    </>
  )
}

if (typeof window !== 'undefined') {
  window.gsap = gsap
  window.ScrollTrigger = ScrollTrigger
}
