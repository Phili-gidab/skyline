import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { FORM_KINDS, EXTRA_LABELS } from '../schemas'
import { downloadCsv } from '../csv'
import Compose from '../Compose'
import { fmtSize } from '../MailAttachments'

const when = (iso) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/* an Ethiopian number as WhatsApp wants it: 0911 … → 251911 … */
const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '')
  if (String(phone).trim().startsWith('+')) return d
  return d.startsWith('0') ? `251${d.slice(1)}` : d
}

const summary = (s) => [s.extra?.destination, s.extra?.visa, s.extra?.programme, s.extra?.role].filter(Boolean).join(' · ')

const CSV_COLUMNS = [
  { label: 'Date', value: (s) => s.created_at },
  { label: 'Form', value: (s) => FORM_KINDS[s.kind]?.label || s.kind },
  { label: 'Name', value: 'name' },
  { label: 'Phone', value: 'phone' },
  { label: 'Email', value: 'email' },
  ...Object.entries(EXTRA_LABELS).map(([k, label]) => ({ label, value: (s) => s.extra?.[k] || '' })),
  { label: 'CV', value: (s) => s.extra?.cv?.filename || '' },
  { label: 'Message', value: 'message' },
  { label: 'Read', value: (s) => (s.is_read ? 'yes' : 'no') },
]

export default function Submissions() {
  const [params, setParams] = useSearchParams()
  const kind = FORM_KINDS[params.get('kind')] ? params.get('kind') : ''
  const [rows, setRows] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [compose, setCompose] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    api
      .submissions()
      .then(setRows)
      .catch((e) => {
        setError(e.message)
        setRows([])
      })
  useEffect(() => {
    load()
  }, [])

  const setKind = (k) => {
    setOpenId(null)
    setParams(k ? { kind: k } : {})
  }

  const toggle = async (s) => {
    setOpenId(openId === s.id ? null : s.id)
    // opening one counts as reading it
    if (!s.is_read && openId !== s.id) {
      setRows((list) => list.map((r) => (r.id === s.id ? { ...r, is_read: true } : r)))
      api.setRead(s.id, true).catch(() => {})
    }
  }

  const markUnread = async (s) => {
    await api.setRead(s.id, false).catch((e) => setError(e.message))
    setOpenId(null)
    load()
  }

  const remove = async (s) => {
    if (!confirm(`Delete ${s.name}’s ${FORM_KINDS[s.kind]?.label.toLowerCase() || 'submission'}${s.extra?.cv ? ' and their CV' : ''}? This cannot be undone.`)) return
    await api.deleteSubmission(s.id).catch((e) => setError(e.message))
    setOpenId(null)
    load()
  }

  const reply = (s) => {
    const label = FORM_KINDS[s.kind]?.label.toLowerCase() || 'message'
    setCompose({
      to: s.email,
      subject: `Your ${label} — Skyline Travel Solution`,
      text: `Dear ${s.name.split(' ')[0]},\n\nThank you for your ${label}${summary(s) ? ` (${summary(s)})` : ''}.\n\n\n\nKind regards,\nSkyline Travel Solution`,
      submission_id: s.id,
    })
  }

  if (!rows) return <p className="adm-dim">Loading…</p>

  const shown = rows.filter((r) => !kind || r.kind === kind)
  const unread = (k) => rows.filter((r) => (!k || r.kind === k) && !r.is_read).length

  return (
    <div className="adm-page wide">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">Messages</span>
          <h1>
            Form submissions <span className="adm-count">{shown.length}</span>
          </h1>
        </div>
        <div className="adm-head-actions">
          {shown.length > 0 && (
            <button className="adm-btn ghost" onClick={() => downloadCsv(`skyline-${kind || 'submissions'}-${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLUMNS, shown)}>
              Export CSV
            </button>
          )}
        </div>
      </header>
      {error && <p className="adm-err">{error}</p>}
      {note && <p className="adm-ok">{note}</p>}

      <div className="adm-tabs">
        {[['', 'All'], ...Object.entries(FORM_KINDS).map(([k, f]) => [k, f.plural])].map(([k, label]) => (
          <button key={k || 'all'} className={kind === k ? 'on' : undefined} onClick={() => setKind(k)}>
            {label}
            {unread(k) > 0 && <b className="adm-badge">{unread(k)}</b>}
          </button>
        ))}
      </div>

      <div className="adm-subs">
        {shown.length === 0 && <p className="adm-dim adm-pad">Nothing here yet. Submissions from the website forms appear here.</p>}
        {shown.map((s) => {
          const isOpen = openId === s.id
          return (
            <article key={s.id} className={`adm-sub-card${s.is_read ? '' : ' unread'}${isOpen ? ' open' : ''}`}>
              <button className="adm-sub-row" onClick={() => toggle(s)} aria-expanded={isOpen}>
                <span className="adm-dot" aria-hidden="true" />
                <b>{s.name}</b>
                <span className="adm-pill">{FORM_KINDS[s.kind]?.label || s.kind}</span>
                <span className="adm-sub-sum">{summary(s)}</span>
                {s.extra?.cv && <span className="adm-pill ok">CV</span>}
                <small>{when(s.created_at)}</small>
              </button>

              {isOpen && (
                <div className="adm-sub-detail">
                  <dl className="adm-facts">
                    <div>
                      <dt>Phone</dt>
                      <dd>
                        <a href={`tel:${s.phone}`}>{s.phone}</a>
                      </dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : '—'}</dd>
                    </div>
                    {Object.entries(EXTRA_LABELS).map(([k, label]) =>
                      s.extra?.[k] ? (
                        <div key={k}>
                          <dt>{label}</dt>
                          <dd>{s.extra[k]}</dd>
                        </div>
                      ) : null
                    )}
                  </dl>
                  {s.message && <p className="adm-sub-msg">{s.message}</p>}
                  {s.extra?.cv && (
                    <p className="adm-sub-cv">
                      <button
                        className="adm-btn small ghost"
                        onClick={() => api.downloadCv(s.id, s.extra.cv.filename).catch((e) => setError(e.message))}
                      >
                        Download CV — {s.extra.cv.filename} ({fmtSize(s.extra.cv.size)})
                      </button>
                    </p>
                  )}
                  <div className="adm-sub-actions">
                    {s.email && (
                      <button className="adm-btn small" onClick={() => reply(s)}>
                        Reply by email
                      </button>
                    )}
                    <a className="adm-btn small ghost" href={`https://wa.me/${waNumber(s.phone)}`} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                    <a className="adm-btn small ghost" href={`tel:${s.phone}`}>
                      Call
                    </a>
                    <button className="adm-btn small ghost" onClick={() => markUnread(s)}>
                      Mark unread
                    </button>
                    <button className="adm-btn small ghost danger" onClick={() => remove(s)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {compose && (
        <Compose
          initial={compose}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null)
            setNote('Sent — a copy is under Mailbox → Sent.')
            load()
          }}
        />
      )}
    </div>
  )
}
