import React, { useEffect } from 'react'
import { useSmoothScroll, gsap, ScrollTrigger } from './lib/smooth'

import Nav from './components/Nav'
import Masthead from './components/Masthead'
import Atlas from './components/Atlas'
import Record from './components/Record'
import Services from './components/Services'
import Process from './components/Process'
import StudyOffer from './components/StudyOffer'
import Careers from './components/Careers'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  useSmoothScroll(true)

  // fonts and lazy photographs change section heights; the triggers follow
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh()
    document.fonts?.ready.then(refresh)
    window.addEventListener('load', refresh)
    const t = setTimeout(refresh, 800)
    return () => {
      window.removeEventListener('load', refresh)
      clearTimeout(t)
    }
  }, [])

  return (
    <>
      <Nav ready />

      <main>
        <Masthead />
        <Atlas />
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
