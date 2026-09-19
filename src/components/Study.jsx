import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SCHOLARSHIP, BRAND, whatsappLink } from '../data/site'
import { NAV_TONE } from '../lib/events'

/** The fly-over's art, rendered offline (see README) and served from public/. */
const SKY = '/flyover/'

/**
 * The fly-over, as fractions of its pinned scroll. The page is showing again
 * by the end of `reveal`; the aircraft then finishes its pass over it.
 */
const FLIGHT = {
  /** pinned scroll, in viewport heights */
  length: 1.8,
  hud: [0, 0.1],
  converge: [0, 0.3],
  /** the aircraft is inside the cloud: the ground gives way to white here */
  whiteout: 0.34,
  clear: [0.36, 0.56],
  reveal: [0.4, 0.6],
  plane: [0.1, 0.92],
  /** the nav turns back to dark ink with the whiteout */
  light: 0.33,
}

const len = ([a, b]) => b - a
const toNumber = (s) => Number(String(s).replace(/[^0-9.]/g, ''))

const [INTAKE_STATE, INTAKE_TERM] = SCHOLARSHIP.intake.split(' — ')
const FOUNDED = SCHOLARSHIP.founded.replace(/\D/g, '')

const FACTS = [
  { value: SCHOLARSHIP.tiers[0].award, label: 'Top merit award' },
  { value: '$0', label: 'Application fee' },
  { value: '$0', label: 'I-20 fee' },
  { value: 'F-1', label: 'Interview coaching' },
]

/** The fly-over is pure motion; with reduced motion the section just scrolls. */
const canFly = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Tells the nav what is under it, once per change. */
function toneSetter() {
  let current = null
  return (tone) => {
    if (tone === current) return
    current = tone
    window.dispatchEvent(new CustomEvent(NAV_TONE, { detail: tone }))
  }
}

/** The school's name runs round a slowly turning ring; the intake sits in the middle. */
function Seal() {
  const ring = `${SCHOLARSHIP.school} · ${SCHOLARSHIP.location} · ${SCHOLARSHIP.founded} · `
  return (
    <div className="seal" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <defs>
          <path id="seal-ring" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <circle className="seal__rim" cx="100" cy="100" r="97" />
        <circle className="seal__rim" cx="100" cy="100" r="62" />
        <g className="seal__spin">
          <text className="seal__text">
            <textPath href="#seal-ring" textLength="486" lengthAdjust="spacing">
              {ring.toUpperCase()}
            </textPath>
          </text>
        </g>
      </svg>
      <div className="seal__core">
        <span>{INTAKE_STATE}</span>
        <strong>{INTAKE_TERM}</strong>
      </div>
    </div>
  )
}

/**
 * Merit award by GPA: one series of five magnitudes, so plain columns in a
 * single hue, each labelled at its cap, climbing left to right. Screen readers
 * get the same figures as a table.
 */
