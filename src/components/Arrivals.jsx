import React, { useEffect, useRef, useState } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitFlap from './SplitFlap.jsx'
import { STATS, BRAND, whatsappLink } from '../data/site'

/**
 * The closing panel of the story: an arrivals board.
 *
 * The hero opens on a split-flap *departures* board; this bookends it. Each
 * statistic is a row whose value riffles in, one row after another, as the
 * board comes into view — and blanks again when it leaves, so it replays in
 * either scroll direction. The state is discrete (on/off via ScrollTrigger
 * callbacks), never a scrubbed tween, so scrolling back cannot strand it.
 */

const CELLS = 6
const ROW_GAP = 380 // ms between rows, so the board fills top to bottom

const format = (s) => `${s.value}${s.suffix}`.toUpperCase().trim()

export default function Arrivals({ time }) {
  const root = useRef(null)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const el = root.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(STATS.length)
      return
    }

    let timers = []
    const clear = () => {
      timers.forEach(clearTimeout)
      timers = []
    }
    const arrive = () => {
      clear()
      STATS.forEach((_, i) => timers.push(setTimeout(() => setShown(i + 1), 150 + i * ROW_GAP)))
    }
    const leave = () => {
      clear()
      setShown(0)
    }

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      end: 'bottom 18%',
      onEnter: arrive,
      onEnterBack: arrive,
      onLeave: leave,
      onLeaveBack: leave,
    })

    return () => {
      clear()
      st.kill()
    }
  }, [])

  return (
    <div className="arrivals-wrap" ref={root}>
      <div className="arrivals">
        <div className="arrivals__bar">
          <b>Arrivals</b>
          <span className="arrivals__where">
            {BRAND.short} · {BRAND.city}
          </span>
          <span className="arrivals__time">{time || '--:--:--'}</span>
        </div>

        {STATS.map((s, i) => (
          <div className="arrivals__row" key={s.label}>
            <span className="arrivals__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="arrivals__label">{s.label}</span>
            <span className="arrivals__value" aria-hidden="true">
              <SplitFlap
                value={i < shown ? format(s).padStart(CELLS) : ' '.repeat(CELLS)}
                length={CELLS}
                step={70}
              />
            </span>
            {/* the flaps are decorative and can be blank; this is what is read out */}
            <span className="sr-only">{format(s)}</span>
            <span className="arrivals__status">
              <i />
              {s.status}
            </span>
          </div>
        ))}
      </div>

      <div className="arrivals__cta">
        <p>Your file could be next.</p>
        <a
          className="btn btn--solid"
          href={whatsappLink('Hello Skyline, I would like to open a file.')}
          target="_blank"
          rel="noreferrer"
          data-cursor="WhatsApp"
        >
          WhatsApp us ↗
        </a>
        <a
          className="btn btn--ghost"
          href={BRAND.telegramUrl}
          target="_blank"
          rel="noreferrer"
          data-cursor="Telegram"
        >
          Telegram ↗
        </a>
      </div>
    </div>
  )
}
