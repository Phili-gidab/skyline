import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BRAND } from '../data/site'
import { useMagnetic } from '../lib/useMagnetic'

/* Contact details follow the client's own "Contact us" block and service
   catalogue exactly — address, three landlines, WhatsApp and Telegram. */

export default function Contact() {
  const root = useRef(null)
  const { ref: magRef, innerRef } = useMagnetic({ strength: 0.35, innerStrength: 0.18 })

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.contact__big .word > span',
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 1.3,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: '.contact__big', start: 'top 85%' },
        }
      )

      gsap.fromTo(
        '.contact__col',
        { y: 34, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: '.contact__row', start: 'top 88%' },
        }
      )
    }, root)

    return () => ctx.revert()
  }, [])

  const maps = `https://www.google.com/maps/search/${encodeURIComponent(BRAND.mapsQuery)}`

  return (
    <section className="contact" id="contact" ref={root}>
      <span className="eyebrow" style={{ marginBottom: '2rem' }}>
        Contact us
      </span>

      <h2 className="contact__big">
        <span className="word" style={{ display: 'inline-block', overflow: 'hidden' }}>
          <span style={{ display: 'inline-block' }}>You belong</span>
        </span>
        <br />
        <span className="word" style={{ display: 'inline-block', overflow: 'hidden' }}>
          <span style={{ display: 'inline-block' }}>
            <em>everywhere</em>
          </span>
        </span>
      </h2>

      <div className="contact__cta-row">
        <div>
          <p className="contact__cta-copy">
            Walk into the office on Bole Road, in front of the Awaris Hotel, or send a message on
            WhatsApp or Telegram and we will open a file today. Nothing is payable until your visa is
            approved.
          </p>
          <p className="contact__cta-copy am" style={{ marginTop: '1rem', color: 'var(--gold)' }}>
            ክፍያ ከቪዛ በኋላ የሚከፈል
          </p>
          <a
            className="contact__alt"
            href={BRAND.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            data-cursor="WhatsApp"
          >
            WhatsApp {BRAND.whatsapp} ↗
          </a>
        </div>

        <a
          className="magnet"
          ref={magRef}
          href={BRAND.telegramUrl}
          target="_blank"
          rel="noreferrer"
          data-cursor="Telegram"
        >
          <span className="magnet__inner" ref={innerRef}>
            <span>Apply</span>
            <span>Now ↗</span>
          </span>
        </a>
      </div>

      <div className="contact__row">
        <div className="contact__col">
          <h4>Call the office</h4>
          {BRAND.phones.map((p) => (
            <a key={p.tel} href={`tel:${p.tel}`}>
              {p.display}
            </a>
          ))}
        </div>

        <div className="contact__col">
          <h4>Message</h4>
          <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer" data-cursor="WhatsApp">
            WhatsApp {BRAND.whatsapp}
          </a>
          <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer" data-cursor="Telegram">
            Telegram @{BRAND.telegram}
          </a>
        </div>

        <div className="contact__col">
          <h4>Visit</h4>
          <p>{BRAND.address}</p>
          <p>{BRAND.landmark}</p>
          <p>
            {BRAND.city}, {BRAND.country}
          </p>
          <a
            href={maps}
            target="_blank"
            rel="noreferrer"
            data-cursor="Map"
            style={{ marginTop: '0.5rem', color: 'var(--gold)' }}
          >
            Open in maps ↗
          </a>
        </div>

        <div className="contact__col">
          {/* TODO: confirm real opening hours with the office and replace. */}
          <h4>Office hours</h4>
          <p>Monday — Saturday</p>
          <p>Walk in, or book ahead on WhatsApp</p>
          <p style={{ color: 'var(--sage)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Messages are answered outside office hours.
          </p>
        </div>
      </div>
    </section>
  )
}
