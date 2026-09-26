import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Cell, SecretCell, personOf, textOf } from './cells'
import { fmtSize } from '../MailAttachments'

const when = (iso) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/* the activity trail, in sentences */
function describe(a, columns, people) {
  const d = a.detail || {}
  const col = columns.find((c) => c.k === d.k)
  const show = (v) => {
    if (v === null || v === undefined || v === '') return '—'
    if (col?.type === 'person') return personOf(people, v)?.name || '—'
    if (col) return textOf(col, v, people) || '—'
    return String(v)
  }
  switch (a.action) {
    case 'created':
      return d.from_submission ? 'created this client from a website submission' : 'created this client'
    case 'set':
      return (
        <>
          changed <b>{d.column || d.k}</b> from {show(d.from)} to <b>{show(d.to)}</b>
        </>
      )
    case 'renamed':
      return (
        <>
          renamed from {d.from} to <b>{d.to}</b>
        </>
      )
    case 'moved':
      return (
        <>
          moved to <b>{d.to}</b>
        </>
      )
    case 'secret_set':
      return (
        <>
          saved a new <b>{d.column}</b>
        </>
      )
    case 'secret_cleared':
      return (
        <>
          cleared <b>{d.column}</b>
        </>
      )
    case 'secret_viewed':
      return (
        <span className="bd-act-reveal">
          viewed <b>{d.column}</b>
        </span>
      )
    case 'document_opened':
      return (
        <>
          opened <b>{d.file}</b>
        </>
      )
    case 'archived':
      return 'archived this client'
    default:
      return a.action
  }
}

