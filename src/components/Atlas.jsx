import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BRAND, DESTINATIONS, photoSrc, photoSrcSet } from '../data/site'
import { scrollTo } from '../lib/smooth'

/* The index of desks.
 *
 * Every destination is one line of the atlas: number, country, city, code,
 * services. The route line down the gutter draws itself as you read, so the
 * page always shows how far through the list you are — Addis at the top, the
 * desk you are level with marked. A row opens in place rather than jumping to
 * a page of its own.
 */
export default function Atlas() {
  const root = useRef(null)
  const lineRef = useRef(null)
  const previewRef = useRef(null)
  const [open, setOpen] = useState(null)
  const [hover, setHover] = useState(null)

  // the route line draws through the list as it passes
  useEffect(() => {
    const el = root.current
    const line = lineRef.current
    if (!el || !line) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        line,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          transformOrigin: 'top center',
          scrollTrigger: { trigger: '.atlas__list', start: 'top 80%', end: 'bottom 60%', scrub: 0.4 },
        }
      )
      gsap.utils.toArray('.atlas__row').forEach((row) => {
        gsap.fromTo(
          row.querySelector('.atlas__dot'),
          { scale: 0.4, opacity: 0.3 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.4,
            ease: 'back.out(2)',
            scrollTrigger: { trigger: row, start: 'top 72%' },
          }
        )
      })
    }, el)
    return () => ctx.revert()
  }, [])

  // a photograph follows the pointer while a row is hovered (fine pointers only)
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const el = previewRef.current
    if (!el) return
    const pos = { x: window.innerWidth * 0.72, y: window.innerHeight * 0.5 }
    const to = { ...pos }
    const move = (e) => {
      to.x = e.clientX
      to.y = e.clientY
    }
    let frame
    const tick = () => {
      pos.x += (to.x - pos.x) * 0.12
      pos.y += (to.y - pos.y) * 0.12
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`
      frame = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move, { passive: true })
    frame = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    ScrollTrigger.refresh()
  }, [open])

  return (
    <section className="section atlas" id="destinations" ref={root}>
      <div className="section__head">
        <div>
          <span className="section__no">01 — The atlas</span>
          <h2 className="section__title">
            Where we
            <br />
            send people
          </h2>
        </div>
        <p className="section__aside">
          {DESTINATIONS.length} desks are open. Each one has its own consulate logic, its own
          paperwork and its own honest timeline. Open a line to read it.
        </p>
      </div>

      <div className="atlas__list">
        <span className="atlas__route" aria-hidden="true">
          <i ref={lineRef} />
        </span>

        <div className="atlas__origin">
          <span className="atlas__dot atlas__dot--origin" aria-hidden="true" />
          <span className="label">
            ADD — {BRAND.city}, departures
          </span>
        </div>

        {DESTINATIONS.map((d, i) => {
          const isOpen = open === d.id
          return (
            <article className={`atlas__row ${isOpen ? 'is-open' : ''}`} key={d.id}>
              <button
                className="atlas__line"
                onClick={() => setOpen(isOpen ? null : d.id)}
                onMouseEnter={() => setHover(d)}
                onMouseLeave={() => setHover((h) => (h?.id === d.id ? null : h))}
                aria-expanded={isOpen}
              >
                <span className="atlas__dot" aria-hidden="true" />
                <span className="atlas__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="atlas__country">{d.country}</span>
                <span className="atlas__city">{d.board}</span>
                <span className="atlas__code">
                  ADD<i>→</i>
                  {d.iata}
                </span>
                <span className="atlas__services">{d.services.join(' · ')}</span>
                <span className="atlas__open" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>

              {isOpen && (
              <div className="atlas__panel">
                <figure className="atlas__photo">
                  <img
                    src={photoSrc(d.photo, 1100)}
                    srcSet={photoSrcSet(d.photo, [640, 960, 1280])}
                    sizes="(max-width: 860px) 92vw, 46vw"
                    alt={`${d.city}, ${d.country}`}
                    decoding="async"
                  />
                  <figcaption className="label">{d.city}</figcaption>
                </figure>

                <div className="atlas__detail">
                  <p className="prose">{d.blurb}</p>
                  <ul className="atlas__points">
                    {d.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <a
                    className="btn btn--solid"
                    href="#enquiry"
                    onClick={(e) => {
                      e.preventDefault()
                      scrollTo('#enquiry')
                    }}
                  >
                    Enquire about {d.country} <i>↗</i>
                  </a>
                </div>
              </div>
              )}
            </article>
          )
        })}
      </div>

      <div className={`atlas__preview ${hover ? 'is-on' : ''}`} ref={previewRef} aria-hidden="true">
        {hover && (
          <img
            src={photoSrc(hover.photo, 720)}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
    </section>
  )
}
