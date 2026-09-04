import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BRAND } from '../data/site'
import LogoMark from './LogoMark'

const WORDS = ['Türkiye', 'Italia', 'Nippon', 'France', 'Österreich', 'America', 'Skyline']

export default function Preloader({ onDone }) {
  const root = useRef(null)
  const barRef = useRef(null)
  const wordsRef = useRef(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const counter = { v: 0 }
      const words = wordsRef.current.children
      const lineH = wordsRef.current.getBoundingClientRect().height

      gsap.set(words, { yPercent: 100 })
      gsap.set(words[0], { yPercent: 0 })

      const tl = gsap.timeline({
        onComplete: () => onDone?.(),
      })

      tl.to(counter, {
        v: 100,
        duration: 2.4,
        ease: 'power2.inOut',
        onUpdate: () => setCount(Math.round(counter.v)),
      })
        .to(barRef.current, { width: '100%', duration: 2.4, ease: 'power2.inOut' }, 0)

      // cycle the destination words alongside the counter
      WORDS.forEach((_, i) => {
        if (i === 0) return
        const at = (i / WORDS.length) * 2.2
        tl.to(words[i - 1], { yPercent: -100, duration: 0.5, ease: 'power3.inOut' }, at)
        tl.fromTo(
          words[i],
          { yPercent: 100 },
          { yPercent: 0, duration: 0.5, ease: 'power3.inOut' },
          at
        )
      })

      // exit — content lifts, then the panel wipes away
      tl.to(
        ['.preloader__top', '.preloader__mid', '.preloader__bottom', '.preloader__bar'],
        { yPercent: -25, opacity: 0, duration: 0.7, ease: 'power3.inOut', stagger: 0.04 },
        '+=0.25'
      ).to(
        root.current,
        {
          clipPath: 'inset(0% 0% 100% 0%)',
          duration: 1.1,
          ease: 'expo.inOut',
        },
        '-=0.35'
      )

      void lineH
    }, root)

    return () => ctx.revert()
  }, [onDone])

  return (
    <div className="preloader" ref={root} style={{ clipPath: 'inset(0% 0% 0% 0%)' }}>
      <div className="preloader__top">
        <span className="preloader__brand">
          <LogoMark className="preloader__mark" aria-hidden="true" title="" />
          <span className="label">{BRAND.name}</span>
        </span>
        <span className="label">
          {BRAND.city} — {BRAND.country}
        </span>
      </div>

      <div className="preloader__mid">
        <div className="preloader__words" ref={wordsRef}>
          {WORDS.map((w) => (
            <span className="preloader__word" key={w}>
              {w}
            </span>
          ))}
        </div>
      </div>

      <div className="preloader__bottom">
        <span className="label" style={{ maxWidth: '26ch' }}>
          Preparing your file — visa consultancy, study placement and ticketing
        </span>
        <div className="preloader__count">
          {String(count).padStart(3, '0')}
          <span style={{ fontSize: '0.28em', verticalAlign: 'super', opacity: 0.5 }}>%</span>
        </div>
      </div>

      <div className="preloader__bar">
        <span ref={barRef} />
      </div>
    </div>
  )
}
