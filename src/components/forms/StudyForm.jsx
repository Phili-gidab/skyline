import React from 'react'
import { SCHOLARSHIP } from '../../data/site'
import { useSubmit, fieldsOf, Input, Select, TextArea, Honeypot, Failure, Sent } from './FormKit'

const EDUCATION = ['Completing high school', 'High school graduate', 'Bachelor’s degree', 'Master’s degree']

/* The Study section's application, for the programme on offer. */
export default function StudyForm() {
  const { state, error, submit, reset } = useSubmit()

  const onSubmit = (e) => {
    e.preventDefault()
    submit({ kind: 'study', intake: SCHOLARSHIP.intake, ...fieldsOf(e.currentTarget) })
  }

  if (state === 'sent') {
    return (
      <Sent title="Your application is in" onAgain={reset}>
        A study-abroad consultant will review your details and contact you about eligibility, the admission file and the
        scholarship. Keep your transcripts and passport to hand.
      </Sent>
    )
  }

  return (
    <form className="fm" onSubmit={onSubmit}>
      <div className="fm-grid">
        <Input label="Your name" name="name" required autoComplete="name" maxLength={190} />
        <Input label="Email" name="email" type="email" required autoComplete="email" maxLength={190} />
        <Input label="Phone" name="phone" type="tel" required autoComplete="tel" placeholder="09… or +251…" maxLength={64} />
        <Select label="Programme" name="programme" required options={SCHOLARSHIP.programs.map((p) => p.level)} placeholder="Choose a programme" />
        <Select label="Education so far" name="education" options={EDUCATION} placeholder="Choose one" />
        <Input label="GPA" name="gpa" placeholder="e.g. 3.6" maxLength={20} hint="High school GPA for undergraduate, last degree for a master’s." />
        <TextArea label="Anything else?" name="message" maxLength={5000} placeholder="Your field of interest, questions about the scholarship…" />
      </div>
      <Honeypot />
      {state === 'error' && <Failure error={error} text={`Hello Skyline, I would like to apply to ${SCHOLARSHIP.school}.`} />}
      <div className="fm-foot">
        <button className="btn btn--solid" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send application ↗'}
        </button>
        <small>{SCHOLARSHIP.intake}. No application fee.</small>
      </div>
    </form>
  )
}
