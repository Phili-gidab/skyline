import React, { useState } from 'react'
import { api } from './api'
import MailAttachments from './MailAttachments'

/* A new message from the office address. Also how a form submission is
   answered: Submissions opens it with the recipient and a draft filled in. */
export default function Compose({ initial = {}, onClose, onSent }) {
  const [draft, setDraft] = useState({ to: '', subject: '', text: '', ...initial })
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.compose({ ...draft, attachments: files })
      onSent?.()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="adm-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="adm-modal-in compose" onSubmit={send}>
        <header className="compose-head">
          <h2>New message</h2>
          <span className="compose-from">from the office address</span>
        </header>
        <div className="compose-fields">
          <label className="compose-row">
            <span>To</span>
            <input required type="email" placeholder="name@example.com" value={draft.to} onChange={set('to')} />
          </label>
          <label className="compose-row">
            <span>Subject</span>
            <input required value={draft.subject} onChange={set('subject')} />
          </label>
        </div>
        <textarea className="compose-body" rows={12} required placeholder="Write your message…" value={draft.text} onChange={set('text')} />
        <MailAttachments files={files} onChange={setFiles} />
        {error && <p className="adm-err">{error}</p>}
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="adm-btn" disabled={busy}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
