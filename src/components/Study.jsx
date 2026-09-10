import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SCHOLARSHIP, BRAND } from '../data/site'

export default function Study() {
  const root = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.tier',
        { x: 30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: '.tiers', start: 'top 82%' },
        }
      )

      gsap.fromTo(
        '.ptable tbody tr',
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: { trigger: '.ptable', start: 'top 85%' },
        }
      )

      gsap.fromTo(
        '.study__title',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.study__head', start: 'top 85%' },
        }
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="study" id="study" ref={root}>
      <div className="study__head">
        <div>
          <span className="eyebrow">Study abroad</span>
          <h2 className="study__title">
            Connecticut,
            <br />
            <em>on scholarship</em>
          </h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(1.4rem, 3vw, 2.4rem)',
              lineHeight: 1.05,
            }}
          >
            {SCHOLARSHIP.school}
          </div>
          <div className="label" style={{ marginTop: '0.4rem' }}>
            {SCHOLARSHIP.location} — {SCHOLARSHIP.founded}
          </div>
          <div className="study__stamp">
            <span className="dot" />
            {SCHOLARSHIP.intake}
          </div>
        </div>
      </div>

      <div className="study__grid">
        <div>
          <h3 className="label" style={{ marginBottom: '1.5rem' }}>
            Programmes and tuition
          </h3>
          <table className="ptable">
            <thead>
              <tr>
                <th>Level</th>
                <th className="num">Listed fee</th>
                <th className="num">After scholarship</th>
              </tr>
            </thead>
            <tbody>
              {SCHOLARSHIP.programs.map((p) => (
                <tr key={p.level}>
                  <td>{p.level}</td>
                  <td className="strike">{p.fee}</td>
                  <td>{p.after}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p
            style={{
              marginTop: '2rem',
              maxWidth: '46ch',
              lineHeight: 1.7,
              color: 'rgba(6,19,13,0.7)',
              fontSize: '0.98rem',
            }}
          >
            No application fee. No I-20 fee. SEVIS fee credit applied. We prepare the admission file,
            negotiate the award, and coach you through the F-1 interview.
          </p>

          <a
            href={BRAND.telegramUrl}
            target="_blank"
            rel="noreferrer"
            data-cursor="Apply"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginTop: '1.75rem',
              borderBottom: '1px solid currentColor',
              paddingBottom: '0.3rem',
              fontFamily: 'var(--mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--moss)',
            }}
          >
            Start an application ↗
          </a>
        </div>

        <div className="tiers">
          <h3 className="label" style={{ marginBottom: '1.25rem' }}>
            Merit award by high-school GPA
          </h3>
          {SCHOLARSHIP.tiers.map((t) => (
            <div className="tier" key={t.gpa}>
              <span className="tier__gpa">GPA {t.gpa}</span>
              <span className="tier__award">{t.award}</span>
            </div>
          ))}
          <p
            style={{
              marginTop: '1.25rem',
              fontSize: '0.8rem',
              lineHeight: 1.6,
              color: 'rgba(6,19,13,0.55)',
            }}
          >
            Undergraduate merit scholarships are assessed on high-school GPA. Postgraduate awards are
            a flat $2,500 across MBA and MS programmes.
          </p>
        </div>
      </div>
    </section>
  )
}
