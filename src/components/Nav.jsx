import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BRAND, NAV } from '../data/site'
import { scrollTo } from '../lib/smooth'
import { NAV_TONE } from '../lib/events'
import Logo from './Logo'

export default function Nav({ ready }) {
  const navRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  // what is under the bar: the page is white, so the bar is dark by default
  const [flyoverDark, setFlyoverDark] = useState(false)
  const [regionDark, setRegionDark] = useState(false)
  const onDark = open || flyoverDark || regionDark

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
      el.classList.toggle('is-scrolled', y > 24)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [ready, open])

  /* The nav used mix-blend-mode: difference to stay readable on any ground.
     That works for text but not for a coloured logo — the brand green came
     out magenta. It carries an explicit state instead, which is predictable
     and keeps the mark on-brand.

     The site is white, so the bar is dark ink by default and turns light only
     over the deep emerald ground: any region marked data-nav="dark" (the
     footer), and the Study fly-over, which says so itself with NAV_TONE
     because its ground gives way to white partway through its pin. */
  useEffect(() => {
    const onTone = (e) => setFlyoverDark(e.detail === 'dark')
    window.addEventListener(NAV_TONE, onTone)
    return () => window.removeEventListener(NAV_TONE, onTone)
  }, [])

  useEffect(() => {
    if (!ready) return
    const active = new Set()
    const triggers = [...document.querySelectorAll('[data-nav="dark"]')].map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top 72px',
        end: 'bottom 72px',
        onToggle: (self) => {
          if (self.isActive) active.add(el)
          else active.delete(el)
          setRegionDark(active.size > 0)
        },
      })
    )
    return () => triggers.forEach((t) => t.kill())
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
      <header className={`nav ${onDark ? 'is-dark' : ''}`} ref={navRef} style={{ opacity: 0 }}>
        <a className="nav__logo" href="#top" onClick={(e) => go(e, 'body')} data-cursor="Top">
          {/* the tagline is dropped at nav size: it is unreadable below ~150px */}
          <Logo variant="compact" tone={onDark ? 'light' : 'dark'} className="nav__logo-img" />
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
          <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
            WhatsApp {BRAND.whatsapp}
          </a>
          <a href={`tel:${BRAND.phones[0].tel}`}>{BRAND.phones[0].display}</a>
          <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
            @{BRAND.telegram}
          </a>
          <span className="label" style={{ marginTop: '0.75rem' }}>
            {BRAND.address} — {BRAND.landmark}
          </span>
        </div>
      </div>
    </>
  )
}
