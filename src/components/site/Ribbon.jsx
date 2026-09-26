import React from 'react'
import { DESTINATIONS } from '../../data/site'

/* A slow ribbon of the destinations, doubled so it can loop without a seam.
   Paused on hover, and still for anyone who asks for reduced motion. */
export default function Ribbon() {
  const items = [...DESTINATIONS, ...DESTINATIONS]

  return (
    <div className="ribbon" aria-hidden="true">
      <div className="ribbon__track">
        {items.map((d, i) => (
          <span className="ribbon__item" key={`${d.id}-${i}`}>
            <b>{d.iata}</b>
            {d.country}
            <i>✦</i>
          </span>
        ))}
      </div>
    </div>
  )
}
