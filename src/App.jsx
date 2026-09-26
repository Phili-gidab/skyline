import React, { useEffect } from 'react'
import { useSmoothScroll, gsap, ScrollTrigger } from './lib/smooth'

import Bar from './components/Bar'
import Intro from './components/Intro'
import Stage from './components/Stage'
import Record from './components/Record'
import Services from './components/Services'
import Process from './components/Process'
import StudyOffer from './components/StudyOffer'
import Careers from './components/Careers'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  useSmoothScroll(true)

  // fonts and photographs change the measurements the stage is pinned against
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh()
    document.fonts?.ready.then(refresh)
    window.addEventListener('load', refresh)
    const t = setTimeout(refresh, 900)
    return () => {
      window.removeEventListener('load', refresh)
      clearTimeout(t)
    }
  }, [])

  return (
    <>
      <Bar />

      <main>
        <Intro />
        <Stage />
        <Record />
        <Services />
        <Process />
        <StudyOffer />
        <Careers />
        <Contact />
      </main>

      <Footer />
    </>
  )
}

if (typeof window !== 'undefined') {
  window.gsap = gsap
  window.ScrollTrigger = ScrollTrigger
}
