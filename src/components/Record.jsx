import React from 'react'
import { STATS, WHY, PROCESS } from '../data/site'

/* The dark plate in the middle of the book: what the office has done, and why
 * a file goes through it rather than straight to the consulate.
 */
export default function Record() {
  return (
    <section className="section section--dark record" id="record" data-nav="dark">
      <div className="section__head">
        <div>
          <span className="section__no">02 — On the record</span>
          <h2 className="section__title">
            The
            <br />
            record
          </h2>
        </div>
        <p className="section__aside">
          {PROCESS.length} steps, no step skipped, and none charged for in advance. If a route is
          not realistic for your profile, you hear it at the assessment.
        </p>
      </div>

      <dl className="figures">
        {STATS.map((s) => (
          <div className="figure" key={s.label}>
            <dt className="label">{s.label}</dt>
            <dd>
              <span className="figure__value">
                {s.value}
                {s.suffix && <i>{s.suffix}</i>}
              </span>
              <span className="figure__status">{s.status}</span>
            </dd>
          </div>
        ))}
      </dl>

      <ul className="why">
        {WHY.map((w) => (
          <li className="why__item" key={w.title}>
            <h3>{w.title}</h3>
            <p>{w.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
