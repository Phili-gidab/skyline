import React from 'react'
import { SCHOLARSHIP } from '../data/site'
import StudyForm from './forms/StudyForm'
import { scrollTo } from '../lib/smooth'

/* The study offer, set as an offer sheet: the award ladder, what each
 * programme costs before and after it, and the form that starts the file.
 */
export default function StudyOffer() {
  const s = SCHOLARSHIP
  const top = s.tiers?.[0]

  return (
    <section className="section study" id="study">
      <div className="section__head">
        <div>
          <span className="section__no">05 — Study abroad</span>
          <h2 className="section__title">
            {s.school}
            <br />
            on scholarship
          </h2>
        </div>
        <p className="section__aside">
          {s.location} · {s.founded} · {s.intake}. We prepare the admission file, negotiate the
          award and coach you through the F‑1 interview.
        </p>
      </div>

      <div className="study__grid">
        <div className="study__awards">
          <h3 className="label">Merit award by high-school GPA</h3>
          <ul className="ladder">
            {s.tiers.map((t) => (
              <li key={t.gpa}>
                <span className="ladder__gpa">{t.gpa}</span>
                <span className="ladder__bar" style={{ '--w': `${(parseInt(t.award.replace(/\D/g, ''), 10) / parseInt(top.award.replace(/\D/g, ''), 10)) * 100}%` }} />
                <span className="ladder__award">{t.award}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="study__fees">
          <h3 className="label">Programmes and tuition</h3>
          <table className="fees">
            <thead>
              <tr>
                <th>Level</th>
                <th>Listed</th>
                <th>After award</th>
              </tr>
            </thead>
            <tbody>
              {s.programs.map((p) => (
                <tr key={p.level}>
                  <td>{p.level}</td>
                  <td className="fees__was">{p.fee}</td>
                  <td className="fees__now">{p.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="study__zeros">
            <li>
              <b>$0</b> application fee
            </li>
            <li>
              <b>$0</b> I‑20 fee
            </li>
            <li>
              <b>1‑1</b> interview coaching
            </li>
          </ul>
          <button className="btn btn--solid" onClick={() => scrollTo('#study-apply')}>
            Apply online <i>↗</i>
          </button>
        </div>
      </div>

      <div className="study__apply" id="study-apply">
        <div>
          <h3 className="statement">Start the application</h3>
          <p className="prose">
            Send your level and intake and we will come back with the documents needed for the
            admission file.
          </p>
        </div>
        <StudyForm />
      </div>
    </section>
  )
}
