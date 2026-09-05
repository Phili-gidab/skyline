import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BRAND, NAV } from '../data/site'
import { scrollTo } from '../lib/smooth'
import Logo from './Logo'

/**
 * The closing section, not a sign-off strip.
 *
 * Someone who reaches the bottom either wants to get in touch or wants a way
 * back into the site, so the footer carries both: the full contact block and
 * a real set of links. The giant wordmark stays as the signature, sitting
 * under a live local clock so the page reads as somewhere real and open.
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
        scrollTrigger: { trigger: el, start: 'top 92%' },
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

  const toTop = (e) => {
    e.preventDefault()
    scrollTo('body')
  }

  return (
    <footer className="footer" ref={root}>
      <div className="footer__top">
        <div className="footer__col footer__brand">
          <Logo className="footer__logo" />
          <p className="footer__tagline">{BRAND.tagline}</p>
          <p className="footer__am am">ክፍያ ከቪዛ በኋላ የሚከፈል</p>
        </div>

        <nav className="footer__col">
          <h4 className="footer__h">Explore</h4>
          <ul className="footer__list">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollTo(n.href)
                  }}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__col">
          <h4 className="footer__h">The office</h4>
          <ul className="footer__list">
            <li>
              <span className="footer__plain">{BRAND.address}</span>
            </li>
            <li>
              <span className="footer__plain">
                {BRAND.city}, {BRAND.country}
              </span>
            </li>
            <li>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(
                  `${BRAND.address}, ${BRAND.city}`
                )}`}
                target="_blank"
                rel="noreferrer"
                data-cursor="Map"
              >
                Open in maps ↗
              </a>
            </li>
          </ul>
        </div>

        <div className="footer__col">
          <h4 className="footer__h">Talk to us</h4>
          <ul className="footer__list">
            {BRAND.phones.map((p) => (
              <li key={p}>
                <a href={`tel:${p.replace(/\s/g, '')}`}>{p}</a>
              </li>
            ))}
            <li>
              <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer" data-cursor="Telegram">
                @{BRAND.telegram}
              </a>
            </li>
            <li>
              <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer__wordmark" ref={mark} aria-hidden="true">
        Skyline
      </div>

      <div className="footer__row">
        <span>
          © {new Date().getFullYear()} {BRAND.name}
        </span>
        <span className="footer__social">
          <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
            Telegram
          </a>
          <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href={`mailto:${BRAND.email}`}>Email</a>
        </span>
        <a className="footer__top-link" href="#top" onClick={toTop} data-cursor="Top">
          Back to top ↑
        </a>
      </div>
    </footer>
  )
}
