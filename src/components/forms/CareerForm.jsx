import React, { useEffect, useRef, useState } from 'react'
import { useSubmit, Input, TextArea, Honeypot, Failure, Sent } from './FormKit'

const MAX_CV = 5 * 1024 * 1024

/* A job application with a CV, in a dialog opened from a boarding pass.
   The CV travels as multipart and is stored outside the public web folder. */
export default function CareerForm({ role, onClose }) {
  const dialog = useRef(null)
  const { state, error, submit, reset } = useSubmit()
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    const d = dialog.current
    if (!d) return undefined
    d.showModal()
    // the page's smooth scroll would otherwise keep scrolling behind the dialog
    window.__lenis?.stop()
    const closed = () => onClose()
    d.addEventListener('close', closed)
    return () => {
      d.removeEventListener('close', closed)
      window.__lenis?.start()
    }
  }, [onClose])

  const onSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const cv = fd.get('cv')
    if (!(cv instanceof File) || !cv.size) return setFileError('Please attach your CV')
    if (cv.size > MAX_CV) return setFileError('Your CV is larger than 5 MB — please send a smaller file')
    setFileError('')
    fd.append('kind', 'career')
    fd.append('role', role)
    submit(fd)
  }

  return (
    <dialog className="apply-dialog" ref={dialog} aria-labelledby="apply-title">
      <header className="apply-dialog__head">
        <div>
          <span className="eyebrow">Apply</span>
          <h3 id="apply-title">{role}</h3>
        </div>
        <button type="button" className="apply-dialog__close" onClick={() => dialog.current?.close()} aria-label="Close">
          ×
        </button>
      </header>

      {state === 'sent' ? (
        <div className="apply-dialog__body">
          <Sent title="Application received" onAgain={reset}>
            Thank you — we have your application and your CV. If your profile matches, we will contact you to arrange an interview.
          </Sent>
        </div>
      ) : (
        <form className="fm apply-dialog__body" onSubmit={onSubmit}>
          <div className="fm-grid">
            <Input label="Your name" name="name" required autoComplete="name" maxLength={190} wide />
            <Input label="Email" name="email" type="email" required autoComplete="email" maxLength={190} />
            <Input label="Phone" name="phone" type="tel" required autoComplete="tel" placeholder="09… or +251…" maxLength={64} />
            <Input
              label="CV"
              name="cv"
              type="file"
              required
              wide
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hint="PDF or Word, up to 5 MB."
              onChange={() => setFileError('')}
            />
            <TextArea label="A few words about you" name="message" maxLength={5000} placeholder="Your experience, when you could start…" />
          </div>
          <Honeypot />
          {fileError && (
            <p className="fm-error" role="alert">
              {fileError}
            </p>
          )}
          {state === 'error' && <Failure error={error} text={`Hello Skyline, I would like to apply for the ${role} position.`} />}
          <div className="fm-foot">
            <button className="btn btn--solid" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send application ↗'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
