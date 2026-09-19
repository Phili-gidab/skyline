import React, { useEffect, useState } from 'react'
import { api } from '../api'
import Field from '../Fields'

export default function SingletonEditor({ schema }) {
  const [data, setData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getSingleton(schema.key)
      .then((d) => setData(d || {}))
      .catch((e) => setError(e.message))
  }, [schema.key])

  /* warn before leaving with unsaved edits */
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const onChange = (name, value) => {
    setDirty(true)
    setData((d) => ({ ...d, [name]: value }))
  }

  const save = async () => {
    setSaving(true)
    setMsg('')
    setError('')
    try {
      await api.saveSingleton(schema.key, data)
      setDirty(false)
      setMsg('Saved — live on the website’s next page load.')
      setTimeout(() => setMsg(''), 4000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (error && !data) return <p className="adm-err">{error}</p>
  if (!data) return <p className="adm-dim">Loading…</p>

  return (
    <div className="adm-page">
      <header className="adm-head sticky">
        <div>
          <span className="adm-eyebrow">Website</span>
          <h1>{schema.label}</h1>
        </div>
        <div className="adm-head-actions">
          {dirty && !saving && <span className="adm-dim">Unsaved changes</span>}
          {msg && <span className="adm-ok">{msg}</span>}
          <button className="adm-btn" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>
      {schema.intro && <p className="adm-intro">{schema.intro}</p>}
      {error && <p className="adm-err">{error}</p>}
      <div className="adm-form adm-card">
        {schema.fields.map((f) => (
          <Field key={f.name} field={f} value={data[f.name]} onChange={onChange} />
        ))}
      </div>
    </div>
  )
}
