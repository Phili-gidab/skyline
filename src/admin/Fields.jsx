import React, { useRef, useState } from 'react'
import { api, mediaUrl } from './api'

/* One schema field. Value shapes:
   text/textarea/number/select → string|number · toggle → bool · checks → string[]
   list → string[] · rows → object[] · image/file → url string */
export default function Field({ field, value, onChange }) {
  const { type, label, name, help } = field
  const Label = () => (
    <>
      <span className="af-label">
        {label}
        {field.required && <b aria-hidden="true"> *</b>}
      </span>
      {help && <small className="af-help">{help}</small>}
    </>
  )

  if (type === 'text' || type === 'number') {
    return (
      <label className="af">
        <Label />
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(name, type === 'number' && e.target.value !== '' ? +e.target.value : e.target.value)}
        />
      </label>
    )
  }

  if (type === 'textarea') {
    return (
      <label className="af">
        <Label />
        <textarea rows={4} value={value ?? ''} onChange={(e) => onChange(name, e.target.value)} />
      </label>
    )
  }

  if (type === 'toggle') {
    return (
      <label className="af af-toggle">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(name, e.target.checked)} />
        <span>{label}</span>
      </label>
    )
  }

  if (type === 'select') {
    return (
      <label className="af">
        <Label />
        <select value={value ?? ''} onChange={(e) => onChange(name, e.target.value)}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (type === 'checks') {
    const set = Array.isArray(value) ? value : []
    const toggle = (o) => onChange(name, set.includes(o) ? set.filter((x) => x !== o) : field.options.filter((x) => x === o || set.includes(x)))
    return (
      <fieldset className="af">
        <legend className="af-label">{label}</legend>
        <div className="af-checks">
          {field.options.map((o) => (
            <label key={o} className={set.includes(o) ? 'on' : undefined}>
              <input type="checkbox" checked={set.includes(o)} onChange={() => toggle(o)} />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  if (type === 'list') {
    const list = Array.isArray(value) ? value : []
    return (
      <div className="af">
        <Label />
        {list.map((item, i) => (
          <div className="af-row" key={i}>
            <input value={item} onChange={(e) => onChange(name, list.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="af-x" onClick={() => onChange(name, list.filter((_, j) => j !== i))} aria-label="Remove line">
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="af-add" onClick={() => onChange(name, [...list, ''])}>
          + Add a line
        </button>
      </div>
    )
  }

  if (type === 'rows') {
    const rows = Array.isArray(value) ? value : []
    const setCell = (i, key, v) => onChange(name, rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
    return (
      <div className="af">
        <Label />
        {rows.map((row, i) => (
          <div className="af-row" key={i}>
            {field.columns.map((col) => (
              <input key={col.name} placeholder={col.label} aria-label={col.label} value={row[col.name] ?? ''} onChange={(e) => setCell(i, col.name, e.target.value)} />
            ))}
            <button type="button" className="af-x" onClick={() => onChange(name, rows.filter((_, j) => j !== i))} aria-label="Remove row">
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="af-add" onClick={() => onChange(name, [...rows, {}])}>
          + Add a row
        </button>
      </div>
    )
  }

  if (type === 'image' || type === 'file') return <UploadField field={field} value={value} onChange={onChange} Label={Label} />

  return null
}

const isPdf = (url) => /\.pdf($|\?)/i.test(url || '')
const preview = (url) => {
  const u = mediaUrl(url)
  // a CDN photo can be asked for small
  return /images\.(unsplash|pexels)\.com/.test(u || '') ? `${u}&w=400` : u
}

function UploadField({ field, value, onChange, Label }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState(null)
  const input = useRef(null)
  const image = field.type === 'image'

  const pick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const { url } = await api.upload(file)
      onChange(field.name, url)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const openPicker = async () => {
    setPicker('loading')
    try {
      const files = await api.listUploads()
      setPicker(files.filter((f) => (image ? !isPdf(f.name) : isPdf(f.name))))
    } catch (err) {
      setError(err.message)
      setPicker(null)
    }
  }

  return (
    <div className="af">
      <Label />
      <div className="af-upload">
        {value ? (
          image && !isPdf(value) ? (
            <img src={preview(value)} alt="" />
          ) : (
            <a className="af-file" href={mediaUrl(value)} target="_blank" rel="noreferrer">
              {value.split('/').pop()} ↗
            </a>
          )
        ) : (
          <em className="af-note">{image ? 'No photo' : 'No file'}</em>
        )}
        <div className="af-upload-actions">
          <button type="button" className="adm-btn small" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </button>
          <button type="button" className="adm-btn small ghost" onClick={openPicker}>
            Choose from library
          </button>
          {value && (
            <button type="button" className="adm-btn small ghost" onClick={() => onChange(field.name, '')}>
              Remove
            </button>
          )}
        </div>
        <input ref={input} type="file" accept={field.accept || (image ? 'image/jpeg,image/png,image/webp' : '*')} hidden onChange={pick} />
      </div>
      {image && <small className="af-help">JPG, PNG or WebP. Large photos are resized for the web automatically.</small>}
      {error && <em className="adm-err">{error}</em>}

      {picker !== null && (
        <div className="adm-modal" onClick={(e) => e.target === e.currentTarget && setPicker(null)}>
          <div className="adm-modal-in">
            <h2>{image ? 'Choose a photo' : 'Choose a file'}</h2>
            {picker === 'loading' && <p className="adm-dim">Loading…</p>}
            {Array.isArray(picker) && picker.length === 0 && <p className="adm-dim">Nothing uploaded yet — use Upload instead.</p>}
            {Array.isArray(picker) && (
              <div className="adm-media adm-media-pick">
                {picker.map((f) => (
                  <button
                    type="button"
                    key={f.name}
                    className="adm-media-item"
                    onClick={() => {
                      onChange(field.name, f.url)
                      setPicker(null)
                    }}
                  >
                    {image ? <img src={mediaUrl(f.url)} alt={f.name} loading="lazy" /> : <span className="adm-media-doc">PDF</span>}
                    <small>{f.name}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="adm-modal-actions">
              <button type="button" className="adm-btn ghost" onClick={() => setPicker(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
