import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { ROLES } from '../roles'

const TYPES = {
  text: 'Text',
  longtext: 'Long text',
  status: 'Status (coloured labels)',
  dropdown: 'Dropdown',
  person: 'Person',
  date: 'Date',
  number: 'Number',
  money: 'Money',
  checkbox: 'Checkbox',
  email: 'Email',
  phone: 'Phone',
  link: 'Link',
  secret: 'Password (encrypted)',
}

function Labels({ col, colors, onSave }) {
  const [labels, setLabels] = useState(col.settings?.labels || [])
  const dirty = JSON.stringify(labels) !== JSON.stringify(col.settings?.labels || [])
  return (
    <div className="bs-labels">
      {labels.map((l, n) => (
        <div className="bs-label" key={n}>
          <select
            className="bs-color"
            style={{ background: l.color }}
            value={l.color}
            onChange={(e) => setLabels(labels.map((x, i) => (i === n ? { ...x, color: e.target.value } : x)))}
            aria-label="Colour"
          >
            {colors.map((c) => (
              <option key={c} value={c} style={{ background: c }}>
                {c}
              </option>
            ))}
          </select>
          <input className="bd-input" value={l.name} onChange={(e) => setLabels(labels.map((x, i) => (i === n ? { ...x, name: e.target.value } : x)))} />
          <label className="bs-done" title="Counts as finished">
            <input type="checkbox" checked={Boolean(l.done)} onChange={(e) => setLabels(labels.map((x, i) => (i === n ? { ...x, done: e.target.checked } : x)))} /> done
          </label>
          <button type="button" className="bd-x" onClick={() => setLabels(labels.filter((_, i) => i !== n))} aria-label="Remove label">
            ✕
          </button>
        </div>
      ))}
      <div className="bs-row">
        <button type="button" className="adm-btn small ghost" onClick={() => setLabels([...labels, { name: 'New label', color: colors[labels.length % colors.length] }])}>
          + Label
        </button>
        {dirty && (
          <button type="button" className="adm-btn small" onClick={() => onSave({ labels })}>
            Save labels
          </button>
        )}
      </div>
      <p className="adm-note">Renaming a label does not rename it on clients that already have it — they keep the old text until changed.</p>
    </div>
  )
}

function Options({ col, onSave }) {
  const [text, setText] = useState((col.settings?.options || []).join('\n'))
  const dirty = text !== (col.settings?.options || []).join('\n')
  return (
    <div className="bs-labels">
      <textarea className="bd-textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="One option per line" />
      {dirty && (
        <button type="button" className="adm-btn small" onClick={() => onSave({ options: text.split('\n').map((s) => s.trim()).filter(Boolean) })}>
          Save options
        </button>
      )}
    </div>
  )
}

function Visibility({ col, onSave }) {
  const current = col.settings?.roles || (col.type === 'money' ? ['admin', 'manager'] : Object.keys(ROLES))
  return (
    <div className="bs-roles">
      <span className="adm-note">Visible to</span>
      {Object.entries(ROLES)
        .filter(([k]) => k !== 'editor')
        .map(([k, r]) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={current.includes(k)}
              disabled={k === 'admin'}
              onChange={(e) => {
                const next = e.target.checked ? [...new Set([...current, k])] : current.filter((x) => x !== k)
                onSave({ roles: next.includes('admin') ? next : ['admin', ...next] })
              }}
            />{' '}
            {r.label}
          </label>
        ))}
    </div>
  )
}

