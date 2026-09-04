import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BRAND } from '../data/site'
import Logo from './Logo'

export default function Footer() {
  const mark = useRef(null)

  useEffect(() => {
    const el = mark.current
    if (!el) return
    const anim = gsap.fromTo(
      el,
      { letterSpacing: '0.06em', opacity: 0 },
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

  return (
    <footer className="footer">
      {/* the one place the tagline is set large enough to read */}
      <Logo className="footer__logo" />

      <div className="footer__wordmark" ref={mark}>
        Skyline
      </div>

      <div className="footer__row">
        <span>
          © {new Date().getFullYear()} {BRAND.name}
        </span>
        <span>{BRAND.address}</span>
        <span>
          <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
            Telegram
          </a>
          {' / '}
          <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
            Instagram
          </a>
          {' / '}
          <a href={`mailto:${BRAND.email}`}>Email</a>
        </span>
        <span>{BRAND.tagline}</span>
      </div>

    </footer>
  )
}
