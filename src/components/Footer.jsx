import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BRAND, NAV, NOTICE, CATALOGUE, DESTINATIONS } from '../data/site'
import { scrollTo } from '../lib/smooth'
import { OPEN_SERVICE } from '../lib/events'
import Logo from './Logo'

/**
 * The footer is a way back into the site, and the signature.
 *
 * The Contact section sits directly above it, so the footer does not repeat
 * the full contact block: it carries navigation into every part of the site —
 * sections, the three service lines, all ten destinations — one compact
 * contact column, and a wordmark outlined so it can actually be seen.
 */
export default function Footer() {
  const mark = useRef(null)
  const root = useRef(null)

  useEffect(() => {
    const el = mark.current
    if (!el) return
    const anim = gsap.fromTo(
      el,
      { letterSpacing: '0.08em', opacity: 0 },
      {
        letterSpacing: '-0.045em',
        opacity: 1,
        duration: 1.6,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 94%' },
      }
    )
    return () => anim.scrollTrigger?.kill()
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.footer__col',
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: { trigger: '.footer__top', start: 'top 88%' },
        }
      )
    }, root)
    return () => ctx.revert()
  }, [])

  const go = (e, target) => {
    e.preventDefault()
    scrollTo(target)
  }

  // open the matching catalogue line, then take the reader there
  const openService = (e, id) => {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent(OPEN_SERVICE, { detail: id }))
    scrollTo('#services')
  }

  const maps = `https://www.google.com/maps/search/${encodeURIComponent(BRAND.mapsQuery)}`

  return (
    <footer className="footer" ref={root}>
      <div className="footer__top">
        <div className="footer__col footer__brand">
          <Logo className="footer__logo" />
          <p className="footer__mission">{BRAND.mission}</p>
          <p className="footer__am am">ክፍያ ከቪዛ በኋላ የሚከፈል</p>
        </div>

        <nav className="footer__col" aria-label="Sections">
          <h4 className="footer__h">Explore</h4>
          <ul className="footer__list">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={(e) => go(e, n.href)}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="footer__col" aria-label="Services">
          <h4 className="footer__h">Services</h4>
          <ul className="footer__list">
            {CATALOGUE.map((line) => (
              <li key={line.id}>
                <a href="#services" onClick={(e) => openService(e, line.id)}>
                  {line.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#services" onClick={(e) => go(e, '.extras')}>
                Additional services
              </a>
            </li>
            <li>
              <a href={BRAND.catalogueUrl} download data-cursor="PDF">
                Catalogue (PDF) ↓
              </a>
            </li>
          </ul>
        </nav>

        <nav className="footer__col" aria-label="Destinations">
          <h4 className="footer__h">Destinations</h4>
          <ul className="footer__list">
            {DESTINATIONS.map((d) => (
              <li key={d.id}>
                <a href="#destinations" onClick={(e) => go(e, '#destinations')}>
                  {d.country}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__col">
          <h4 className="footer__h">Contact</h4>
          <ul className="footer__list">
            <li>
              <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer" data-cursor="WhatsApp">
                WhatsApp {BRAND.whatsapp}
              </a>
            </li>
            <li>
              <a href={`tel:${BRAND.phones[0].tel}`}>{BRAND.phones[0].display}</a>
            </li>
            <li>
              <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer" data-cursor="Telegram">
                Telegram
              </a>
            </li>
            <li>
              <span className="footer__plain">
                {BRAND.address}
                <br />
                {BRAND.landmark}
              </span>
            </li>
            <li>
              <a href={maps} target="_blank" rel="noreferrer" data-cursor="Map">
                Open in maps ↗
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer__wordmark" ref={mark} aria-hidden="true">
        Skyline
      </div>

      <div className="footer__base">
        <p className="footer__notice">{NOTICE}</p>
        <div className="footer__row">
          <span>
            © {new Date().getFullYear()} {BRAND.name} · {BRAND.city}
          </span>
          <span className="footer__social">
            <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </span>
          <button
            type="button"
            className="footer__up"
            onClick={() => scrollTo('body')}
            aria-label="Back to top"
            data-cursor="Top"
          >
            ↑
          </button>
        </div>
      </div>
    </footer>
  )
}