function SecretField({ col, item, onReveal, onSet }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const has = Boolean(item.vals?.[col.k])
  return (
    <div className="bd-field">
      <span className="bd-field-label">{col.name}</span>
      <div className="bd-field-value">
        {!editing && <SecretCell has={has} canReveal={item.can_reveal} onReveal={onReveal} />}
        {item.can_reveal && !editing && (
          <button type="button" className="adm-btn small ghost" onClick={() => { setDraft(''); setEditing(true) }}>
            {has ? 'Change' : 'Add'}
          </button>
        )}
        {editing && (
          <form
            className="bd-secret-form"
            onSubmit={async (e) => {
              e.preventDefault()
              await onSet(draft)
              setEditing(false)
            }}
          >
            <input className="bd-input" type="text" autoComplete="off" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Leave empty to remove" />
            <button className="adm-btn small">Save</button>
            <button type="button" className="adm-btn small ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ItemDrawer({ itemId, columns, groups, people, me, onClose, onChanged, onGone }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState('updates')

  const load = useCallback(
    () =>
      api
        .boardItem(itemId)
        .then(setData)
        .catch((e) => setError(e.message)),
    [itemId]
  )

  useEffect(() => {
    setData(null)
    setError('')
    load()
  }, [load])

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const save = async (patch) => {
    setError('')
    try {
      const next = await api.updateBoardItem(itemId, patch)
      if (next.gone) {
        onGone(itemId)
        return
      }
      onChanged(next)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const reveal = (k) => async () => {
    const r = await api.revealSecret(itemId, k)
    load() // the reveal is now in the trail
    return r.value
  }

  const setSecret = (k) => async (value) => {
    try {
      await api.setSecret(itemId, k, value)
      load()
      onChanged({ ...data.item, vals: { ...data.item.vals, [k]: value.trim() !== '' } })
    } catch (e) {
      setError(e.message)
    }
  }

  const post = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    try {
      await api.addUpdate(itemId, draft)
      setDraft('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const item = data?.item
  const canArchive = ['admin', 'manager'].includes(me.role)
  const editable = ['admin', 'manager', 'frontdesk', 'agent'].includes(me.role)

  return (
    <div className="bd-drawer-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="bd-drawer" role="dialog" aria-label={item?.name || 'Client'}>
        <header className="bd-drawer-head">
          {item ? (
            <input
              className="bd-drawer-name"
              defaultValue={item.name}
              key={item.name}
              readOnly={!editable}
              onBlur={(e) => e.target.value.trim() && e.target.value !== item.name && save({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          ) : (
            <span className="bd-dim">Loading…</span>
          )}
          <button type="button" className="bd-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {error && <p className="adm-err bd-pad">{error}</p>}
        {note && <p className="adm-ok bd-pad">{note}</p>}

        {item && (
          <div className="bd-drawer-body">
            <div className="bd-field">
              <span className="bd-field-label">Group</span>
              <div className="bd-field-value">
                <select className="bd-select" value={item.group_id || ''} disabled={!editable} onChange={(e) => save({ group_id: Number(e.target.value) })}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {columns.map((col) =>
              col.type === 'secret' ? (
                <SecretField key={col.k} col={col} item={item} onReveal={reveal(col.k)} onSet={setSecret(col.k)} />
              ) : col.type === 'longtext' ? (
                <div className="bd-field bd-field--wide" key={col.k}>
                  <span className="bd-field-label">{col.name}</span>
                  <textarea
                    className="bd-textarea"
                    defaultValue={item.vals?.[col.k] || ''}
                    key={`${item.id}-${item.vals?.[col.k] || ''}`}
                    readOnly={!editable}
                    rows={3}
                    onBlur={(e) => (e.target.value || '') !== (item.vals?.[col.k] || '') && save({ vals: { [col.k]: e.target.value || null } })}
                  />
                </div>
              ) : (
                <div className="bd-field" key={col.k}>
                  <span className="bd-field-label">{col.name}</span>
                  <div className="bd-field-value">
                    <Cell col={col} item={item} people={people} readOnly={!editable} onSave={(vals) => save({ vals })} onReveal={reveal(col.k)} />
                  </div>
                </div>
              )
            )}

            {data.submission && (
              <section className="bd-docs">
                <h3>
                  From the website · {new Date(data.submission.created_at).toLocaleDateString()}
                </h3>
                {data.submission.documents.length === 0 && <p className="bd-dim">No documents were attached.</p>}
                <ul>
                  {data.submission.documents.map((d, n) => (
                    <li key={n}>
                      <span className="adm-docs__type">{(d.filename.split('.').pop() || '').toUpperCase()}</span>
                      <span>
                        <b>{d.label}</b>
                        <small>
                          {d.filename} · {fmtSize(d.size)}
                        </small>
                      </span>
                      {/^(application\/pdf|image\/(jpeg|png|webp))$/.test(d.type) && (
                        <button type="button" className="adm-btn small ghost" onClick={() => api.openItemDocument(itemId, n).then(load).catch((e) => setError(e.message))}>
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        className="adm-btn small ghost"
                        onClick={() => api.downloadItemDocument(itemId, n, `${item.name} — ${d.label} — ${d.filename}`).then(load).catch((e) => setError(e.message))}
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="adm-tabs bd-drawer-tabs">
              <button type="button" className={tab === 'updates' ? 'on' : undefined} onClick={() => setTab('updates')}>
                Updates {data.updates.length > 0 && <b className="adm-badge">{data.updates.length}</b>}
              </button>
              <button type="button" className={tab === 'activity' ? 'on' : undefined} onClick={() => setTab('activity')}>
                Activity
              </button>
            </div>

            {tab === 'updates' && (
              <section className="bd-updates">
                <form onSubmit={post}>
                  <textarea
                    className="bd-textarea"
                    rows={3}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write an update — a call, a document received, a next step…"
                  />
                  <button className="adm-btn small" disabled={!draft.trim()}>
                    Post update
                  </button>
                </form>
                {data.updates.map((u) => (
                  <article key={u.id} className="bd-update">
                    <header>
                      <b>{u.by}</b>
                      <small>{when(u.created_at)}</small>
                      {(u.user_id === me.id || me.role === 'admin') && (
                        <button
                          type="button"
                          className="bd-link"
                          onClick={async () => {
                            if (!confirm('Delete this update?')) return
                            await api.deleteUpdate(u.id).catch((e) => setError(e.message))
                            load()
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </header>
                    <p>{u.body}</p>
                  </article>
                ))}
                {data.updates.length === 0 && <p className="bd-dim">No updates yet.</p>}
              </section>
            )}

            {tab === 'activity' && (
              <ol className="bd-activity">
                {data.activity.map((a, i) => (
                  <li key={i}>
                    <b>{a.by}</b> {describe(a, columns, people)}
                    <small>{when(a.created_at)}</small>
                  </li>
                ))}
              </ol>
            )}

            {canArchive && (
              <footer className="bd-drawer-foot">
                <button
                  type="button"
                  className="adm-btn small ghost danger"
                  onClick={async () => {
                    if (!confirm(`Archive ${item.name}? They leave the board; the record is kept.`)) return
                    try {
                      await api.archiveBoardItem(itemId)
                      setNote('Archived')
                      onGone(itemId)
                    } catch (e) {
                      setError(e.message)
                    }
                  }}
                >
                  Archive client
                </button>
              </footer>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
