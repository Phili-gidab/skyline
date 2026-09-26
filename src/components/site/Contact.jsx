import React from 'react'
import { BRAND } from '../../data/site'
import EnquiryForm from '../forms/EnquiryForm'
import { Pin, Phone, Chat, Clock } from './Icons'

export default function Contact() {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BRAND.mapsQuery)}`

  return (
    <section className="section section--tint" id="contact">
      <div className="wrap">
        <div className="section__head section__head--center">
          <span className="eyebrow">Contact us</span>
          <h2 className="section__title">Book a free consultation</h2>
          <p className="section__text">
            Visit the office, call us, or send your details and we will call you back.
          </p>
        </div>

        <div className="contact">
          <div className="contact__card">
            <div className="info">
              <div className="info__row">
                <Pin />
                <div>
                  <h3>Office</h3>
                  <a href={maps} target="_blank" rel="noreferrer">
                    {BRAND.address}
                    <br />
                    {BRAND.landmark}, {BRAND.city}
                  </a>
                </div>
              </div>

              <div className="info__row">
                <Phone />
                <div>
                  <h3>Telephone</h3>
                  {BRAND.phones.map((p) => (
                    <a key={p.tel} href={`tel:${p.tel}`}>
                      {p.display}
                    </a>
                  ))}
                </div>
              </div>

              <div className="info__row">
                <Chat />
                <div>
                  <h3>Message</h3>
                  <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
                    WhatsApp {BRAND.whatsapp}
                  </a>
                  <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
                    Telegram @{BRAND.telegram}
                  </a>
                  <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
                    Instagram @{BRAND.instagram}
                  </a>
                </div>
              </div>

              <div className="info__row">
                <Clock />
                <div>
                  <h3>Opening hours</h3>
                  {BRAND.hours.map((h) => (
                    <p key={h}>{h}</p>
                  ))}
                  <p className="info__note">{BRAND.hoursNote}</p>
                </div>
              </div>

              <p className="amharic">ክፍያ ከቪዛ በኋላ የሚከፈል</p>
            </div>
          </div>

          <div className="contact__card">
            <h3 style={{ marginBottom: '0.35rem' }}>Send an enquiry</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '1.1rem' }}>
              We reply by phone or email, usually the same working day.
            </p>
            <EnquiryForm />
          </div>
        </div>
      </div>
    </section>
  )
}
