import React, { useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../api'
import { fmtSize } from '../MailAttachments'

export default function Media() {
  const [files, setFiles] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)

  const load = () =>
    api
      .listUploads()
      .then(setFiles)
      .catch((e) => {
        setError(e.message)
        setFiles([])
      })
  useEffect(() => {
    load()
  }, [])

  const upload = async (e) => {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    setBusy(true)
    setError('')
    for (const f of chosen) {
      try {
        await api.upload(f)
      } catch (err) {
        setError(`${f.name}: ${err.message}`)
      }
    }
    setBusy(false)
    load()
  }

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(new URL(mediaUrl(url), location.origin).href)
      setCopied(url)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  const remove = async (name) => {
    if (!confirm(`Delete “${name}”? Anything on the website still using it will show nothing in its place.`)) return
    try {
      await api.deleteUpload(name)
      setError('')
    } catch (e) {
      setError(`Delete failed: ${e.message}`)
    }
    load()
  }

  if (!files) return <p className="adm-dim">Loading…</p>

  return (
    <div className="adm-page wide">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">Settings</span>
          <h1>
            Media library <span className="adm-count">{files.length}</span>
          </h1>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : '+ Upload'}
          </button>
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={upload} />
        </div>
      </header>
      <p className="adm-intro">Photos and PDFs uploaded for the website. Photos are resized for the web as they arrive. Pick them from any photo field.</p>
      {error && <p className="adm-err">{error}</p>}

      <div className="adm-media">
        {files.map((f) => (
          <figure key={f.name} className="adm-media-item">
            {/\.pdf$/i.test(f.name) ? <span className="adm-media-doc">PDF</span> : <img src={mediaUrl(f.url)} alt={f.name} loading="lazy" />}
            <figcaption>
              <small>
                {fmtSize(f.size)} · {new Date(f.mtime).toLocaleDateString()}
              </small>
              <div className="adm-media-actions">
                <button onClick={() => copy(f.url)}>{copied === f.url ? 'Copied ✓' : 'Copy link'}</button>
                <button className="danger" onClick={() => remove(f.name)}>
                  Delete
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
        {files.length === 0 && <p className="adm-dim">Nothing uploaded yet.</p>}
      </div>
    </div>
  )
}
