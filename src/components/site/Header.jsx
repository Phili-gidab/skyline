import React, { useEffect, useState } from 'react'
import { BRAND, NAV } from '../../data/site'
import { Phone } from './Icons'

export default function Header() {
  const [stuck, setStuck] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (e, href) => {
    e.preventDefault()
    setOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <header className={`hdr${stuck ? ' is-stuck' : ''}`}>
      <div className="wrap hdr__in">
        <a className="hdr__logo" href="#top" onClick={(e) => go(e, '#top')}>
          <img src="/logo-lockup-color.svg" alt="Skyline Travel Solution" />
        </a>

        <nav className="hdr__nav">
          {NAV.map((n) => (
            <a key={n.href} className="hdr__link" href={n.href} onClick={(e) => go(e, n.href)}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hdr__right">
          <a className="hdr__phone" href={`tel:${BRAND.phones[0].tel}`}>
            <span>
              <Phone width={18} height={18} />
            </span>
            {BRAND.phones[0].display}
          </a>
          <a className="btn btn--solid btn--sm" href="#apply" onClick={(e) => go(e, '#apply')}>
            Apply now
          </a>
          <button
            className={`hdr__burger${open ? ' is-open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <b />
            <b />
            <b />
          </button>
        </div>
      </div>

      <div className={`hdr__mobile${open ? ' is-open' : ''}`}>
        {NAV.map((n) => (
          <a key={n.href} href={n.href} onClick={(e) => go(e, n.href)}>
            {n.label}
          </a>
        ))}
        <a className="btn btn--solid" href={`tel:${BRAND.phones[0].tel}`}>
          Call {BRAND.phones[0].display}
        </a>
      </div>
    </header>
  )
}
