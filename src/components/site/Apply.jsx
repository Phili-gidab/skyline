import React from 'react'
import ApplicationForm from '../forms/ApplicationForm'
import { Check } from './Icons'

const STEPS = [
  'Fill in your details',
  'Attach your passport and any documents you have',
  'A consultant reviews your file and calls you',
]

export default function Apply() {
  return (
    <section className="section" id="apply">
      <div className="wrap apply">
        <div className="apply__intro">
          <span className="eyebrow">Apply online</span>
          <h2 className="section__title">Send your application and documents here</h2>
          <p className="section__text">
            No need to send files one by one on Telegram. Upload everything in one place — it goes
            straight to our office, and you get a confirmation by email.
          </p>

          <ol className="apply__steps">
            {STEPS.map((s, i) => (
              <li key={s}>
                <b>{i + 1}</b>
                {s}
              </li>
            ))}
          </ol>

          <ul className="card__list">
            <li>
              <Check /> Your documents are stored privately, never on a public page
            </li>
            <li>
              <Check /> Only our office staff can open them
            </li>
            <li>
              <Check /> Nothing is payable until your visa is approved
            </li>
          </ul>
        </div>

        <div className="contact__card">
          <ApplicationForm />
        </div>
      </div>
    </section>
  )
}
