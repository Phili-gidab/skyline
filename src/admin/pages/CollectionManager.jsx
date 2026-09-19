import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import Field from '../Fields'

/* One manager for every list: open to edit, hide/publish, reorder, delete. */
export default function CollectionManager({ schema }) {
  const [items, setItems] = useState(null)
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.listItems(schema.key).then(setItems).catch((e) => setError(e.message))
  }, [schema.key])
  useEffect(() => {
    load()
  }, [load])

  const open = (item) => {
    setError('')
    setEditing(item ?? null)
    setForm(item ? { ...item } : {})
  }
  const close = () => {
    setEditing(undefined)
    setForm({})
  }
  const onChange = (name, value) => setForm((f) => ({ ...f, [name]: value }))

  const save = async () => {
    for (const f of schema.fields) {
      if (f.required && !String(form[f.name] ?? '').trim()) return setError(`“${f.label}” is required`)
    }
    setBusy(true)
    setError('')
    try {
      // unknown keys (like a destination's slug) travel with the item untouched
      const { id, sort, published, updatedAt, ...data } = form
      if (editing) await api.updateItem(schema.key, editing.id, { ...data, published: editing.published })
      else await api.createItem(schema.key, data)
      close()
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (item) => {
    if (!confirm(`Delete “${item[schema.titleField] || item.id}”? This cannot be undone. (Hide it instead to keep it for later.)`)) return
    try {
      await api.deleteItem(schema.key, item.id)
      setError('')
    } catch (e) {
      setError(`Delete failed: ${e.message}`)
    }
    load()
  }

  const togglePublish = async (item) => {
    const { id, sort, published, updatedAt, ...data } = item
    try {
      await api.updateItem(schema.key, id, { ...data, published: !published })
      setError('')
    } catch (e) {
      setError(`Update failed: ${e.message}`)
    }
    load()
  }

  const move = async (index, dir) => {
    const order = items.map((i) => i.id)
    const j = index + dir
    if (j < 0 || j >= order.length) return
    ;[order[index], order[j]] = [order[j], order[index]]
    setItems((list) => order.map((id) => list.find((x) => x.id === id)))
    try {
      await api.reorder(schema.key, order)
      setError('')
    } catch (e) {
      setError(`Reorder failed: ${e.message}`)
    }
    load()
  }

  if (!items) return error ? <p className="adm-err">{error}</p> : <p className="adm-dim">Loading…</p>

  const shown = items.filter((i) => i.published).length

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">List</span>
          <h1>
            {schema.label} <span className="adm-count">{items.length}</span>
          </h1>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn" onClick={() => open(null)}>
            + Add
          </button>
        </div>
      </header>
      {schema.intro && <p className="adm-intro">{schema.intro}</p>}
      {error && editing === undefined && <p className="adm-err">{error}</p>}

      {items.length > 0 && shown === 0 && (
        <div className="adm-alert soft">Every item is hidden, so the website shows its built-in version of this section.</div>
      )}

      <div className="adm-list adm-card flush">
        {items.length === 0 && <p className="adm-dim adm-pad">Nothing here — the website shows its built-in version. Add the first item to take over.</p>}
        {items.map((item, i) => (
          <div className={`adm-item${item.published ? '' : ' off'}`} key={item.id}>
            <div className="adm-item-move">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                ↑
              </button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                ↓
              </button>
            </div>
            <button className="adm-item-title" onClick={() => open(item)}>
              <b>{item[schema.titleField] || `Item ${item.id}`}</b>
              {schema.subtitle && <small>{schema.subtitle(item)}</small>}
              {!item.published && <em>Hidden</em>}
            </button>
            <div className="adm-item-actions">
              <button onClick={() => togglePublish(item)}>{item.published ? 'Hide' : 'Show'}</button>
              <button onClick={() => open(item)}>Edit</button>
              <button className="danger" onClick={() => remove(item)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing !== undefined && (
        <div className="adm-modal" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="adm-modal-in">
            <h2>
              {editing ? 'Edit' : 'New'} — {schema.label}
            </h2>
            <div className="adm-form">
              {schema.fields.map((f) => (
                <Field key={f.name} field={f} value={form[f.name]} onChange={onChange} />
              ))}
            </div>
            {error && <p className="adm-err">{error}</p>}
            <div className="adm-modal-actions">
              <button className="adm-btn ghost" onClick={close}>
                Cancel
              </button>
              <button className="adm-btn" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
