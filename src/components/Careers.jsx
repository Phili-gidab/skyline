import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ROLES, BRAND } from '../data/site'

export default function Careers() {
  const root = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.role',
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: '.careers__grid', start: 'top 82%' },
        }
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="careers" id="careers" ref={root}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '2rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span className="eyebrow">We are hiring</span>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(2.4rem, 7vw, 6rem)',
              lineHeight: 0.88,
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
              marginTop: '1.25rem',
            }}
          >
            Join the
            <br />
            <span className="serif-it" style={{ color: 'var(--gold)' }}>
              team
            </span>
          </h2>
        </div>
        <p
          style={{
            maxWidth: '32ch',
            color: 'rgba(236,230,215,0.62)',
            fontSize: '0.98rem',
            lineHeight: 1.6,
          }}
        >
          Our team is expanding. Send a CV and a motivational letter to{' '}
          <a href={`mailto:${BRAND.email}`} style={{ color: 'var(--bone)', borderBottom: '1px solid var(--gold)' }}>
            {BRAND.email}
          </a>{' '}
          or reach us on Telegram.
        </p>
      </div>

      <div className="careers__grid">
        {ROLES.map((r) => (
          <a
            className="role"
            key={r.title}
            href={`mailto:${BRAND.email}?subject=${encodeURIComponent(`Application — ${r.title}`)}`}
            data-cursor="Apply"
          >
            <div>
              <span className="label">{r.type}</span>
              <h3 className="role__title" style={{ marginTop: '0.85rem' }}>
                {r.title}
              </h3>
            </div>
            <p className="role__body">{r.body}</p>
            <span className="role__apply">Send your CV ↗</span>
          </a>
        ))}
      </div>
    </section>
  )
}
