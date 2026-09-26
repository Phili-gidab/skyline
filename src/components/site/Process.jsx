import React from 'react'
import { PROCESS } from '../../data/site'

export default function Process() {
  return (
    <section className="section section--tint" id="process">
      <div className="wrap">
        <div className="section__head section__head--center">
          <span className="eyebrow">How it works</span>
          <h2 className="section__title">A clear process, from first call to departure</h2>
          <p className="section__text">
            The same steps every time, whichever visa you are applying for. You are told what is
            happening at each stage.
          </p>
        </div>

        <div className="steps">
          {PROCESS.map((s) => (
            <div className="step" key={s.n}>
              <b>{s.n}</b>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
