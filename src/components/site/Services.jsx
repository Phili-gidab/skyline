import React from 'react'
import { CATALOGUE, EXTRA_SERVICES, NOTICE } from '../../data/site'
import { Cap, Work, Plane, Check, Arrow } from './Icons'

const ICONS = { student: Cap, work: Work, visit: Plane }

export default function Services() {
  return (
    <section className="section section--tint" id="services">
      <div className="wrap">
        <div className="section__head section__head--center">
          <span className="eyebrow">Our services</span>
          <h2 className="section__title">Visa services for study, work and travel</h2>
          <p className="section__text">
            Three service lines, prepared to the standard of the consulate that will read the file.
            Nothing is charged for before your visa is approved.
          </p>
        </div>

        <div className="grid grid--3">
          {CATALOGUE.map((c) => {
            const Icon = ICONS[c.id] || Plane
            return (
              <article className="card" id={`service-${c.id}`} key={c.id}>
                <div className="card__icon">
                  <Icon />
                </div>
                <h3>{c.title}</h3>
                <p>{c.lead}</p>
                <ul className="card__list">
                  {c.includes.slice(0, 5).map((i) => (
                    <li key={i}>
                      <Check /> {i}
                    </li>
                  ))}
                </ul>
                <a className="card__more" href="#contact">
                  Ask about {c.ask} <Arrow />
                </a>
              </article>
            )
          })}
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3>Travel services alongside the visa</h3>
          <ul className="card__list" style={{ columns: 2, columnGap: '2rem' }}>
            {EXTRA_SERVICES.map((e) => (
              <li key={e}>
                <Check /> {e}
              </li>
            ))}
          </ul>
        </div>

        <p className="ftr__notice" style={{ color: 'var(--light)', borderTop: 0, paddingTop: '1.5rem' }}>
          {NOTICE}
        </p>
      </div>
    </section>
  )
}
