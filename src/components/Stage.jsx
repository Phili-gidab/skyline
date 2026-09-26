import React, { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DESTINATIONS, photoSrc, photoSrcSet } from '../data/site'
import DeskFile from './DeskFile'

/* The stage.
 *
 * Ten photographs on a rail, one screen wide each. One number drives
 * everything: how far along the rail you are. Scrolling moves it, dragging
 * moves it, the arrow keys move it — all three write to the same scroll
 * position, so they can never disagree.
 *
 * Off that number hang the rail itself, a slower parallax on each photograph,
 * a slower one again on each name (so the type trails the picture), a skew
 * taken from scroll velocity, and the progress bar. Nothing here animates on
 * a timer.
 */
export default function Stage() {
  const root = useRef(null)
  const viewport = useRef(null)
  const rail = useRef(null)
  const bar = useRef(null)
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(null)
  const n = DESTINATIONS.length

  // one screen of scroll per desk
  useEffect(() => {
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const medias = gsap.utils.toArray('.slide__media')
      const names = gsap.utils.toArray('.slide__name')
      const slides = gsap.utils.toArray('.slide')
      const setX = gsap.quickSetter(rail.current, 'x', 'px')
      const setBar = gsap.quickSetter(bar.current, 'scaleX')
      const clampSkew = gsap.utils.clamp(-9, 9)

      const draw = (progress, velocity) => {
        const w = window.innerWidth
        const x = -progress * (n - 1) * w
        setX(x)
        setBar(progress)

        const skew = clampSkew(velocity / 420)
        slides.forEach((slide, i) => {
          // how far this slide is from the left edge of the screen
          const offset = x + i * w
          // the photograph lags the rail, the name lags the photograph
          gsap.set(medias[i], { x: -offset * 0.14, scaleX: 1 + Math.abs(skew) / 220 })
          gsap.set(names[i], { x: -offset * 0.3, skewX: skew })
          slide.classList.toggle('is-live', Math.abs(offset) < w * 0.5)
        })

        const at = Math.round(progress * (n - 1))
        setActive((prev) => (prev === at ? prev : at))
      }

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.55,
        snap: {
          snapTo: 1 / (n - 1),
          duration: { min: 0.15, max: 0.45 },
          delay: 0.04,
          ease: 'power2.out',
        },
        onUpdate: (self) => draw(self.progress, self.getVelocity()),
        onRefresh: (self) => draw(self.progress, 0),
      })

      return () => st.kill()
    }, el)

    return () => ctx.revert()
  }, [n])

  /* Dragging writes to scroll rather than to the rail, so drag, wheel and
     keyboard can never fight each other. One screen across = one screen down. */
  useEffect(() => {
    const vp = viewport.current
    if (!vp) return
    let dragging = false
    let lastX = 0
    let moved = 0

    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      dragging = true
      moved = 0
      lastX = e.clientX
      vp.classList.add('is-dragging')
      /* No setPointerCapture here: capturing on pointerdown re-targets the
         following events at the viewport, and the buttons on the slide stop
         receiving clicks. The window listeners below already follow the
         pointer outside the element. */
    }

    const move = (e) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      moved += Math.abs(dx)
      const ratio = window.innerHeight / window.innerWidth
      const to = window.scrollY - dx * ratio
      if (window.__lenis) window.__lenis.scrollTo(to, { immediate: true })
      else window.scrollTo(0, to)
    }

    const up = (e) => {
      if (!dragging) return
      dragging = false
      vp.classList.remove('is-dragging')
      // a drag should not also count as a click on the desk underneath
      if (moved > 6) {
        const swallow = (ev) => ev.stopPropagation()
        vp.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => vp.removeEventListener('click', swallow, { capture: true }), 60)
      }
    }

    vp.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      vp.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  // the two desks either side are fetched as soon as you land on one
  useEffect(() => {
    const w = window.innerWidth > 1100 ? 1400 : 900
    for (const i of [active + 1, active - 1, active + 2]) {
      const d = DESTINATIONS[i]
      if (d) new Image().src = photoSrc(d.photo, w)
    }
  }, [active])

  const goTo = useCallback(
    (i) => {
      const el = root.current
      if (!el) return
      const index = gsap.utils.clamp(0, n - 1, i)
      const top = el.offsetTop + (index / (n - 1)) * (el.offsetHeight - window.innerHeight)
      if (window.__lenis) window.__lenis.scrollTo(top, { duration: 0.9 })
      else window.scrollTo({ top, behavior: 'smooth' })
    },
    [n]
  )

  useEffect(() => {
    const keys = (e) => {
      if (open) return
      if (e.key === 'ArrowRight') goTo(active + 1)
      if (e.key === 'ArrowLeft') goTo(active - 1)
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [active, goTo, open])

  return (
    <>
      <section className="stage" id="destinations" ref={root} style={{ '--desks': n }}>
        <div className="stage__viewport" ref={viewport}>
          <div className="rail" ref={rail}>
            {DESTINATIONS.map((d, i) => (
              <article className="slide" key={d.id}>
                {/* the blurred thumbnail is 2 KB and arrives with the markup, so a
                    desk is never a black rectangle while its photograph loads */}
                <div className="slide__media" style={{ '--lqip': `url("${photoSrc(d.photo, 48)}")` }}>
                  <img
                    src={photoSrc(d.photo, 1400)}
                    srcSet={photoSrcSet(d.photo, [720, 1100, 1400, 1800])}
                    sizes="100vw"
                    alt={`${d.city}, ${d.country}`}
                    loading={i < 3 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : undefined}
                    decoding="async"
                    draggable="false"
                    onLoad={(e) => e.currentTarget.classList.add('is-in')}
                  />
                </div>

                <span className="slide__n">
                  {String(i + 1).padStart(2, '0')} — {d.board}
                </span>

                <h2 className="slide__name">{d.country}</h2>

                <div className="slide__meta">
                  <span>
                    ADD → {d.iata} &nbsp;·&nbsp; {d.services.join(' · ')}
                  </span>
                  <button className="slide__open" onClick={() => setOpen(d)}>
                    Open the file <i aria-hidden="true">↗</i>
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="stage__hud">
            <span className="stage__count">
              <b>{String(active + 1).padStart(2, '0')}</b> / {String(n).padStart(2, '0')} desks
            </span>

            <span className="stage__hint">
              <i aria-hidden="true" />
              Drag, or scroll
            </span>

            <span className="stage__bar">
              <i ref={bar} />
            </span>
          </div>
        </div>
      </section>

      <DeskFile desk={open} onClose={() => setOpen(null)} />
    </>
  )
}
