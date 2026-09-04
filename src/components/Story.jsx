import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitFlap from './SplitFlap.jsx'
import { stage, BEATS } from '../stage3d/choreography.js'
import { BRAND, DESTINATIONS, PROCESS, STATS } from '../data/site'

const BOARD_INTERVAL = 4200

function useAddisClock() {
  const [now, setNow] = useState('')
  useEffect(() => {
    const tick = () => {
      try {
        setNow(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: BRAND.timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(new Date())
        )
      } catch {
        setNow(new Date().toLocaleTimeString('en-GB', { hour12: false }))
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function useBoardRotation(ready) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => setI((n) => (n + 1) % DESTINATIONS.length), BOARD_INTERVAL)
    return () => clearInterval(id)
  }, [ready])
  return DESTINATIONS[i]
}

/** Small technical readout, as on a spec sheet. */
function Spec({ value, unit, label }) {
  return (
    <div className="spec">
      <div className="spec__value">
        {value}
        {unit && <span className="spec__unit">{unit}</span>}
      </div>
      <div className="spec__label">{label}</div>
    </div>
  )
}

function PanelHead({ index, eyebrow }) {
  return (
    <div className="panel__head">
      <span className="panel__index">
        {index} / {String(BEATS.length).padStart(2, '0')}
      </span>
      <span className="panel__eyebrow">{eyebrow}</span>
    </div>
  )
}

export default function Story({ ready }) {
  const root = useRef(null)
  const time = useAddisClock()
  const d = useBoardRotation(ready)

  // Scroll scrubs the 3D choreography rather than triggering it.
  useEffect(() => {
    const el = root.current
    if (!el) return

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        stage.progress = self.progress
      },
    })

    return () => st.kill()
  }, [])

  // hold the hero headline off-screen from first paint
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set('.hero__title .word > span', { yPercent: 118, rotate: 3 })
      gsap.set(['.hero__sub > *', '.hero__board'], { y: 26, opacity: 0 })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!ready) return
    const ctx = gsap.context(() => {
      gsap
        .timeline({ delay: 0.1 })
        .to(
          '.hero__title .word > span',
          { yPercent: 0, rotate: 0, duration: 1.5, ease: 'expo.out', stagger: 0.09 },
          0.15
        )
        .fromTo(
          ['.hero__intro', '.hero__clock'],
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.08 },
          '-=1.15'
        )
        .to('.hero__board', { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }, '-=0.8')
        .to('.hero__sub > *', { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.1 }, '-=0.7')


      // every panel after the hero fades its copy in and out with the scroll,
      // so the aircraft is never fighting text for attention
      const fadePanels = gsap.utils.toArray('.panel--fade')
      fadePanels.forEach((panel) => {
        gsap.fromTo(
          panel.querySelector('.panel__inner'),
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            ease: 'power2.out',
            duration: 1,
            scrollTrigger: {
              trigger: panel,
              start: 'top 92%',
              end: 'top 48%',
              scrub: 0.6,
            },
          }
        )
        /* Every panel fades out, the last one included: it is painted over
           the fixed stage, so leaving it at full opacity kept "THE RECORD"
           sitting on top of the Destinations section below. */
        gsap.to(panel.querySelector('.panel__inner'), {
          y: -36,
          opacity: 0,
          ease: 'power2.in',
          scrollTrigger: {
            trigger: panel,
            start: 'bottom 52%',
            end: 'bottom 8%',
            scrub: 0.6,
          },
        })
      })
    }, root)

    return () => ctx.revert()
  }, [ready])

  // The giant wordmark sits outside this component's DOM subtree, so it cannot
  // be reached by a gsap.context-scoped selector — resolve the node directly.
  useEffect(() => {
    if (!ready) return
    const mark = document.querySelector('.stage-wordmark span')
    const hero = root.current?.querySelector('.panel--hero')
    if (!mark || !hero) return

    const tween = gsap.to(mark, {
      opacity: 0,
      scale: 1.18,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    })

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(mark, { clearProps: 'opacity,scale' })
    }
  }, [ready])

  return (
    <div className="story" ref={root}>
      {/* ---------------------------------------------------- 01 hero */}
      <section className="panel panel--hero" id="top">
        <div className="panel__inner">
          <div className="hero__top">
            <p className="hero__intro" style={{ opacity: 0 }}>
              Visa consultancy — Bole Road
            </p>
            <div className="hero__clock" style={{ opacity: 0 }}>
              <span>
                {BRAND.city}, {BRAND.country}
              </span>
              <strong>{time || '--:--:--'}</strong>
              <span>ADD · 9°N / 38°E</span>
            </div>
          </div>

          <div className="hero__foot">
          {/* The wordmark itself is the giant ghosted layer behind the
              aircraft; this is the readable statement, and the real heading. */}
          <h1 className="hero__title">
            <span className="mask">
              <span className="word">
                <span>Work, study and visit visas.</span>
              </span>
            </span>
            <span className="mask">
              <span className="word">
                <span className="hero__title-sub">You pay nothing until approval.</span>
              </span>
            </span>
          </h1>

          <div className="hero__board" role="status" aria-live="polite">
            <span className="hero__board-label">Departures</span>
            <span className="hero__board-route">
              <SplitFlap value={`ADD → ${d.iata}`} length={9} />
            </span>
            <span className="hero__board-city">
              <SplitFlap value={d.board} length={9} />
            </span>
            <span className="hero__board-kind">{d.kind}</span>
            <span className="hero__board-time">{d.duration}</span>
            <span className="hero__board-status">
              <i />
              Open
            </span>
          </div>

          <div className="hero__sub">
            <p className="hero__tagline">{BRAND.tagline}</p>
            <div className="hero__scroll">
              <i />
              <span>Scroll to depart</span>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------- 02 capabilities */}
      <section className="panel panel--right panel--fade" id="capabilities">
        <div className="panel__inner">
          <PanelHead index="02" eyebrow="What we handle" />
          <h2 className="panel__title">
            Files that
            <br />
            <em>actually fly</em>
          </h2>
          <p className="panel__body">
            A refusal usually traces back to a thin file, not a weak applicant. We build each one to
            the standard of the consulate that will read it, and lodge it only when it is complete.
          </p>

          <div className="specs">
            <Spec value="45" unit=" days" label="Türkiye and Italy work visa" />
            <Spec value="20" unit=" days" label="Japan visitor package" />
            <Spec value="60" unit=" days" label="Schengen visit visa" />
            <Spec value="0" unit=" birr" label="Payable before approval" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- 03 routes */}
      <section className="panel panel--left panel--fade" id="routes">
        <div className="panel__inner">
          <PanelHead index="03" eyebrow="Open desks" />
          <h2 className="panel__title">
            Six live
            <br />
            <em>routes</em>
          </h2>
          <p className="panel__body">
            Each desk has its own consulate logic, its own paperwork and its own honest timeline.
          </p>

          <div className="routes">
            {DESTINATIONS.map((r) => (
              <div className="route" key={r.id}>
                <span className="route__code">
                  ADD <i>→</i> {r.iata}
                </span>
                <span className="route__city">{r.board}</span>
                <span className="route__time">{r.duration}</span>
                <span className="route__kind">{r.kind}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ 04 process */}
      <section className="panel panel--right panel--fade" id="process">
        <div className="panel__inner">
          <PanelHead index="04" eyebrow="How it runs" />
          <h2 className="panel__title">
            Four
            <br />
            <em>stages</em>
          </h2>
          <p className="panel__body">
            No stage is skipped, and none is charged for in advance. If a route is not realistic for
            your profile, you hear it at stage one — not at stage three.
          </p>

          <div className="stages">
            {PROCESS.map((s) => (
              <div className="stage-row" key={s.n}>
                <span className="stage-row__n">{s.n}</span>
                <div>
                  <h3 className="stage-row__title">{s.title}</h3>
                  <p className="stage-row__body">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ 05 numbers */}
      <section className="panel panel--centre panel--fade" id="numbers">
        <div className="panel__inner">
          <PanelHead index="05" eyebrow="On the record" />
          <h2 className="panel__title numbers__title">
            The <em>record</em>
          </h2>
          <div className="numbers">
            {STATS.map((s) => (
              <div className="number" key={s.label}>
                <div className="number__value">
                  {s.value.toLocaleString('en-US')}
                  <sup>{s.suffix}</sup>
                </div>
                <div className="number__label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
