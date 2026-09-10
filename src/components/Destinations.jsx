import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DESTINATIONS, countWord } from '../data/site'

function Card({ d }) {
  return (
    <article className="card" data-cursor={d.kind}>
      <div className="card__media">
        {d.photo && (
          <img
            src={d.photo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        )}
      </div>
      <div className="card__scrim" />

      <span className="card__index">{d.index}</span>
      <span className="card__badge">ADD → {d.iata}</span>

      <div>
        <div className="card__city">{d.city}</div>
        <h3 className="card__country">
          {d.country}
          <span className="card__kind">{d.kind}</span>
        </h3>
        <p className="card__blurb">{d.blurb}</p>
        <ul className="card__points">
          {d.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export default function Destinations() {
  const root = useRef(null)
  const viewport = useRef(null)
  const track = useRef(null)
  const bar = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const isNarrow = window.matchMedia('(max-width: 860px)').matches
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (isNarrow || reduced) {
        // let the track scroll natively on touch devices
        viewport.current.style.overflowX = 'auto'
        return
      }

      const getDistance = () => track.current.scrollWidth - window.innerWidth

      const tween = gsap.to(track.current, {
        x: () => -getDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: viewport.current,
          start: 'top top',
          end: () => `+=${getDistance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            if (bar.current) bar.current.style.width = `${12 + self.progress * 88}%`
          },
        },
      })

      // cards drift in with a slight stagger as they enter the viewport
      gsap.fromTo(
        '.card',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: viewport.current, start: 'top 70%' },
        }
      )

      return () => tween.kill()
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="dest" id="destinations" ref={root}>
      <div className="dest__head">
        <div>
          <span className="eyebrow">Open desks</span>
          <h2 className="dest__title">
            Where we
            <br />
            <em>send people</em>
          </h2>
        </div>
        <div className="dest__head-right">
          <p style={{ maxWidth: '34ch', color: 'rgba(236,230,215,0.62)', fontSize: '0.98rem', lineHeight: 1.6 }}>
            {countWord(DESTINATIONS.length)} live routes across study, work and visit visas, each with its own
            consulate logic and its own paperwork. Scroll sideways.
          </p>
        </div>
      </div>

      <div className="dest__viewport" ref={viewport}>
        <div className="dest__track" ref={track}>
          {DESTINATIONS.map((d) => (
            <Card key={d.id} d={d} />
          ))}
        </div>
      </div>

      <div className="dest__foot">
        <span className="label">01 — {String(DESTINATIONS.length).padStart(2, '0')}</span>
        <div className="dest__progress">
          <i ref={bar} />
        </div>
        <span className="label">Scroll</span>
      </div>
    </section>
  )
}
