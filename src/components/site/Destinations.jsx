import React, { useEffect, useRef, useState } from 'react'
import { DESTINATIONS, photoSrc, photoSrcSet } from '../../data/site'
import { Check, Arrow } from './Icons'

const FIRST = 8

export default function Destinations() {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(null)
  const dialog = useRef(null)
  const shown = all ? DESTINATIONS : DESTINATIONS.slice(0, FIRST)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <section className="section" id="destinations">
      <div className="wrap">
        <div className="section__head section__head--center">
          <span className="eyebrow">Destinations</span>
          <h2 className="section__title">Where we send our clients</h2>
          <p className="section__text">
            {DESTINATIONS.length} destinations across study, work and visit visas. Each has its own
            requirements, and we prepare the file accordingly.
          </p>
        </div>

        <div className="grid grid--4">
          {shown.map((d, i) => (
            <button className="dest" key={d.id} onClick={() => setOpen(d)}>
              <div className="dest__img">
                <img
                  src={photoSrc(d.photo, 640)}
                  srcSet={photoSrcSet(d.photo, [360, 520, 720])}
                  sizes="(max-width: 680px) 92vw, (max-width: 1000px) 45vw, 23vw"
                  alt={`${d.city}, ${d.country}`}
                  loading={i < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                />
                <span className="dest__veil">
                  View details <Arrow />
                </span>
              </div>
              <div className="dest__body">
                <h3>{d.country}</h3>
                <p className="dest__city">{d.city}</p>
                <div className="dest__tags">
                  {d.services.map((s) => (
                    <span className="dest__tag" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        {DESTINATIONS.length > FIRST && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="btn btn--ghost" onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `View all ${DESTINATIONS.length} destinations`}
            </button>
          </div>
        )}
      </div>

      <dialog className="dest-dialog" ref={dialog} onClose={() => setOpen(null)}>
        {open && (
          <>
            <div className="dest-dialog__img">
              <img src={photoSrc(open.photo, 900)} alt={`${open.city}, ${open.country}`} decoding="async" />
              <button className="dest-dialog__x" onClick={() => setOpen(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="dest-dialog__body">
              <span className="eyebrow">
                {open.city} · ADD → {open.iata}
              </span>
              <h3>{open.country}</h3>
              <p>{open.blurb}</p>
              <ul className="card__list">
                {open.points.map((p) => (
                  <li key={p}>
                    <Check /> {p}
                  </li>
                ))}
              </ul>
              <a
                className="btn btn--solid"
                href="#contact"
                onClick={() => setOpen(null)}
                style={{ marginTop: '1.25rem' }}
              >
                Enquire about {open.country}
              </a>
            </div>
          </>
        )}
      </dialog>
    </section>
  )
}
