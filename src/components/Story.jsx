import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitFlap from './SplitFlap.jsx'
import { stage, BEATS } from '../stage3d/choreography.js'
import { BRAND, DESTINATIONS, PROCESS, STATS, countWord } from '../data/site'

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


      /* Panel copy fades in as its panel arrives and out as it leaves.

         This is a pure function of the panel's position, recomputed on every
         scroll — not a pair of tweens. It used to be a scrubbed fade-in plus a
         scrubbed fade-out on the same element's opacity, and the second tween
         recorded the first one's hidden start state as its own. Scrolling down
         hid the problem; scrolling back up reversed the fade-out into that
         hidden state, so the copy stayed invisible while the aircraft carried
         on. Position has no history, so this is right in both directions and
         at any scroll speed. */
      const clamp01 = gsap.utils.clamp(0, 1)
      const easeArrive = gsap.parseEase('power2.out')
      const easeLeave = gsap.parseEase('power2.in')

      gsap.utils.toArray('.panel--fade').forEach((panel) => {
        const inner = panel.querySelector('.panel__inner')
        const setOpacity = gsap.quickSetter(inner, 'opacity')
        const setY = gsap.quickSetter(inner, 'y', 'px')

        const apply = () => {
          const r = panel.getBoundingClientRect()
          const vh = window.innerHeight
          // 0 -> 1 as the top travels from 92% to 48% of the viewport
          const arrive = easeArrive(clamp01((0.92 * vh - r.top) / (0.44 * vh)))
          // 0 -> 1 as the bottom travels from 52% to 8%
          const leave = easeLeave(clamp01((0.52 * vh - r.bottom) / (0.44 * vh)))
          setOpacity(Math.min(arrive, 1 - leave))
          setY((1 - arrive) * 60 - leave * 36)
        }

        ScrollTrigger.create({
          trigger: panel,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: apply,
          onToggle: apply, // a fast fling can cross the whole range in one frame
          onRefresh: apply,
        })
        apply()
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
            <span className="hero__board-time">{d.country}</span>
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
            <Spec value="45" unit=" days" label="Turkey and Italy work visa" />
            <Spec value="60" unit=" days" label="Schengen visit visa" />
            <Spec value={String(DESTINATIONS.length)} label="Destinations, three service lines" />
            <Spec value="0" unit=" birr" label="Payable before approval" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- 03 routes */}
      <section className="panel panel--left panel--fade" id="routes">
        <div className="panel__inner">
          <PanelHead index="03" eyebrow="Open desks" />
          <h2 className="panel__title">
            {countWord(DESTINATIONS.length)} live
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
                <span className="route__kind">{r.services.join(' · ')}</span>
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
            {countWord(PROCESS.length)}
            <br />
            <em>steps</em>
          </h2>
          <p className="panel__body">
            No step is skipped, and none is charged for in advance. If a route is not realistic for
            your profile, you hear it at the assessment, not after the application.
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
