import React, { useState } from 'react'
import { BRAND, whatsappLink } from '../../data/site'

const API = import.meta.env.VITE_API_URL || ''

/* Posts a website form to /api/submit. The office gets it in the admin and
   by email; the sender gets a confirmation if they gave an address. */
export function useSubmit() {
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const submit = async (payload) => {
    setState('sending')
    setError('')
    try {
      const multipart = payload instanceof FormData
      const res = await fetch(`${API}/api/submit`, {
        method: 'POST',
        headers: multipart ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: multipart ? payload : JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error || '')
      setState('sent')
    } catch (e) {
      setError(e.message || '')
      setState('error')
    }
  }

  return { state, error, submit, reset: () => setState('idle') }
}

/* the form's fields as a plain object, for the JSON forms */
export const fieldsOf = (formEl) => Object.fromEntries(new FormData(formEl).entries())

export function Input({ label, hint, required, wide, ...rest }) {
  return (
    <label className={`fm-field${wide ? ' wide' : ''}`}>
      <span className="fm-label">
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      <input required={required} {...rest} />
      {hint && <small className="fm-hint">{hint}</small>}
    </label>
  )
}

export function Select({ label, options, placeholder = 'Choose…', required, wide, ...rest }) {
  return (
    <label className={`fm-field${wide ? ' wide' : ''}`}>
      <span className="fm-label">
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      <select required={required} defaultValue="" {...rest}>
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TextArea({ label, hint, ...rest }) {
  return (
    <label className="fm-field wide">
      <span className="fm-label">{label}</span>
      <textarea rows={4} {...rest} />
      {hint && <small className="fm-hint">{hint}</small>}
    </label>
  )
}

/* Bots fill every field they find; people never see this one. */
export function Honeypot() {
  return (
    <div className="fm-hp" aria-hidden="true">
      <label>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  )
}

/* A failed send never leaves someone stuck: WhatsApp always works. */
export function Failure({ error, text }) {
  return (
    <p className="fm-error" role="alert">
      {error || 'We could not send that just now.'}{' '}
      <a href={whatsappLink(text)} target="_blank" rel="noreferrer">
        Message us on WhatsApp instead ↗
      </a>
    </p>
  )
}

export function Sent({ title, children, onAgain }) {
  return (
    <div className="fm-sent" role="status">
      <span className="fm-sent__mark" aria-hidden="true">
        ✓
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      <p className="fm-sent__small">
        Urgent? WhatsApp {BRAND.whatsapp}.{' '}
        {onAgain && (
          <button type="button" onClick={onAgain}>
            Send another
          </button>
        )}
      </p>
    </div>
  )
}
