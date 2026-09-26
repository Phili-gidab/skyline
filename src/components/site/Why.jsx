import React from 'react'
import { WHY } from '../../data/site'
import { Shield } from './Icons'

export default function Why() {
  return (
    <section className="section" id="why">
      <div className="wrap">
        <div className="section__head section__head--center">
          <span className="eyebrow">Why Skyline</span>
          <h2 className="section__title">Why clients choose our office</h2>
        </div>

        <div className="why">
          {WHY.map((w) => (
            <div className="why__item" key={w.title}>
              <Shield />
              <div>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
