import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { photoSrc } from '../data/site'
import { scrollTo } from '../lib/smooth'

/* A desk, opened.
 *
 * The photograph wipes across from the rail and the file writes itself out
 * beside it. It holds the desk it was given until its own exit has finished,
 * so closing never blanks the panel mid-animation.
 */
export default function DeskFile({ desk, onClose }) {
  const root = useRef(null)
  const [shown, setShown] = useState(null)
  const tl = useRef(null)

  useEffect(() => {
    if (desk) setShown(desk)
  }, [desk])

  useEffect(() => {
    const el = root.current
    if (!el || !shown) return

    const ctx = gsap.context(() => {
      tl.current?.kill()
      if (desk) {
        el.classList.add('is-open')
        tl.current = gsap
          .timeline({ defaults: { ease: 'expo.out' } })
          .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' })
          .fromTo(
            '.file__media',
            { clipPath: 'inset(0 100% 0 0)' },
            { clipPath: 'inset(0 0% 0 0)', duration: 1 },
            0
          )
          .fromTo('.file__media img', { scale: 1.25 }, { scale: 1, duration: 1.4 }, 0)
          .fromTo(
            '.file__body > *',
            { opacity: 0, y: 26 },
            { opacity: 1, y: 0, duration: 0.8, stagger: 0.06 },
            0.25
          )
      } else {
        tl.current = gsap
          .timeline({
            onComplete: () => {
              el.classList.remove('is-open')
              setShown(null)
            },
          })
          .to('.file__body > *', { opacity: 0, y: 14, duration: 0.25, ease: 'power2.in' })
          .to('.file__media', { clipPath: 'inset(0 0 0 100%)', duration: 0.55, ease: 'expo.in' }, 0.05)
          .to(el, { opacity: 0, duration: 0.25 }, '-=0.2')
      }
    }, el)

    return () => ctx.revert()
  }, [desk, shown])

  // the page behind must not scroll while a file is open
  useEffect(() => {
    if (!shown) return
    const lenis = window.__lenis
    if (desk) {
      document.body.classList.add('is-locked')
      lenis?.stop()
    } else {
      document.body.classList.remove('is-locked')
      lenis?.start()
    }
    return () => {
      document.body.classList.remove('is-locked')
      lenis?.start()
    }
  }, [desk, shown])

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  if (!shown) return null

  return (
    <div className="file" ref={root} role="dialog" aria-modal="true" aria-label={shown.country}>
      <figure className="file__media" style={{ '--lqip': `url("${photoSrc(shown.photo, 48)}")` }}>
        <img
          src={photoSrc(shown.photo, 1400)}
          alt={`${shown.city}, ${shown.country}`}
          decoding="async"
          onLoad={(e) => e.currentTarget.classList.add('is-in')}
        />
        <figcaption>{shown.city}</figcaption>
      </figure>

      <div className="file__body">
        <span className="label">
          ADD → {shown.iata} · desk {shown.index}
        </span>

        <h2 className="file__name">{shown.country}</h2>

        <div className="file__row">
          {shown.services.map((s) => (
            <span className="file__tag" key={s}>
              {s}
            </span>
          ))}
        </div>

        <p className="file__blurb">{shown.blurb}</p>

        <ul className="file__points">
          {shown.points.map((p, i) => (
            <li key={p}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {p}
            </li>
          ))}
        </ul>

        <div className="file__row">
          <button
            className="btn btn--fill"
            onClick={() => {
              onClose()
              setTimeout(() => scrollTo('#enquiry'), 420)
            }}
          >
            Start a file — {shown.country} <i aria-hidden="true">↗</i>
          </button>
        </div>
      </div>

      <button className="file__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  )
}
