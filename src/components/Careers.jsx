import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ROLES, BRAND } from '../data/site'

/**
 * Open roles as boarding passes: a cream ticket with the position, terms and
 * requirements, and a tear-off stub carrying the one action — send a CV.
 *
 * The route reads ADD -> 704 because that is where the job is: Addis Ababa,
 * Office 704 on Bole Road.
 */

function Pass({ role, index }) {
  const code = `SKY ${String(index + 1).padStart(3, '0')}`
  const mail = `mailto:${BRAND.email}?subject=${encodeURIComponent(`Application — ${role.title}`)}`

  return (
    <article className="pass">
      <div className="pass__main">
        <div className="pass__top">
          <span>{BRAND.name}</span>
          <b>Boarding pass · Now hiring</b>
        </div>

        <div className="pass__route" aria-hidden="true">
          <div>
            <div className="pass__iata">ADD</div>
            <div className="pass__place">{BRAND.city}</div>
          </div>
          <div className="pass__line" />
          <div className="pass__to">
            <div className="pass__iata">704</div>
            <div className="pass__place">Office 704, Bole Road</div>
          </div>
        </div>

        <h3 className="pass__title">{role.title}</h3>

        <dl className="pass__fields">
          <div className="pass__field">
            <dt>Terms</dt>
            <dd>{role.type}</dd>
          </div>
          <div className="pass__field">
            <dt>Location</dt>
            <dd>{BRAND.address}</dd>
          </div>
          <div className="pass__field pass__field--wide">
            <dt>Requirements</dt>
            <dd>{role.body}</dd>
          </div>
        </dl>
      </div>

      <div className="pass__stub">
        <div>
          <div className="pass__code">{code}</div>
          <div className="pass__barcode" aria-hidden="true" />
        </div>
        <a className="pass__cta" href={mail} data-cursor="Apply">
          Send your CV ↗
        </a>
      </div>
    </article>
  )
}

export default function Careers() {
  const root = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.pass',
        { y: 60, opacity: 0, rotate: -1.2 },
        {
          y: 0,
          opacity: 1,
          rotate: 0,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.14,
          scrollTrigger: { trigger: '.passes', start: 'top 82%' },
        }
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="careers" id="careers" ref={root}>
      <div className="careers__head">
        <div>
          <span className="eyebrow">We are hiring</span>
          <h2 className="careers__title">
            Join the
            <br />
            <span className="serif-it">team</span>
          </h2>
        </div>
        <p className="careers__intro">
          Our team is expanding. Send a CV and a motivational letter to{' '}
          <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>, or reach us on{' '}
          <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
            Telegram
          </a>
          .
        </p>
      </div>

      <div className="passes">
        {ROLES.map((r, i) => (
          <Pass key={r.title} role={r} index={i} />
        ))}
      </div>
    </section>
  )
}
