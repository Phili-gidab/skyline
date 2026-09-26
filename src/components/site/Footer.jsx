import React from 'react'
import { BRAND, CATALOGUE, NAV, NOTICE } from '../../data/site'

export default function Footer() {
  const year = new Date().getFullYear()
  const go = (e, href) => {
    e.preventDefault()
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr__grid">
          <div>
            <div className="ftr__logo">
              <img src="/logo-lockup.svg" alt="Skyline Travel Solution" />
            </div>
            <p className="ftr__about">{BRAND.mission}</p>
            <div className="ftr__social">
              <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                WA
              </a>
              <a href={BRAND.telegramUrl} target="_blank" rel="noreferrer" aria-label="Telegram">
                TG
              </a>
              <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram">
                IG
              </a>
            </div>
          </div>

          <div className="ftr__col">
            <h4>Services</h4>
            <ul>
              {CATALOGUE.map((c) => (
                <li key={c.id}>
                  <a href="#services" onClick={(e) => go(e, '#services')}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="ftr__col">
            <h4>Company</h4>
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} onClick={(e) => go(e, n.href)}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="ftr__col">
            <h4>Contact</h4>
            <ul>
              <li>{BRAND.address}</li>
              <li>{BRAND.landmark}</li>
              {BRAND.phones.map((p) => (
                <li key={p.tel}>
                  <a href={`tel:${p.tel}`}>{p.display}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="ftr__notice">{NOTICE}</p>

        <div className="ftr__base">
          <span>
            © {year} {BRAND.name}. All rights reserved.
          </span>
          <a href={BRAND.catalogueUrl} target="_blank" rel="noreferrer">
            Service catalogue (PDF)
          </a>
        </div>
      </div>
    </footer>
  )
}
