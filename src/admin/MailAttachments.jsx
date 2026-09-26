import React, { useRef, useState } from 'react'
import { api } from './api'
import Icon from './Icon'

export const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/* Files for an outgoing message. Each uploads the moment it is picked, so a
   failed upload shows while the writer is still here; the parent is told
   while any are still on their way, so Send waits for them. */
export default function MailAttachments({ files, onChange, onBusy }) {
  const [pending, setPending] = useState([])
  const [error, setError] = useState('')
  const input = useRef(null)

  const add = async (list) => {
    const chosen = Array.from(list || [])
    if (!chosen.length) return
    setError('')
    const tags = chosen.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, name: f.name, size: f.size }))
    setPending((p) => [...p, ...tags])
    onBusy?.(true)
    for (const [i, file] of chosen.entries()) {
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error('larger than 8 MB')
        const meta = await api.uploadMailAttachment(file)
        onChange((prev) => [...prev, meta])
      } catch (err) {
        setError(`${file.name}: ${err.message}`)
      }
      setPending((p) => p.filter((t) => t.key !== tags[i].key))
    }
    onBusy?.(false)
  }

  return (
    <div
      className="matt"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        add(e.dataTransfer.files)
      }}
    >
      {(files.length > 0 || pending.length > 0) && (
        <ul className="matt-list">
          {files.map((a) => (
            <li key={a.id}>
              <Icon name="clip" size={14} />
              <b title={a.filename}>{a.filename}</b>
              <small>{fmtSize(a.size)}</small>
              <button type="button" className="icon-btn sm" onClick={() => onChange((prev) => prev.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.filename}`}>
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
          {pending.map((t) => (
            <li key={t.key} className="is-loading">
              <span className="spinner" aria-hidden="true" />
              <b title={t.name}>{t.name}</b>
              <small>uploading…</small>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
      <button type="button" className="btn ghost sm" onClick={() => input.current?.click()}>
        <Icon name="clip" size={15} /> Attach files
      </button>
      {error && <p className="form-err">{error}</p>}
    </div>
  )
}
