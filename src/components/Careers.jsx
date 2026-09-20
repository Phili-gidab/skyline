import React, { useCallback, useState } from 'react'
import { BRAND, ROLES } from '../data/site'
import CareerForm from './forms/CareerForm'

/* Open roles. Two lines of the same index the desks use, so the page reads
 * consistently — apply opens the file dialog with a CV upload.
 */
export default function Careers() {
  const [applying, setApplying] = useState(null)
  const close = useCallback(() => setApplying(null), [])

  return (
    <section className="section careers" id="careers">
      <div className="section__head">
        <div>
          <span className="section__no">06 — Careers</span>
          <h2 className="section__title">
            Work at
            <br />
            Skyline
          </h2>
        </div>
        <p className="section__aside">
          {ROLES.length} open positions at the Bole Road office. Send a CV and we will come back to
          you — applications are read by the office, not a portal.
        </p>
      </div>

      <ul className="roles">
        {ROLES.map((r, i) => (
          <li className="role" key={r.title}>
            <span className="role__n">{String(i + 1).padStart(2, '0')}</span>
            <div className="role__main">
              <h3 className="role__title">{r.title}</h3>
              <p className="role__body">{r.body}</p>
            </div>
            <span className="role__type label">{r.type}</span>
            <button className="btn btn--ghost" onClick={() => setApplying(r.title)}>
              Apply <i>↗</i>
            </button>
          </li>
        ))}
      </ul>

      <p className="roles__foot label">
        Or send your CV to {BRAND.email}
      </p>

      {applying && <CareerForm role={applying} onClose={close} />}
    </section>
  )
}
