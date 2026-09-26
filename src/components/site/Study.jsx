import React from 'react'
import { SCHOLARSHIP, DESTINATIONS, photoSrc } from '../../data/site'
import StudyForm from '../forms/StudyForm'

export default function Study() {
  const s = SCHOLARSHIP
  const photo = DESTINATIONS.find((d) => d.iata === 'JFK') || DESTINATIONS[5]

  return (
    <section className="section section--tint" id="study">
      <div className="wrap">
        <div className="study">
          <div className="study__body">
            <span className="eyebrow">Study abroad</span>
            <h2>
              {s.school}, {s.location}
            </h2>
            <p>
              {s.founded} · {s.intake}. We prepare the admission file, apply for the merit
              scholarship and coach you through the visa interview.
            </p>

            <div className="study__figures">
              <div>
                <b>{s.tiers[0].award}</b>
                <span>Top merit award</span>
              </div>
              <div>
                <b>$0</b>
                <span>Application fee</span>
              </div>
              <div>
                <b>$0</b>
                <span>I-20 fee</span>
              </div>
            </div>

            <table className="study__table">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Listed fee</th>
                  <th>After award</th>
                </tr>
              </thead>
              <tbody>
                {s.programs.map((p) => (
                  <tr key={p.level}>
                    <td>{p.level}</td>
                    <td>{p.fee}</td>
                    <td>{p.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="study__acts">
              <a className="btn btn--white" href="#study-apply">
                Apply for this programme
              </a>
            </div>
          </div>

          <div className="study__img">
            <img src={photoSrc(photo.photo, 900)} alt={`${photo.city}, ${photo.country}`} loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="contact__card" id="study-apply" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.35rem' }}>Start your application</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '1.1rem' }}>
            Send your level and intended intake and we will reply with the documents required.
          </p>
          <StudyForm />
        </div>
      </div>
    </section>
  )
}
