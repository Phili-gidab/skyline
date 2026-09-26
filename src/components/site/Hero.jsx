import React, { useEffect, useRef, useState } from 'react'
import { BRAND, DESTINATIONS, HERO, CATALOGUE, STATS, photoSrc } from '../../data/site'
import EnquiryForm from '../forms/EnquiryForm'
import { Check } from './Icons'

const POINTS = [
  'No payment before approval',
  'Document preparation and review',
  'Embassy and VFS appointment guidance',
]

/* The hero photograph changes every few seconds, slowly drifting in.
   It is three destinations, not a slideshow of everything — enough to
   suggest range without turning the first screen into a carousel. */
const SHOTS = [0, 4, 7]

export default function Hero() {
  const [shot, setShot] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setShot((n) => (n + 1) % SHOTS.length), 6500)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="hero" id="top">
      <div className="hero__bg">
        {SHOTS.map((i, n) => {
          const d = DESTINATIONS[i] || DESTINATIONS[0]
          return (
            <img
              key={d.id}
              className={n === shot ? 'is-on' : ''}
              src={photoSrc(d.photo, 1600)}
              alt=""
              fetchPriority={n === 0 ? 'high' : undefined}
              loading={n === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          )
        })}
      </div>

      <div className="wrap hero__in">
        <div>
          <span className="hero__badge">
            <i aria-hidden="true" />
            {DESTINATIONS.length} destinations · {CATALOGUE.length} service lines
          </span>

          <h1>
            {HERO.title.replace(/\.$/, '')} <span>from Addis Ababa</span>
          </h1>

          <p className="hero__text">
            {BRAND.mission} Our office is at {BRAND.address} — {BRAND.landmark}.
          </p>

          <div className="hero__acts">
            <a className="btn btn--white" href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
              Chat on WhatsApp
            </a>
            <a className="btn btn--solid" href={`tel:${BRAND.phones[0].tel}`}>
              Call {BRAND.phones[0].display}
            </a>
          </div>

          <ul className="hero__points">
            {POINTS.map((p) => (
              <li key={p}>
                <Check /> {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="quote" id="enquiry">
          <h2>Free consultation</h2>
          <p>Send your details and a consultant will call you back, usually the same working day.</p>
          <EnquiryForm />
        </div>
      </div>
    </section>
  )
}

/* Figures count up the first time they are seen. Anything that is not a plain
   number (0 birr, for instance) is left exactly as the office wrote it. */
function useCountUp(target, run) {
  const [n, setN] = useState(run ? 0 : target)
  useEffect(() => {
    if (!run || typeof target !== 'number' || target === 0) return setN(target)
    let frame
    const start = performance.now()
    const dur = 1100
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      setN(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, run])
  return n
}

function Stat({ value, suffix, label, run }) {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9]/g, ''))
  const isNumber = Number.isFinite(numeric) && String(value).trim() !== ''
  const shown = useCountUp(isNumber ? numeric : value, run && isNumber)
  return (
    <div className="stat">
      <b>
        {isNumber ? shown : value}
        {suffix}
      </b>
      <span>{label}</span>
    </div>
  )
}

export function Stats() {
  const ref = useRef(null)
  const [run, setRun] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRun(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="wrap">
      <div className="stats" ref={ref}>
        {STATS.map((s) => (
          <Stat key={s.label} value={s.value} suffix={s.suffix} label={s.label} run={run} />
        ))}
      </div>
    </div>
  )
}
