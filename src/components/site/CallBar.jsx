import React from 'react'
import { BRAND } from '../../data/site'
import { Phone, Chat } from './Icons'

/* On a phone the two things people actually want are pinned to the bottom. */
export default function CallBar() {
  return (
    <div className="callbar">
      <a href={`tel:${BRAND.phones[0].tel}`}>
        <Phone width={18} height={18} /> Call the office
      </a>
      <a className="callbar__wa" href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">
        <Chat width={18} height={18} /> WhatsApp
      </a>
    </div>
  )
}
