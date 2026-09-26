import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { downloadCsv } from '../csv'
import { Cell, initials, personOf, textOf } from '../boards/cells'
import ItemDrawer from '../boards/ItemDrawer'

const VIEW_KEY = (id) => `skyline-board-view-${id}`
const readView = (id) => {
  try {
    return localStorage.getItem(VIEW_KEY(id)) || 'table'
  } catch {
    return 'table'
  }
}

/* ---------------- one group of the table ---------------- */

function Group({ group, items, columns, people, me, collapsed, onToggle, onSave, onReveal, onOpen, onAdd, onRename, onDelete, canGroups }) {
  const [adding, setAdding] = useState('')
  const [renaming, setRenaming] = useState(false)
  const editable = ['admin', 'manager', 'frontdesk', 'agent'].includes(me.role)

  return (
    <section className={`bd-group${collapsed ? ' is-collapsed' : ''}`} style={{ '--g': group.color || '#579bfc' }}>
      <header className="bd-group-head">
        <button type="button" className="bd-caret" onClick={onToggle} aria-expanded={!collapsed}>
          ▾
        </button>
        {renaming ? (
          <input
            className="bd-input bd-group-rename"
            autoFocus
            defaultValue={group.name}
            onBlur={(e) => {
              setRenaming(false)
              if (e.target.value.trim() && e.target.value !== group.name) onRename(e.target.value.trim())
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <h2 onDoubleClick={() => canGroups && setRenaming(true)} title={canGroups ? 'Double-click to rename' : undefined}>
            {group.name}
          </h2>
        )}
        <span className="bd-group-count">{items.length}</span>
        {canGroups && items.length === 0 && (
          <button type="button" className="bd-link" onClick={onDelete}>
            Delete group
          </button>
        )}
      </header>

      {!collapsed && (
        <div className="bd-table-wrap">
          <table className="bd-table">
            <thead>
              <tr>
                <th className="bd-sticky">Client</th>
                {columns.map((c) => (
                  <th key={c.k} style={c.width ? { minWidth: c.width } : undefined} className={`bd-th--${c.type}`}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="bd-sticky bd-name-cell">
                    <button type="button" className="bd-name" onClick={() => onOpen(item.id)}>
                      {item.name}
                    </button>
                    {item.submission_id && (
                      <span className="bd-tag" title="Came in through the website">
                        web
                      </span>
                    )}
                  </td>
                  {columns.map((c) => (
                    <td key={c.k} className={`bd-td--${c.type}`}>
                      <Cell col={c} item={item} people={people} readOnly={!editable} onSave={(vals) => onSave(item, { vals })} onReveal={() => onReveal(item, c.k)} />
                    </td>
                  ))}
                </tr>
              ))}
              {editable && (
                <tr className="bd-add-row">
                  <td className="bd-sticky" colSpan={1}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!adding.trim()) return
                        onAdd(adding.trim())
                        setAdding('')
                      }}
                    >
                      <input className="bd-input" placeholder="+ Add client" value={adding} onChange={(e) => setAdding(e.target.value)} />
                    </form>
                  </td>
                  <td colSpan={columns.length} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ---------------- kanban, by the board's status column ---------------- */

function Kanban({ col, items, columns, people, onSave, onOpen, me }) {
  const [over, setOver] = useState(null)
  const editable = ['admin', 'manager', 'frontdesk', 'agent'].includes(me.role)
  const lanes = [...(col.settings?.labels || []).map((l) => ({ key: l.name, name: l.name, color: l.color })), { key: '', name: 'No status', color: '#c4c4c4' }]
  const person = columns.find((c) => c.type === 'person')
  const peek = columns.filter((c) => !['status', 'person', 'secret', 'longtext', 'checkbox'].includes(c.type)).slice(0, 2)

  return (
    <div className="bd-kanban">
      {lanes.map((lane) => {
        const cards = items.filter((i) => (i.vals?.[col.k] || '') === lane.key)
        return (
          <section
            key={lane.key || 'none'}
            className={`bd-lane${over === lane.key ? ' is-over' : ''}`}
            onDragOver={(e) => {
              if (!editable) return
              e.preventDefault()
              setOver(lane.key)
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const id = Number(e.dataTransfer.getData('text/plain'))
              const item = items.find((i) => i.id === id)
              if (item && (item.vals?.[col.k] || '') !== lane.key) onSave(item, { vals: { [col.k]: lane.key || null } })
            }}
          >
            <header style={{ background: lane.color }}>
              {lane.name} <span>{cards.length}</span>
            </header>
            <div className="bd-cards">
              {cards.map((i) => {
                const p = person ? personOf(people, i.vals?.[person.k]) : null
                return (
                  <article
                    key={i.id}
                    className="bd-card"
                    draggable={editable}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i.id))}
                    onClick={() => onOpen(i.id)}
                  >
                    <b>{i.name}</b>
                    {peek.map((c) => {
                      const t = textOf(c, i.vals?.[c.k], people)
                      return t ? (
                        <small key={c.k}>
                          {c.name}: {t}
                        </small>
                      ) : null
                    })}
                    {p && (
                      <span className={`bd-card-person${p.legacy ? ' legacy' : ''}`}>
                        <i>{initials(p.name)}</i>
                        {p.name}
                      </span>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ---------------- the page ---------------- */

export default function Board() {
  const { id } = useParams()
  const boardId = Number(id)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState(() => readView(boardId))
  const [q, setQ] = useState('')
  const [who, setWho] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [newGroup, setNewGroup] = useState('')
  const [params, setParams] = useSearchParams()

  // arriving from "Add to a board" opens that client straight away
  useEffect(() => {
    const want = Number(params.get('open'))
    if (want && data?.items.some((i) => i.id === want)) {
      setOpen(want)
      setParams({}, { replace: true })
    }
  }, [params, data, setParams])

  const load = useCallback(
    () =>
      api
        .board(boardId)
        .then((d) => {
          setData(d)
          setError('')
        })
        .catch((e) => setError(e.message)),
    [boardId]
  )

  useEffect(() => {
    setData(null)
    setOpen(null)
    setView(readView(boardId))
    load()
  }, [boardId, load])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY(boardId), view)
    } catch {
      /* private window: the choice simply is not remembered */
    }
  }, [view, boardId])

  const kanbanCol = useMemo(() => {
    if (!data) return null
    const k = data.board.settings?.kanban_column
    return data.columns.find((c) => c.k === k && c.type === 'status') || data.columns.find((c) => c.type === 'status') || null
  }, [data])

  const assignCol = useMemo(() => data && data.columns.find((c) => c.k === data.board.settings?.assign_column && c.type === 'person'), [data])

  const shown = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    return data.items.filter((i) => {
      if (status && kanbanCol && (i.vals?.[kanbanCol.k] || '') !== status) return false
      if (who && assignCol) {
        const v = i.vals?.[assignCol.k]
        if (who === 'me' && v !== data.me.id) return false
        if (who === 'none' && v !== undefined && v !== null) return false
        if (who === 'legacy' && !(v && typeof v === 'object')) return false
        if (/^\d+$/.test(who) && v !== Number(who)) return false
      }
      if (!needle) return true
      if (i.name.toLowerCase().includes(needle)) return true
      return data.columns.some((c) => textOf(c, i.vals?.[c.k], data.people).toLowerCase().includes(needle))
    })
  }, [data, q, who, status, kanbanCol, assignCol])

  /* optimistic: the row changes at once, and goes back if the server refuses */
  const saveItem = async (item, patch) => {
    const before = data.items
    if (patch.vals) setData((d) => ({ ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, vals: { ...x.vals, ...patch.vals } } : x)) }))
    try {
      const next = await api.updateBoardItem(item.id, patch)
      setData((d) => ({ ...d, items: next.gone ? d.items.filter((x) => x.id !== item.id) : d.items.map((x) => (x.id === item.id ? next : x)) }))
    } catch (e) {
      setData((d) => ({ ...d, items: before }))
      setError(e.message)
    }
  }

  const reveal = async (item, k) => (await api.revealSecret(item.id, k)).value

  const addItem = async (groupId, name) => {
    try {
      const item = await api.addItem(boardId, { name, group_id: groupId })
      setData((d) => ({ ...d, items: [item, ...d.items] }))
    } catch (e) {
      setError(e.message)
    }
  }

  const exportCsv = () => {
    const cols = [
      { label: 'Client', value: 'name' },
      { label: 'Group', value: (i) => data.groups.find((g) => g.id === i.group_id)?.name || '' },
      ...data.columns.filter((c) => c.type !== 'secret').map((c) => ({ label: c.name, value: (i) => textOf(c, i.vals?.[c.k], data.people) })),
    ]
    downloadCsv(`skyline-${data.board.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, cols, shown)
  }

  if (error && !data) return <p className="adm-err">{error}</p>
  if (!data) return <p className="adm-dim">Loading…</p>

  const { board, columns, groups, people, me } = data
  const canGroups = ['admin', 'manager'].includes(me.role)
  const isAdmin = me.caps.includes('configure')
  const legacyNames = assignCol ? [...new Set(data.items.map((i) => i.vals?.[assignCol.k]).filter((v) => v && typeof v === 'object').map((v) => v.name))] : []

  return (
    <div className="adm-page wide bd-page">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">Work</span>
          <h1>
            {board.name} <span className="adm-count">{data.items.length}</span>
          </h1>
          {board.description && <p className="adm-intro">{board.description}</p>}
        </div>
        <div className="adm-head-actions">
          <button type="button" className="adm-btn ghost" onClick={exportCsv}>
            Export CSV
          </button>
          {isAdmin && (
            <Link className="adm-btn ghost" to={`/admin/boards/${boardId}/settings`}>
              Board setup
            </Link>
          )}
        </div>
      </header>

      {me.role === 'agent' && <p className="adm-alert soft">You are seeing the clients assigned to you.</p>}
      {isAdmin && legacyNames.length > 0 && (
        <p className="adm-alert">
          {legacyNames.length} name{legacyNames.length > 1 ? 's' : ''} from the old sheets ({legacyNames.join(', ')}) {legacyNames.length > 1 ? 'are' : 'is'} not yet matched to a team
          member, so those clients are not visible to any agent. <Link to={`/admin/boards/${boardId}/settings`}>Match them in board setup</Link>.
        </p>
      )}
      {error && <p className="adm-err">{error}</p>}

      <div className="bd-toolbar">
        <div className="bd-views">
          <button type="button" className={view === 'table' ? 'on' : undefined} onClick={() => setView('table')}>
            Table
          </button>
          {kanbanCol && (
            <button type="button" className={view === 'kanban' ? 'on' : undefined} onClick={() => setView('kanban')}>
              Kanban
            </button>
          )}
        </div>
        <input className="bd-search" type="search" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        {assignCol && me.role !== 'agent' && (
          <select className="bd-select" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Everyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {legacyNames.length > 0 && <option value="legacy">Old-sheet names</option>}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {kanbanCol && (
          <select className="bd-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any {kanbanCol.name.toLowerCase()}</option>
            {(kanbanCol.settings?.labels || []).map((l) => (
              <option key={l.name}>{l.name}</option>
            ))}
          </select>
        )}
        {(q || who || status) && (
          <button type="button" className="bd-link" onClick={() => { setQ(''); setWho(''); setStatus('') }}>
            Clear filters · {shown.length} shown
          </button>
        )}
      </div>

      {view === 'kanban' && kanbanCol ? (
        <Kanban col={kanbanCol} items={shown} columns={columns} people={people} me={me} onSave={saveItem} onOpen={setOpen} />
      ) : (
        <>
          {groups.map((g) => (
            <Group
              key={g.id}
              group={g}
              items={shown.filter((i) => i.group_id === g.id)}
              columns={columns}
              people={people}
              me={me}
              collapsed={Boolean(collapsed[g.id])}
              onToggle={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
              onSave={saveItem}
              onReveal={reveal}
              onOpen={setOpen}
              onAdd={(name) => addItem(g.id, name)}
              canGroups={canGroups}
              onRename={async (name) => {
                await api.updateGroup(g.id, { name }).catch((e) => setError(e.message))
                load()
              }}
              onDelete={async () => {
                if (!confirm(`Delete the empty group "${g.name}"?`)) return
                await api.deleteGroup(g.id).catch((e) => setError(e.message))
                load()
              }}
            />
          ))}
          {shown.some((i) => !groups.some((g) => g.id === i.group_id)) && (
            <Group
              group={{ id: 0, name: 'No group', color: '#c4c4c4' }}
              items={shown.filter((i) => !groups.some((g) => g.id === i.group_id))}
              columns={columns}
              people={people}
              me={me}
              collapsed={Boolean(collapsed[0])}
              onToggle={() => setCollapsed((c) => ({ ...c, 0: !c[0] }))}
              onSave={saveItem}
              onReveal={reveal}
              onOpen={setOpen}
              onAdd={(name) => addItem(null, name)}
              canGroups={false}
            />
          )}
          {canGroups && (
            <form
              className="bd-new-group"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newGroup.trim()) return
                await api.addGroup(boardId, { name: newGroup.trim() }).catch((err) => setError(err.message))
                setNewGroup('')
                load()
              }}
            >
              <input className="bd-input" placeholder="+ New group, e.g. Intake 2027/28" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
            </form>
          )}
        </>
      )}

      {open && (
        <ItemDrawer
          itemId={open}
          columns={columns}
          groups={groups}
          people={people}
          me={me}
          onClose={() => setOpen(null)}
          onChanged={(next) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === next.id ? next : x)) }))}
          onGone={(gid) => {
            setOpen(null)
            setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== gid) }))
          }}
        />
      )}
    </div>
  )
}