export default function BoardSettings() {
  const { id } = useParams()
  const boardId = Number(id)
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [add, setAdd] = useState({ name: '', type: 'text' })
  const [mapTo, setMapTo] = useState({})

  const load = useCallback(() => api.board(boardId).then(setData).catch((e) => setError(e.message)), [boardId])
  useEffect(() => {
    load()
  }, [load])

  const run = async (fn, ok) => {
    setError('')
    setNote('')
    try {
      await fn()
      if (ok) setNote(ok)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (error && !data) return <p className="adm-err">{error}</p>
  if (!data) return <p className="adm-dim">Loading…</p>
  if (!data.me.caps.includes('configure')) return <p className="adm-dim">Only an administrator can set up boards.</p>

  const { board, columns, people } = data
  const persons = columns.filter((c) => c.type === 'person')
  const statuses = columns.filter((c) => c.type === 'status')
  const legacy = persons.flatMap((c) =>
    [...new Set(data.items.map((i) => i.vals?.[c.k]).filter((v) => v && typeof v === 'object').map((v) => v.name))].map((name) => ({ k: c.k, col: c.name, name }))
  )

  const move = (n, dir) => {
    const order = columns.map((c) => c.id)
    const j = n + dir
    if (j < 0 || j >= order.length) return
    ;[order[n], order[j]] = [order[j], order[n]]
    run(() => api.reorderColumns(boardId, order))
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">
            <Link to={`/admin/boards/${boardId}`}>← {board.name}</Link>
          </span>
          <h1>Board setup</h1>
        </div>
      </header>
      {error && <p className="adm-err">{error}</p>}
      {note && <p className="adm-ok">{note}</p>}

      <section className="adm-card bs-section">
        <h2 className="adm-sub">The board</h2>
        <form
          className="adm-form"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            run(() => api.updateBoard(boardId, { name: f.get('name'), description: f.get('description'), settings: { assign_column: f.get('assign'), kanban_column: f.get('kanban') } }), 'Saved')
          }}
        >
          <label className="af">
            <span className="af-label">Name</span>
            <input name="name" defaultValue={board.name} />
          </label>
          <label className="af">
            <span className="af-label">Description</span>
            <input name="description" defaultValue={board.description || ''} />
          </label>
          <label className="af">
            <span className="af-label">Who a client belongs to</span>
            <select name="assign" defaultValue={board.settings?.assign_column || ''}>
              <option value="">Nobody — every role that sees the board sees every client</option>
              {persons.map((c) => (
                <option key={c.k} value={c.k}>
                  {c.name}
                </option>
              ))}
            </select>
            <small className="af-help">Agents see only the clients whose person in this column is them.</small>
          </label>
          <label className="af">
            <span className="af-label">Kanban lanes from</span>
            <select name="kanban" defaultValue={board.settings?.kanban_column || ''}>
              {statuses.map((c) => (
                <option key={c.k} value={c.k}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="adm-btn">Save</button>
        </form>
      </section>

      {legacy.length > 0 && (
        <section className="adm-card bs-section">
          <h2 className="adm-sub">Names from the old sheets</h2>
          <p className="adm-intro">These people were typed into the spreadsheets as names. Match each to a team member so their clients are theirs — agents only see clients matched to them.</p>
          {legacy.map((l) => (
            <div className="bs-row" key={`${l.k}-${l.name}`}>
              <b className="bs-legacy">{l.name}</b>
              <span className="adm-note">in {l.col}</span>
              <select className="bd-select" value={mapTo[l.name] || ''} onChange={(e) => setMapTo({ ...mapTo, [l.name]: e.target.value })}>
                <option value="">Choose a team member…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({ROLES[p.role]?.label || p.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="adm-btn small"
                disabled={!mapTo[l.name]}
                onClick={() => run(async () => {
                  const r = await api.mapPerson(boardId, { k: l.k, name: l.name, user_id: Number(mapTo[l.name]) })
                  setNote(`${r.updated} client${r.updated === 1 ? '' : 's'} now belong to them`)
                })}
              >
                Match
              </button>
            </div>
          ))}
          {people.filter((p) => p.role === 'agent').length === 0 && (
            <p className="adm-note">
              There are no agents on the team yet — <Link to="/admin/team">invite them</Link> first.
            </p>
          )}
        </section>
      )}

      <section className="adm-card bs-section">
        <h2 className="adm-sub">Columns</h2>
        <ol className="bs-cols">
          {columns.map((c, n) => (
            <li key={c.id} className="bs-col">
              <div className="bs-row">
                <div className="bs-move">
                  <button type="button" onClick={() => move(n, -1)} disabled={n === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(n, 1)} disabled={n === columns.length - 1} aria-label="Move down">
                    ↓
                  </button>
                </div>
                <input
                  className="bd-input bs-col-name"
                  defaultValue={c.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && run(() => api.updateColumn(c.id, { name: e.target.value }), 'Renamed')}
                />
                <span className="adm-pill">{TYPES[c.type] || c.type}</span>
                <button
                  type="button"
                  className="adm-btn small ghost danger"
                  onClick={() =>
                    confirm(
                      c.type === 'secret'
                        ? `Delete "${c.name}"? Every password stored in it is deleted too. This cannot be undone.`
                        : `Delete "${c.name}" and its values on every client? This cannot be undone.`
                    ) && run(() => api.deleteColumn(c.id), 'Column deleted')
                  }
                >
                  Delete
                </button>
              </div>
              {c.type === 'status' && <Labels col={c} colors={data.label_colors} onSave={(s) => run(() => api.updateColumn(c.id, { settings: s }), 'Labels saved')} />}
              {c.type === 'dropdown' && <Options col={c} onSave={(s) => run(() => api.updateColumn(c.id, { settings: s }), 'Options saved')} />}
              {c.type !== 'secret' && <Visibility col={c} onSave={(s) => run(() => api.updateColumn(c.id, { settings: s }), 'Visibility saved')} />}
              {c.type === 'secret' && <p className="adm-note">Encrypted. Only administrators and the client’s own agent can reveal it, and every reveal is logged.</p>}
            </li>
          ))}
        </ol>

        <form
          className="bs-row bs-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (!add.name.trim()) return
            run(async () => {
              await api.addColumn(boardId, add)
              setAdd({ name: '', type: 'text' })
            }, 'Column added')
          }}
        >
          <input className="bd-input" placeholder="New column name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <select className="bd-select" value={add.type} onChange={(e) => setAdd({ ...add, type: e.target.value })}>
            {Object.entries(TYPES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button className="adm-btn small">Add column</button>
        </form>
      </section>

      <section className="adm-card bs-section">
        <h2 className="adm-sub">Delete this board</h2>
        <p className="adm-intro">Only possible once every client on it has been archived or moved.</p>
        <button
          type="button"
          className="adm-btn small ghost danger"
          onClick={() => confirm(`Delete the board "${board.name}"?`) && run(async () => {
            await api.deleteBoard(boardId)
            navigate('/admin')
          })}
        >
          Delete board
        </button>
      </section>
    </div>
  )
}
