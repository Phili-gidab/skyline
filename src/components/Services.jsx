import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SERVICES, BRAND } from '../data/site'

export default function Services() {
  const root = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.svc',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: { trigger: '.svc-list', start: 'top 80%' },
        }
      )

      gsap.fromTo(
        '.services__title .word > span',
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: '.services__title', start: 'top 85%' },
        }
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="section services" id="services" ref={root}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '2rem',
          flexWrap: 'wrap',
          marginBottom: 'clamp(2.5rem, 6vh, 4rem)',
        }}
      >
        <div>
          <span className="eyebrow">What we do</span>
          <h2
            className="services__title"
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(2.6rem, 8vw, 7rem)',
              lineHeight: 0.86,
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
              marginTop: '1.25rem',
            }}
          >
            <span className="mask">
              <span className="word" style={{ display: 'inline-block', overflow: 'hidden' }}>
                <span style={{ display: 'inline-block' }}>Six desks,</span>
              </span>
            </span>
            <span className="mask">
              <span className="word" style={{ display: 'inline-block', overflow: 'hidden' }}>
                <span className="serif-it" style={{ display: 'inline-block', color: 'var(--gold)' }}>
                  one standard
                </span>
              </span>
            </span>
          </h2>
        </div>
        <p style={{ maxWidth: '32ch', color: 'rgba(236,230,215,0.62)', fontSize: '0.98rem', lineHeight: 1.6 }}>
          Every service below runs on the same rule: the file is prepared properly, and the fee is
          settled after the visa is in your hand.
        </p>
      </div>

      <div className="svc-list">
        {SERVICES.map((s) => (
          <a
            className="svc"
            key={s.n}
            href={BRAND.telegramUrl}
            target="_blank"
            rel="noreferrer"
            data-cursor="Enquire"
          >
            <span className="svc__fill" />
            <span className="svc__n">{s.n}</span>
            <div>
              <h3 className="svc__title">{s.title}</h3>
              <span className="svc__meta">{s.meta}</span>
            </div>
            <div className="svc__body">{s.body}</div>
            <span className="svc__arrow">↗</span>
          </a>
        ))}
      </div>
    </section>
  )
}
