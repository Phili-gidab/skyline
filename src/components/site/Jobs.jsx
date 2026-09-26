import React, { useCallback, useState } from 'react'
import { BRAND, ROLES } from '../../data/site'
import CareerForm from '../forms/CareerForm'

export default function Jobs() {
  const [applying, setApplying] = useState(null)
  const close = useCallback(() => setApplying(null), [])

  return (
    <section className="section" id="careers">
      <div className="wrap">
        <div className="section__head section__head--center">
          <span className="eyebrow">Careers</span>
          <h2 className="section__title">Join the team</h2>
          <p className="section__text">
            {ROLES.length} open positions at our Bole Road office. Send your CV and we will get back
            to you.
          </p>
        </div>

        {ROLES.map((r) => (
          <div className="job" key={r.title}>
            <div>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
              <span className="job__type">{r.type}</span>
            </div>
            <button className="btn btn--solid" onClick={() => setApplying(r.title)}>
              Apply now
            </button>
          </div>
        ))}

        <p style={{ marginTop: '1.25rem', color: 'var(--light)', fontSize: '0.9rem' }}>
          You can also email your CV to {BRAND.email}
        </p>

        {applying && <CareerForm role={applying} onClose={close} />}
      </div>
    </section>
  )
}
