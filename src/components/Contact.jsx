import React from 'react'
import { BRAND } from '../data/site'
import EnquiryForm from './forms/EnquiryForm'

/* The last plate: where the office is, how to reach it, and the form that
 * opens a file without anyone having to walk in first.
 */
export default function Contact() {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BRAND.mapsQuery)}`

  return (
    <section className="section contact" id="contact">
      <div className="section__head">
        <div>
          <span className="section__no">07 — Contact</span>
          <h2 className="section__title">
            Tell us where
            <br />
            you are going
          </h2>
        </div>
        <p className="section__aside">
          Leave your number and a consultant will call you back, usually the same working day. You
          can also message us or walk into the office.
        </p>
      </div>

      <div className="contact__grid">
        <div className="contact__details">
          <div className="detail">
            <span className="label">Office</span>
            <a href={maps} target="_blank" rel="noreferrer">
              {BRAND.address}
              <br />
              {BRAND.landmark}, {BRAND.city}
            </a>
          </div>

          <div className="detail">
            <span className="label">Telephone</span>
            <ul>
              {BRAND.phones.map((p) => (
                <li key={p.tel}>
                  <a href={`tel:${p.tel}`}>{p.display}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="detail">
            <span className="label">Message</span>
            <ul>
              <li>
                <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
                  WhatsApp {BRAND.whatsapp}
                </a>
              </li>
              <li>
                <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
                  Telegram @{BRAND.telegram}
                </a>
              </li>
              <li>
                <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
                  Instagram @{BRAND.instagram}
                </a>
              </li>
            </ul>
          </div>

          <div className="detail">
            <span className="label">Hours</span>
            <ul>
              {BRAND.hours.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <p className="detail__note">{BRAND.hoursNote}</p>
          </div>

          <p className="contact__amharic">ክፍያ ከቪዛ በኋላ የሚከፈል</p>
        </div>

        <div className="contact__form" id="enquiry">
          <h3 className="label">Open a file online</h3>
          <EnquiryForm />
        </div>
      </div>
    </section>
  )
}
