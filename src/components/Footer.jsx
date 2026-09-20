import React from 'react'
import { BRAND, CATALOGUE, DESTINATIONS, NOTICE } from '../data/site'
import { OPEN_SERVICE } from '../lib/events'
import { scrollTo } from '../lib/smooth'
import Logo from './Logo'

export default function Footer() {
  const year = new Date().getFullYear()

  const openLine = (id) => {
    window.dispatchEvent(new CustomEvent(OPEN_SERVICE, { detail: id }))
    scrollTo('#services')
  }

  return (
    <footer className="foot" data-nav="dark">
      <div className="foot__top">
        <Logo variant="compact" tone="light" className="foot__logo" />
        <p className="foot__say statement">{BRAND.tagline}</p>
      </div>

      <div className="foot__cols">
        <div className="foot__col">
          <span className="label">Service lines</span>
          <ul>
            {CATALOGUE.map((c) => (
              <li key={c.id}>
                <button onClick={() => openLine(c.id)}>{c.title}</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="foot__col">
          <span className="label">Desks</span>
          <ul className="foot__desks">
            {DESTINATIONS.map((d) => (
              <li key={d.id}>
                <button onClick={() => scrollTo('#destinations')}>{d.country}</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="foot__col">
          <span className="label">Office</span>
          <ul>
            <li>{BRAND.address}</li>
            <li>{BRAND.landmark}</li>
            <li>
              {BRAND.city}, {BRAND.country}
            </li>
          </ul>
        </div>

        <div className="foot__col">
          <span className="label">Reach us</span>
          <ul>
            {BRAND.phones.map((p) => (
              <li key={p.tel}>
                <a href={`tel:${p.tel}`}>{p.display}</a>
              </li>
            ))}
            <li>
              <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </li>
            <li>
              <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer">
                Telegram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <p className="foot__notice">{NOTICE}</p>

      <div className="foot__base">
        <span className="label">
          © {year} {BRAND.name}
        </span>
        <a className="label" href={BRAND.catalogueUrl} target="_blank" rel="noreferrer">
          Service catalogue (PDF)
        </a>
      </div>
    </footer>
  )
}
