import React, { useEffect } from 'react'

import Header from './components/site/Header'
import Hero, { Stats } from './components/site/Hero'
import Ribbon from './components/site/Ribbon'
import Services from './components/site/Services'
import Destinations from './components/site/Destinations'
import Process from './components/site/Process'
import Apply from './components/site/Apply'
import Why from './components/site/Why'
import Study from './components/site/Study'
import Jobs from './components/site/Jobs'
import Contact from './components/site/Contact'
import Footer from './components/site/Footer'
import CallBar from './components/site/CallBar'

export default function App() {
  // a gentle fade as sections arrive; nothing else moves
  useEffect(() => {
    const items = document.querySelectorAll(
      '.section .card, .section .step, .section .dest, .section .why__item, .section__head--center'
    )
    items.forEach((el) => { if (!el.classList.contains('section__head--center')) el.classList.add('reveal') })
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Ribbon />
        <Services />
        <Destinations />
        <Process />
        <Apply />
        <Why />
        <Study />
        <Jobs />
        <Contact />
      </main>
      <Footer />
      <CallBar />
    </>
  )
}
