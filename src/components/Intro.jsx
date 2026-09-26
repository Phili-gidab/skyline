import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BRAND, DESTINATIONS, HERO } from '../data/site'
import { scrollTo } from '../lib/smooth'

/* The opening: black, and one sentence at the size it deserves.
 * The photography starts the moment this leaves.
 */
export default function Intro() {
  const root = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .fromTo('.intro__top > *', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.07 })
        .fromTo('.intro__line span', { yPercent: 112 }, { yPercent: 0, duration: 1.35, stagger: 0.09 }, '-=0.6')
        .fromTo(
          ['.intro__say', '.intro__act', '.intro__foot'],
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 },
          '-=0.9'
        )

      // the statement drifts up and dims as the first photograph takes over
      gsap.to('.intro__inner', {
        yPercent: -14,
        opacity: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: '.intro', start: 'top top', end: 'bottom top', scrub: 0.4 },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  const words = HERO.title.replace(/\.$/, '').split(' ')
  const per = words.length <= 6 ? 2 : 3
  const lines = words.reduce((acc, w, i) => {
    const at = Math.floor(i / per)
    acc[at] = acc[at] ? `${acc[at]} ${w}` : w
    return acc
  }, [])

  return (
    <header className="intro" id="top" ref={root}>
      <div className="intro__inner">
        <div className="intro__top">
          <span className="label">
            {BRAND.city} — {BRAND.country}
          </span>
          <span className="label">
            <i className="dot" aria-hidden="true" /> {DESTINATIONS.length} desks open
          </span>
        </div>

        <h1 className="intro__title">
          {lines.map((line, i) => (
            <span className="intro__line" key={line}>
              <span>
                {i === lines.length - 1 ? (
                  <>
                    {line.split(' ').slice(0, -1).join(' ')}{' '}
                    <em>{line.split(' ').slice(-1)}</em>
                  </>
                ) : (
                  line
                )}
              </span>
            </span>
          ))}
        </h1>

        <div className="intro__lower">
          <p className="intro__say">{HERO.subtitle}</p>

          <div className="intro__act">
            <button className="btn btn--fill" onClick={() => scrollTo('#enquiry')}>
              Open a file <i aria-hidden="true">↗</i>
            </button>
            <button className="btn btn--line" onClick={() => scrollTo('#destinations')}>
              See the desks
            </button>
          </div>
        </div>

        <div className="intro__foot">
          <span className="label">{BRAND.address}</span>
          <span className="label">Scroll</span>
        </div>
      </div>
    </header>
  )
}
