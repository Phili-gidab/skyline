import React, { useEffect } from 'react'
import { CATALOGUE, EXTRA_SERVICES, NOTICE } from '../data/site'
import { OPEN_SERVICE } from '../lib/events'
import { scrollTo } from '../lib/smooth'

/* The three service lines, set as catalogue entries: what the line is, what
 * it includes, and where it runs. Everything on the page at once — this is a
 * reference section, and hiding half of it behind a tab helps nobody.
 */
export default function Services() {
  // the footer's service links still point here
  useEffect(() => {
    const open = (e) => {
      const el = document.getElementById(`line-${e.detail}`)
      if (el) scrollTo(`#line-${e.detail}`)
    }
    window.addEventListener(OPEN_SERVICE, open)
    return () => window.removeEventListener(OPEN_SERVICE, open)
  }, [])

  return (
    <section className="section services" id="services">
      <div className="section__head">
        <div>
          <span className="section__no">03 — The catalogue</span>
          <h2 className="section__title">
            What we
            <br />
            actually do
          </h2>
        </div>
        <p className="section__aside">
          Three lines, and the practical travel work around them. Nothing here is charged for
          before a visa is approved.
        </p>
      </div>

      <div className="lines">
        {CATALOGUE.map((c) => (
          <article className="line" id={`line-${c.id}`} key={c.id}>
            <div className="line__lead">
              <span className="line__n">{c.n}</span>
              <h3 className="line__title">{c.title}</h3>
              <p className="prose">{c.lead}</p>
              <ul className="line__where">
                {c.destinations.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p className="line__note">{c.note}</p>
            </div>

            <ul className="line__includes">
              {c.includes.map((item, i) => (
                <li key={item}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="extras">
        <h3 className="extras__title">
          <span className="label">Alongside the visa</span>
          We arrange the practical side of the journey
        </h3>
        <ul className="extras__list">
          {EXTRA_SERVICES.map((e, i) => (
            <li key={e}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {e}
            </li>
          ))}
        </ul>
      </div>

      <p className="notice">{NOTICE}</p>
    </section>
  )
}
