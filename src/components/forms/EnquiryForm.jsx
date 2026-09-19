import React from 'react'
import { DESTINATIONS } from '../../data/site'
import { useSubmit, fieldsOf, Input, Select, TextArea, Honeypot, Failure, Sent } from './FormKit'

const VISAS = ['Student visa', 'Work visa / permit', 'Visit / tourist visa', 'Not sure yet']

/* The Contact section's form: a visa enquiry, phone first — most clients
   would rather be called than emailed. */
export default function EnquiryForm() {
  const { state, error, submit, reset } = useSubmit()

  const onSubmit = (e) => {
    e.preventDefault()
    submit({ kind: 'enquiry', ...fieldsOf(e.currentTarget) })
  }

  if (state === 'sent') {
    return (
      <Sent title="Your enquiry is with us" onAgain={reset}>
        A consultant will call or write to you shortly — usually within one working day. Nothing is payable until your visa is
        approved.
      </Sent>
    )
  }

  return (
    <form className="fm" onSubmit={onSubmit}>
      <div className="fm-grid">
        <Input label="Your name" name="name" required autoComplete="name" maxLength={190} />
        <Input label="Phone" name="phone" type="tel" required autoComplete="tel" placeholder="09… or +251…" maxLength={64} />
        <Input label="Email" name="email" type="email" autoComplete="email" hint="Optional — for a written confirmation." maxLength={190} />
        <Select label="Destination" name="destination" options={[...DESTINATIONS.map((d) => d.country), 'Not sure yet']} placeholder="Choose a country" />
        <Select label="Visa type" name="visa" options={VISAS} placeholder="Choose a visa" wide />
        <TextArea label="Anything we should know?" name="message" maxLength={5000} placeholder="Your travel dates, a refusal before, questions…" />
      </div>
      <Honeypot />
      {state === 'error' && <Failure error={error} text="Hello Skyline, I would like to ask about a visa." />}
      <div className="fm-foot">
        <button className="btn btn--solid" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send enquiry ↗'}
        </button>
        <small>We reply by phone or email. Your details stay with our office.</small>
      </div>
    </form>
  )
}