function MeritChart() {
  const steps = [...SCHOLARSHIP.tiers].reverse()
  const top = Math.max(...steps.map((t) => toNumber(t.award)))

  return (
    <figure className="merit">
      <figcaption>
        <span className="study__h">Merit award by high-school GPA</span>
        <span className="merit__sub">Undergraduate — the higher your GPA, the larger the award</span>
      </figcaption>

      <div className="merit__plot" aria-hidden="true">
        {steps.map((t) => (
          <div className="merit__col" key={t.gpa}>
            <span className="merit__value">{t.award}</span>
            <span className="merit__bar" style={{ '--h': toNumber(t.award) / top }} />
          </div>
        ))}
      </div>
      <div className="merit__axis" aria-hidden="true">
        {steps.map((t) => (
          <span className="merit__gpa" key={t.gpa}>
            GPA {t.gpa}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Merit award by high-school GPA</caption>
        <thead>
          <tr>
            <th scope="col">High-school GPA</th>
            <th scope="col">Award</th>
          </tr>
        </thead>
        <tbody>
          {SCHOLARSHIP.tiers.map((t) => (
            <tr key={t.gpa}>
              <td>{t.gpa}</td>
              <td>{t.award}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="merit__note">Postgraduate awards are a flat $2,500 across MBA and MS programmes.</p>
    </figure>
  )
}

/**
 * Study abroad: an offer sheet for Post University.
 *
 * It opens with a fly-over, built the way the reference builds its own —
 * layered art moved by one scrubbed timeline, no WebGL. The section pins;
 * cloud converges over the ground far below into a white whiteout, then
 * parts off the page while the aircraft crosses over the heading.
 */
export default function Study() {
  const root = useRef(null)
  const craft = useRef(null)
  const [fly] = useState(canFly)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const section = root.current
    const setTone = toneSetter()

    const ctx = gsap.context(() => {
      // the columns grow as they are reached; inside the pin, offset by its length
      const columns = (extra) =>
        gsap.fromTo(
          '.merit__bar',
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: '.merit', start: 'top 80%', ...extra },
          }
        )

      if (!fly) {
        gsap.fromTo(
          '.study__top > *, .study__intro > *',
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: { trigger: section, start: 'top 75%' },
          }
        )
        const rows = { trigger: '.ptable', start: 'top 85%' }
        gsap.fromTo(
          '.ptable tbody tr',
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.07, scrollTrigger: rows }
        )
        gsap.fromTo(
          '.ptable .strike span',
          { '--strike': '0%' },
          { '--strike': '100%', duration: 0.6, delay: 0.35, stagger: 0.07, scrollTrigger: rows }
        )
        columns({})
        return
      }

      const craftEl = craft.current
      gsap.set('.flyover__cloud--puff-a, .flyover__cloud--puff-b', { xPercent: -50, yPercent: -50 })
      gsap.set(craftEl, { xPercent: -50, yPercent: -50 })
      gsap.set('.flyover-jet__shadow', { yPercent: 7 })
      // off-screen on either side, whatever the viewport
      const travel = () => window.innerWidth / 2 + craftEl.offsetWidth / 2 + 40
      // big enough that the puff's opaque core covers the screen from where it sits
      const puffA = section.querySelector('.flyover__cloud--puff-a')
      const cover = () => (2.8 * Math.max(window.innerWidth, window.innerHeight)) / puffA.offsetWidth
      const reveal = len(FLIGHT.reveal)
      const clear = len(FLIGHT.clear)

      // one timeline, one unit long, so a position on it is a scroll fraction
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${window.innerHeight * FLIGHT.length}`,
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setTone(self.progress > FLIGHT.light ? 'light' : 'dark'),
          onLeave: () => setDone(true),
          onEnterBack: () => setDone(false),
          // back above the pin, the white catalogue is under the bar again
          onLeaveBack: () => setTone('light'),
        },
      })

      tl.to('.flyover__hud', { opacity: 0, y: -60, duration: len(FLIGHT.hud) }, FLIGHT.hud[0])
        // the ground recedes as the aircraft climbs
        .fromTo('.flyover__ground', { scale: 1.14 }, { scale: 1, duration: FLIGHT.whiteout }, 0)

        // cloud converges from three sides, and two puffs rise toward the camera
        .fromTo(
          '.flyover__cloud--left',
          { xPercent: -100, scale: 1 },
          { xPercent: -6, scale: 1.1, duration: len(FLIGHT.converge), ease: 'power1.out' },
          FLIGHT.converge[0]
        )
        .fromTo(
          '.flyover__cloud--right',
          { xPercent: 100, scale: 1 },
          { xPercent: 6, scale: 1.1, duration: len(FLIGHT.converge), ease: 'power1.out' },
          FLIGHT.converge[0] + 0.02
        )
        .fromTo(
          '.flyover__cloud--bottom',
          { yPercent: 100 },
          { yPercent: 12, duration: len(FLIGHT.converge), ease: 'power1.out' },
          FLIGHT.converge[0] + 0.04
        )
        // Nothing light is ever faded over the dark ground (it reads as grey
        // murk). The puffs grow from nothing, fully opaque, and the first keeps
        // coming until the aircraft is inside it: that is the whiteout.
        .fromTo('.flyover__cloud--puff-a', { scale: 0 }, { scale: 1.25, duration: 0.14 }, 0.1)
        .fromTo('.flyover__cloud--puff-b', { scale: 0 }, { scale: 1.15, duration: 0.17 }, 0.13)
        .to('.flyover__cloud--puff-a', { scale: cover, duration: FLIGHT.whiteout - 0.24, ease: 'power2.in' }, 0.24)

        // inside the cloud, the ground gives way to the page's cream
        .set('.flyover__fog', { opacity: 1 }, FLIGHT.whiteout)
        .set('.flyover__ground, .flyover__shade', { autoAlpha: 0 }, FLIGHT.whiteout)

        // then the cloud parts, and the last of it lifts off the page, cream on cream
        .to('.flyover__cloud--left', { xPercent: -112, scale: 1.45, duration: clear, ease: 'power1.in' }, FLIGHT.clear[0])
        .to('.flyover__cloud--right', { xPercent: 112, scale: 1.45, duration: clear, ease: 'power1.in' }, FLIGHT.clear[0])
        .to('.flyover__cloud--bottom', { yPercent: 110, duration: clear, ease: 'power1.in' }, FLIGHT.clear[0])
        .to('.flyover__cloud--puff-a', { scale: () => cover() * 1.5, opacity: 0, duration: clear * 0.5 }, FLIGHT.clear[0])
        .to('.flyover__cloud--puff-b', { scale: 3.2, opacity: 0, duration: clear * 0.5 }, FLIGHT.clear[0])
        .to('.flyover__fog', { opacity: 0, duration: clear * 0.7 }, FLIGHT.clear[0] + clear * 0.3)

        // the page surfaces under it
        .fromTo(
          '.study__top > *, .study__intro > *',
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: reveal * 0.6, stagger: reveal * 0.07, ease: 'power2.out' },
          FLIGHT.reveal[0]
        )
        .fromTo(
          '.ptable tbody tr',
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: reveal * 0.4, stagger: reveal * 0.08, ease: 'power2.out' },
          FLIGHT.reveal[0] + reveal * 0.3
        )
        .fromTo(
          '.ptable .strike span',
          { '--strike': '0%' },
          { '--strike': '100%', duration: reveal * 0.4, stagger: reveal * 0.08 },
          FLIGHT.reveal[0] + reveal * 0.55
        )

        // the aircraft: in from the left, over the page, out to the right
        .fromTo(
          craftEl,
          { x: () => -travel(), y: () => window.innerHeight * 0.05, rotation: -2.5 },
          {
            x: () => travel(),
            y: () => -window.innerHeight * 0.04,
            rotation: -1,
            duration: len(FLIGHT.plane),
          },
          FLIGHT.plane[0]
        )
        // the shadow falls further below, so it drifts against the aircraft
        .fromTo('.flyover-jet__shadow', { xPercent: -4 }, { xPercent: 9, duration: len(FLIGHT.plane) }, FLIGHT.plane[0])
        .set({}, {}, 1)

      columns({ pinnedContainer: section })
    }, root)

    return () => ctx.revert()
  }, [fly])

  return (
    <section className={`study${fly ? ' study--fly' : ''}`} id="study" ref={root}>
      {fly && (
        <div className={`flyover${done ? ' is-done' : ''}`} aria-hidden="true">
          <img className="flyover__ground" src={`${SKY}ground.webp`} alt="" loading="lazy" decoding="async" />
          <div className="flyover__shade" />
          <div className="flyover__hud">
            <span className="flyover__route">
              ADD <i>→</i> BDL
            </span>
            <p className="flyover__line">
              From Bole Road <em>to campus</em>
            </p>
            <span className="flyover__meta">
              {SCHOLARSHIP.school} · {SCHOLARSHIP.location}
            </span>
            <span className="flyover__cue">Scroll to fly</span>
          </div>
          <div className="flyover__fog" />
          {['puff-a', 'puff-b', 'bottom', 'left', 'right'].map((c) => (
            <img
              key={c}
              className={`flyover__cloud flyover__cloud--${c}`}
              src={`${SKY}cloud-${c === 'puff-a' ? 'puff' : c === 'puff-b' ? 'puff-2' : c}.webp`}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}

      <div className="study__top">
        <div>
          <span className="eyebrow">Study abroad</span>
          <h2 className="study__title">
            Connecticut,
            <br />
            <em>on scholarship</em>
          </h2>
        </div>
        <Seal />
      </div>

      <div className="study__intro">
        <p className="study__lede">
          {SCHOLARSHIP.school} in {SCHOLARSHIP.location}, founded {FOUNDED}. We prepare the admission
          file, negotiate the award and coach you through the F-1 interview — with no application
          fee, no I-20 fee and the SEVIS fee credit applied.
        </p>
        <ul className="facts">
          {FACTS.map((f) => (
            <li key={f.label}>
              <span className="facts__value">{f.value}</span>
              <span className="facts__label">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="study__body">
        <div>
          <h3 className="study__h">Programmes and tuition</h3>
          <table className="ptable">
            <thead>
              <tr>
                <th>Level</th>
                <th className="num">Listed fee</th>
                <th className="num">After scholarship</th>
              </tr>
            </thead>
            <tbody>
              {SCHOLARSHIP.programs.map((p) => (
                <tr key={p.level}>
                  <td>{p.level}</td>
                  <td className="strike">
                    <span>{p.fee}</span>
                  </td>
                  <td>{p.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <MeritChart />
      </div>

      <div className="study__foot">
        <p>
          {INTAKE_STATE} for {INTAKE_TERM}. Nothing is payable until your visa is approved.
        </p>
        <div className="study__ctas">
          <a className="btn btn--solid" href={BRAND.telegramUrl} target="_blank" rel="noreferrer" data-cursor="Apply">
            Start an application ↗
          </a>
          <a
            className="btn btn--ghost"
            href={whatsappLink(`Hello Skyline, I would like to ask about studying at ${SCHOLARSHIP.school}.`)}
            target="_blank"
            rel="noreferrer"
            data-cursor="WhatsApp"
          >
            Ask on WhatsApp ↗
          </a>
        </div>
      </div>

      {fly && (
        <div className={`flyover-jet${done ? ' is-done' : ''}`} aria-hidden="true">
          <div className="flyover-jet__craft" ref={craft}>
            <img className="flyover-jet__shadow" src={`${SKY}plane-shadow.webp`} alt="" loading="lazy" decoding="async" />
            <img
              className="flyover-jet__plane"
              src={`${SKY}plane-2800.webp`}
              srcSet={`${SKY}plane-1600.webp 1600w, ${SKY}plane-2800.webp 2800w`}
              sizes="max(92vw, 125svh)"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}
    </section>
  )
}
