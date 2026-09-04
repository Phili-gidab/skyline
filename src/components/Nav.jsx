import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BRAND, NAV } from '../data/site'
import { scrollTo } from '../lib/smooth'
import Logo from './Logo'

export default function Nav({ ready }) {
  const navRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [onLight, setOnLight] = useState(false)

  // hide on scroll down, reveal on scroll up
  useEffect(() => {
    if (!ready) return
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const el = navRef.current
      if (!el) return
      if (y > last && y > 300 && !open) el.classList.add('is-hidden')
      else el.classList.remove('is-hidden')
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [ready, open])

  /* The nav used mix-blend-mode: difference to stay readable on any ground.
     That works for text but not for a coloured logo — the brand green came
     out magenta over the cream Study section. It now swaps to an explicit
     light state instead, which is predictable and keeps the mark on-brand. */
  useEffect(() => {
    if (!ready) return
    const light = document.querySelector('.study')
    const el = navRef.current
    if (!light || !el) return

    const st = ScrollTrigger.create({
      trigger: light,
      start: 'top 72px',
      end: 'bottom 72px',
      onToggle: (self) => setOnLight(self.isActive),
    })
    return () => st.kill()
  }, [ready])

  // entrance
  useEffect(() => {
    if (!ready || !navRef.current) return
    gsap.fromTo(
      navRef.current,
      { y: -40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.25 }
    )
  }, [ready])

  // overlay menu
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const links = el.querySelectorAll('.menu__list a')

    if (open) {
      document.body.classList.add('is-locked')
      gsap
        .timeline()
        .to(el, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'expo.inOut' })
        .fromTo(
          links,
          { yPercent: 110, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' },
          '-=0.4'
        )
    } else {
      document.body.classList.remove('is-locked')
      gsap.to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.6, ease: 'expo.inOut' })
    }
  }, [open])

  const go = (e, href) => {
    e.preventDefault()
    setOpen(false)
    setTimeout(() => scrollTo(href), open ? 450 : 0)
  }

  return (
    <>
      <header className={`nav ${onLight ? 'is-light' : ''}`} ref={navRef} style={{ opacity: 0 }}>
        <a className="nav__logo" href="#top" onClick={(e) => go(e, 'body')} data-cursor="Top">
          {/* the tagline is dropped at nav size: it is unreadable below ~150px */}
          <Logo variant="compact" tone={onLight ? 'dark' : 'light'} className="nav__logo-img" />
        </a>

        <nav className="nav__links">
          {NAV.map((n) => (
            <a key={n.href} className="nav__link" href={n.href} onClick={(e) => go(e, n.href)}>
              {n.label}
            </a>
          ))}
          <a
            className="nav__cta"
            href={BRAND.telegramUrl}
            target="_blank"
            rel="noreferrer"
            data-cursor="Telegram"
          >
            Apply now
          </a>
        </nav>

        <button
          className={`nav__burger ${open ? 'is-open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <span />
          <span />
        </button>
      </header>

      <div className="menu" ref={menuRef} style={{ clipPath: 'inset(0 0 100% 0)' }}>
        <div className="menu__list">
          {NAV.map((n) => (
            <div className="mask" key={n.href}>
              <a href={n.href} onClick={(e) => go(e, n.href)}>
                {n.label}
              </a>
            </div>
          ))}
        </div>
        <div className="menu__foot">
          <span className="label">Get in touch</span>
          <a href={`tel:${BRAND.phones[0].replace(/\s/g, '')}`}>{BRAND.phones[0]}</a>
          <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
            @{BRAND.telegram}
          </a>
          <span className="label" style={{ marginTop: '0.75rem' }}>
            {BRAND.address}
          </span>
        </div>
      </div>
    </>
  )
}
