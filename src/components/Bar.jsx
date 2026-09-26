import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BRAND, NAV, DESTINATIONS, photoSrc } from '../data/site'
import { scrollTo } from '../lib/smooth'
import Logo from './Logo'

/* The bar, and the takeover behind it.
 *
 * The menu is not a dropdown: it covers the screen, the links arrive one
 * after another, and hovering one brings up the photograph it leads to.
 */
export default function Bar() {
  const [open, setOpen] = useState(false)
  const [peek, setPeek] = useState(null)
  const barRef = useRef(null)
  const menuRef = useRef(null)

  /* The bar stays put. Hiding it on scroll-down is standard, but the stage is
     pinned — you scroll down the whole time you are moving sideways, so the bar
     would be gone for most of the site. */
  useEffect(() => {
    const onScroll = () => {
      const el = barRef.current
      if (!el) return
      el.classList.toggle('is-set', window.scrollY > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [open])

  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const links = el.querySelectorAll('.menu__link span')
    const ctx = gsap.context(() => {
      if (open) {
        document.body.classList.add('is-locked')
        window.__lenis?.stop()
        gsap
          .timeline({ defaults: { ease: 'expo.out' } })
          .set(el, { pointerEvents: 'auto' })
          .fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.8 })
          .fromTo(links, { yPercent: 118 }, { yPercent: 0, duration: 0.9, stagger: 0.05 }, '-=0.45')
          .fromTo('.menu__side > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05 }, '-=0.6')
      } else {
        document.body.classList.remove('is-locked')
        window.__lenis?.start()
        gsap.to(el, {
          clipPath: 'inset(0 0 100% 0)',
          duration: 0.55,
          ease: 'expo.in',
          onComplete: () => gsap.set(el, { pointerEvents: 'none' }),
        })
      }
    }, el)
    return () => ctx.revert()
  }, [open])

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const go = (href) => {
    setOpen(false)
    setTimeout(() => scrollTo(href), open ? 420 : 0)
  }

  return (
    <>
      <header className={`bar${open ? ' is-over' : ''}`} ref={barRef}>
        <button className="bar__brand" onClick={() => go('#top')} aria-label="Skyline, top of page">
          <Logo variant="compact" tone="light" className="bar__logo" />
        </button>

        <nav className="bar__links">
          {NAV.map((item) => (
            <button key={item.href} className="bar__link" onClick={() => go(item.href)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="bar__right">
          <a className="bar__call" href={`tel:${BRAND.phones[0].tel}`}>
            {BRAND.phones[0].display}
          </a>
          <button
            className={`bar__menu${open ? ' is-open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span>{open ? 'Close' : 'Menu'}</span>
            <i aria-hidden="true">
              <b />
              <b />
            </i>
          </button>
        </div>
      </header>

      <div className="menu" ref={menuRef} style={{ clipPath: 'inset(0 0 100% 0)', pointerEvents: 'none' }}>
        <nav className="menu__list">
          {NAV.map((item, i) => (
            <button
              key={item.href}
              className="menu__link"
              onClick={() => go(item.href)}
              onMouseEnter={() => setPeek(DESTINATIONS[i % DESTINATIONS.length])}
              onMouseLeave={() => setPeek(null)}
            >
              <span>
                <em>{String(i + 1).padStart(2, '0')}</em>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="menu__side">
          <div>
            <span className="label">The office</span>
            <p>
              {BRAND.address}
              <br />
              {BRAND.landmark}
            </p>
          </div>
          <div>
            <span className="label">Reach us</span>
            <p>
              {BRAND.phones.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`}>
                  {p.display}
                  <br />
                </a>
              ))}
              <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              {' · '}
              <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
                Telegram
              </a>
            </p>
          </div>
          <p className="menu__say">{BRAND.tagline}</p>
        </div>

        <div
          className={`menu__peek${peek ? ' is-on' : ''}`}
          style={peek ? { '--lqip': `url("${photoSrc(peek.photo, 48)}")` } : undefined}
          aria-hidden="true"
        >
          {peek && (
            <img
              src={photoSrc(peek.photo, 800)}
              alt=""
              decoding="async"
              onLoad={(e) => e.currentTarget.classList.add('is-in')}
            />
          )}
        </div>
      </div>
    </>
  )
}
