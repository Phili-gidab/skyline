import React, { useEffect, useRef, useState } from 'react'

/* ---------------- shared formatting ---------------- */

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export const personOf = (people, v) => {
  if (typeof v === 'number') return people.find((p) => p.id === v) || { id: v, name: 'Former staff' }
  if (v && typeof v === 'object' && v.name) return { legacy: true, name: v.name }
  return null
}

export const money = (n, col) =>
  n === undefined || n === null || n === ''
    ? ''
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n))} ${col.settings?.currency || 'ETB'}`

export const labelOf = (col, name) => (col.settings?.labels || []).find((l) => l.name === name)

export const dateText = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/* a plain-text rendering of any value, for search and CSV */
export function textOf(col, v, people) {
  if (v === undefined || v === null || v === '') return ''
  switch (col.type) {
    case 'person':
      return personOf(people, v)?.name || ''
    case 'checkbox':
      return v ? 'yes' : 'no'
    case 'money':
      return money(v, col)
    case 'secret':
      return ''
    default:
      return String(v)
  }
}

/* ---------------- a popover that closes on outside click / Esc ---------------- */

export function Pop({ onClose, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const down = (e) => ref.current && !ref.current.contains(e.target) && onClose()
    const key = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div className={`bd-pop ${className}`} ref={ref}>
      {children}
    </div>
  )
}

/* ---------------- status ---------------- */

export function StatusPill({ col, value, onPick, readOnly }) {
  const [open, setOpen] = useState(false)
  const label = labelOf(col, value)
  return (
    <div className="bd-rel">
      <button
        type="button"
        className={`bd-status${label ? '' : ' empty'}`}
        style={label ? { background: label.color } : undefined}
        onClick={() => !readOnly && setOpen((v) => !v)}
        disabled={readOnly}
      >
        {value || '—'}
      </button>
      {open && (
        <Pop onClose={() => setOpen(false)} className="bd-pop--labels">
          {(col.settings?.labels || []).map((l) => (
            <button
              type="button"
              key={l.name}
              className="bd-status"
              style={{ background: l.color }}
              onClick={() => {
                setOpen(false)
                onPick(l.name)
              }}
            >
              {l.name}
            </button>
          ))}
          {value && (
            <button
              type="button"
              className="bd-status empty"
              onClick={() => {
                setOpen(false)
                onPick(null)
              }}
            >
              Clear
            </button>
          )}
        </Pop>
      )}
    </div>
  )
}

/* ---------------- person ---------------- */

export function PersonCell({ value, people, onPick, readOnly }) {
  const [open, setOpen] = useState(false)
  const p = personOf(people, value)
  return (
    <div className="bd-rel">
      <button type="button" className="bd-person" onClick={() => !readOnly && setOpen((v) => !v)} disabled={readOnly}>
        {p ? (
          <>
            <i className={p.legacy ? 'legacy' : ''}>{initials(p.name)}</i>
            <span className={p.legacy ? 'legacy' : ''} title={p.legacy ? 'A name from the old sheets — match it to a team member in board settings' : ''}>
              {p.name}
            </span>
          </>
        ) : (
          <span className="bd-dim">—</span>
        )}
      </button>
      {open && (
        <Pop onClose={() => setOpen(false)} className="bd-pop--people">
          {people.map((x) => (
            <button
              type="button"
              key={x.id}
              className={`bd-person-opt${x.id === value ? ' on' : ''}`}
              onClick={() => {
                setOpen(false)
                onPick(x.id)
              }}
            >
              <i>{initials(x.name)}</i>
              {x.name}
            </button>
          ))}
          {value !== undefined && value !== null && (
            <button
              type="button"
              className="bd-person-opt"
              onClick={() => {
                setOpen(false)
                onPick(null)
              }}
            >
              Unassign
            </button>
          )}
        </Pop>
      )}
    </div>
  )
}

/* ---------------- free text, numbers, dates ---------------- */

function InlineInput({ type, value, display, onSave, readOnly, placeholder }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  if (readOnly) return <span className="bd-text">{display || <span className="bd-dim">—</span>}</span>

  if (!editing) {
    return (
      <button
        type="button"
        className="bd-text bd-editable"
        onClick={() => {
          setDraft(value ?? '')
          setEditing(true)
        }}
      >
        {display || <span className="bd-dim">{placeholder || '—'}</span>}
      </button>
    )
  }

  const commit = () => {
    setEditing(false)
    const next = type === 'number' ? (draft === '' ? null : draft) : draft.trim() === '' ? null : draft
    if (String(next ?? '') !== String(value ?? '')) onSave(next)
  }

  return (
    <input
      ref={ref}
      className="bd-input"
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}

/* ---------------- the cell, by column type ---------------- */

export function Cell({ col, item, people, onSave, onReveal, readOnly }) {
  const v = item.vals?.[col.k]
  const save = (next) => onSave({ [col.k]: next })

  switch (col.type) {
    case 'status':
      return <StatusPill col={col} value={v} onPick={save} readOnly={readOnly} />
    case 'person':
      return <PersonCell value={v} people={people} onPick={save} readOnly={readOnly} />
    case 'checkbox':
      return (
        <label className="bd-check">
          <input type="checkbox" checked={Boolean(v)} disabled={readOnly} onChange={(e) => save(e.target.checked)} />
        </label>
      )
    case 'dropdown':
      return (
        <select className="bd-select" value={v || ''} disabled={readOnly} onChange={(e) => save(e.target.value || null)}>
          <option value="">—</option>
          {(col.settings?.options || []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )
    case 'date':
      return readOnly ? (
        <span className="bd-text">{dateText(v) || <span className="bd-dim">—</span>}</span>
      ) : (
        <input className="bd-input bd-date" type="date" value={v || ''} onChange={(e) => save(e.target.value || null)} />
      )
    case 'money':
      return <InlineInput type="number" value={v} display={money(v, col)} onSave={save} readOnly={readOnly} />
    case 'number':
      return <InlineInput type="number" value={v} display={v ?? ''} onSave={save} readOnly={readOnly} />
    case 'link':
      return v && readOnly ? (
        <a className="bd-text" href={v} target="_blank" rel="noreferrer">
          {v.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <InlineInput type="url" value={v} display={v ? v.replace(/^https?:\/\//, '') : ''} onSave={save} readOnly={readOnly} />
      )
    case 'email':
      return <InlineInput type="email" value={v} display={v} onSave={save} readOnly={readOnly} />
    case 'phone':
      return <InlineInput type="tel" value={v} display={v} onSave={save} readOnly={readOnly} />
    case 'secret':
      return <SecretCell has={Boolean(v)} canReveal={item.can_reveal} onReveal={onReveal} />
    default:
      return <InlineInput type="text" value={v} display={v} onSave={save} readOnly={readOnly} />
  }
}

/* A password shows only that it exists. The person allowed to see it can
   reveal it for twenty seconds; the server logs that they did. */
export function SecretCell({ has, canReveal, onReveal }) {
  const [shown, setShown] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (shown === null) return
    const t = setTimeout(() => setShown(null), 20000)
    return () => clearTimeout(t)
  }, [shown])

  if (!has) return <span className="bd-dim">—</span>
  if (shown !== null) {
    return (
      <span className="bd-secret shown">
        <code>{shown}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(shown)} title="Copy">
          ⧉
        </button>
      </span>
    )
  }
  return (
    <span className="bd-secret">
      <span aria-label="hidden password">••••••</span>
      {canReveal ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              setShown(await onReveal())
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? '…' : 'Reveal'}
        </button>
      ) : (
        <i title="Only an administrator or this client’s agent can see it">🔒</i>
      )}
    </span>
  )
}
