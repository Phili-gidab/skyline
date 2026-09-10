import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BRAND, CATALOGUE, EXTRA_SERVICES, WHY, NOTICE, whatsappLink } from '../data/site'
import { OPEN_SERVICE } from '../lib/events'

/**
 * The service catalogue, set from the client's own PDF
 * (public/skyline-service-catalogue.pdf).
 *
 * Three service lines, each an accordion row: the heading carries the name
 * and where it goes, the panel carries the full inclusion list. One line is
 * open at a time so the page never grows by more than one panel.
 *
 * The open/close is a CSS grid-template-rows transition (0fr -> 1fr), so no
 * height is ever measured in JS. Page height does change, though, and every
 * ScrollTrigger below this section has to re-measure when it settles.
 */

function Line({ line, open, onToggle, onSettled }) {
  const bodyId = `cat-${line.id}`
  const headId = `cat-${line.id}-head`

  return (
    <article className={`cat ${open ? 'is-open' : ''}`}>
      <h3 className="cat__heading">
        <button
          type="button"
          id={headId}
          className="cat__head"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          data-cursor={open ? 'Close' : 'Open'}
        >
          <span className="cat__n">{line.n}</span>
          <span className="cat__title">{line.title}</span>
          <span className="cat__where">{line.destinations.join(' · ')}</span>
          <span className="cat__toggle" aria-hidden="true" />
        </button>
      </h3>

      <div
        className="cat__body"
        id={bodyId}
        role="region"
        aria-labelledby={headId}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows') onSettled()
        }}
      >
        {/* inert while closed, so the collapsed links are not in the tab order */}
        <div className="cat__clip" {...(open ? {} : { inert: '' })}>
          <div className="cat__inner">
            <p className="cat__lead">{line.lead}</p>

            <div className="cat__cols">
              <div>
                <h4 className="cat__label">Our services include</h4>
                <ul className="cat__items">
                  {line.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <aside className="cat__aside">
                <h4 className="cat__label">Destinations may include</h4>
                <ul className="cat__chips">
                  {line.destinations.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <p className="cat__note">{line.note}</p>
                <a
                  className="cat__cta"
                  href={whatsappLink(`Hello Skyline, I would like to ask about ${line.ask}.`)}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor="WhatsApp"
                >
                  Ask about {line.ask} on WhatsApp ↗
                </a>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Catalogue() {
  const root = useRef(null)
  const [open, setOpen] = useState(CATALOGUE[0].id)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.catalogue__title .word > span',
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: '.catalogue__title', start: 'top 85%' },
        }
      )

      const rise = (targets, trigger, stagger = 0.07) =>
        gsap.fromTo(
          targets,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'power3.out',
            stagger,
            scrollTrigger: { trigger, start: 'top 82%' },
          }
        )

      rise('.cat', '.cat-list')
      rise('.extras__list li', '.extras', 0.05)
      rise('.why__item', '.why', 0.06)
    }, root)

    return () => ctx.revert()
  }, [])

  // The footer's service links open the matching line (see lib/events.js).
  useEffect(() => {
    const onOpen = (e) => setOpen(e.detail)
    window.addEventListener(OPEN_SERVICE, onOpen)
    return () => window.removeEventListener(OPEN_SERVICE, onOpen)
  }, [])

  // Everything pinned or triggered further down the page was measured
  // against the old height.
  const settle = () => ScrollTrigger.refresh()

  return (
    <section className="section catalogue" id="services" ref={root}>
      <div className="catalogue__head">
        <div>
          <span className="eyebrow">Service catalogue</span>
          <h2 className="catalogue__title">
            <span className="mask">
              <span className="word">
                <span>Three services,</span>
              </span>
            </span>
            <span className="mask">
              <span className="word">
                <span className="serif-it">one standard</span>
              </span>
            </span>
          </h2>
        </div>

        <div className="catalogue__mission">
          <span className="label">Our mission</span>
          <p>{BRAND.mission}</p>
          <a
            className="catalogue__pdf"
            href={BRAND.catalogueUrl}
            download
            data-cursor="PDF"
          >
            Download the catalogue (PDF) ↓
          </a>
        </div>
      </div>

      <div className="cat-list">
        {CATALOGUE.map((line) => (
          <Line
            key={line.id}
            line={line}
            open={open === line.id}
            onToggle={() => setOpen((cur) => (cur === line.id ? null : line.id))}
            onSettled={settle}
          />
        ))}
      </div>

      <div className="extras">
        <div className="extras__head">
          <span className="eyebrow">Additional services</span>
          <p>Alongside the visa, we arrange the practical side of the journey.</p>
        </div>
        <ul className="extras__list">
          {EXTRA_SERVICES.map((s, i) => (
            <li key={s}>
              <span className="extras__n">{String(i + 1).padStart(2, '0')}</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="why">
        <span className="eyebrow">Why Skyline</span>
        <ul className="why__grid">
          {WHY.map((w) => (
            <li className="why__item" key={w.title}>
              <h4>{w.title}</h4>
              <p>{w.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="notice">
        <strong>Important notice.</strong> {NOTICE}
      </p>
    </section>
  )
}
