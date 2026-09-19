import React, { useState } from 'react'
import { api } from './api'

export const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/* Files staged for an outgoing message. Each uploads the moment it is picked,
   so Send is instant and a failed upload shows while the writer is still here. */
export default function MailAttachments({ files, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (e) => {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    if (!chosen.length) return
    setBusy(true)
    setError('')
    for (const file of chosen) {
      try {
        const meta = await api.uploadMailAttachment(file)
        onChange((prev) => [...prev, meta])
      } catch (err) {
        setError(`${file.name}: ${err.message}`)
      }
    }
    setBusy(false)
  }

  return (
    <div className="mailatt">
      <label className="mailatt-add">
        <input type="file" multiple onChange={add} disabled={busy} />
        <span>{busy ? 'Attaching…' : '+ Attach files'}</span>
      </label>
      {files.length > 0 && (
        <ul className="mailatt-list">
          {files.map((a) => (
            <li key={a.id}>
              <b>{a.filename}</b>
              <small>{fmtSize(a.size)}</small>
              <button type="button" onClick={() => onChange((prev) => prev.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.filename}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="adm-err">{error}</p>}
    </div>
  )
}
