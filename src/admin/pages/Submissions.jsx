import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { FORM_KINDS, EXTRA_LABELS } from '../schemas'
import { downloadCsv } from '../csv'
import Compose from '../Compose'
import Icon from '../Icon'
import { fmtSize } from '../MailAttachments'
import { fmtWhen } from './Mailbox'

const when = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

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
  { label: 'Documents', value: (s) => (s.extra?.documents || []).map((d) => `${d.label}: ${d.filename}`).join('; ') },
  { label: 'Message', value: 'message' },
  { label: 'Read', value: (s) => (s.is_read ? 'yes' : 'no') },
]

const PAGE = 50

function Detail({ s, boards, onReply, onChanged, onError }) {
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  const toBoard = async (boardId) => {
    if (!boardId) return
    setAdding(true)
    try {
      const r = await api.fromSubmission(Number(boardId), s.id)
      navigate(`/admin/boards/${boardId}?open=${r.id}`)
    } catch (e) {
      onError(e.message)
      setAdding(false)
    }
  }

  const markUnread = async () => {
    try {
      await api.setRead(s.id, false)
      onChanged(null)
    } catch (e) {
      onError(e.message)
    }
  }

  const remove = async () => {
    const docs = s.extra?.documents?.length || 0
    const files = [s.extra?.cv && 'their CV', docs && `${docs} document${docs === 1 ? '' : 's'}`].filter(Boolean).join(' and ')
    const text =
      `Delete ${s.name}’s ${FORM_KINDS[s.kind]?.label.toLowerCase() || 'submission'}${files ? ` and ${files}` : ''}? This cannot be undone.` +
      (docs ? '\n\nDocuments a client on a board still uses are kept for that client.' : '')
    if (!confirm(text)) return
    try {
      await api.deleteSubmission(s.id)
      onChanged(null)
    } catch (e) {
      onError(e.message)
    }
  }

  return (
    <div className="sub-detail">
      <dl className="facts">
        <div>
          <dt>Phone</dt>
          <dd>
            <a href={`tel:${s.phone}`}>{s.phone}</a>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{s.email || '—'}</dd>
        </div>
        {Object.entries(EXTRA_LABELS).map(([k, label]) =>
          s.extra?.[k] ? (
            <div key={k}>
              <dt>{label}</dt>
              <dd>{s.extra[k]}</dd>
            </div>
          ) : null,
        )}
        <div>
          <dt>Received</dt>
          <dd>{when(s.created_at)}</dd>
        </div>
      </dl>
      {s.message && <p className="sub-msg">{s.message}</p>}
      {s.extra?.cv && (
        <div className="docs">
          <div className="docs-row">
            <span className="docs-type">CV</span>
            <span className="docs-name">
              <b>{s.extra.cv.filename}</b>
              <small>{fmtSize(s.extra.cv.size)}</small>
            </span>
            <button className="btn ghost sm" onClick={() => api.downloadCv(s.id, s.extra.cv.filename).catch((e) => onError(e.message))}>
              <Icon name="download" size={14} /> Download
            </button>
          </div>
        </div>
      )}
      {s.extra?.documents?.length > 0 && (
        <div className="docs">
          <h3 className="docs-title">
            Documents <span className="muted">{s.extra.documents.length}</span>
          </h3>
          {s.extra.documents.map((d, n) => (
            <div className="docs-row" key={d.stored}>
              <span className="docs-type">{(d.filename.split('.').pop() || '').slice(0, 4).toUpperCase()}</span>
              <span className="docs-name">
                <b>{d.label}</b>
                <small>
                  {d.filename} · {fmtSize(d.size)}
                </small>
              </span>
              <span className="docs-actions">
                {/^(application\/pdf|image\/(jpeg|png|webp))$/.test(d.type) && (
                  <button className="btn ghost sm" onClick={() => api.openDocument(s.id, n).catch((e) => onError(e.message))}>
                    <Icon name="eye" size={14} /> Open
                  </button>
                )}
                <button className="btn ghost sm" onClick={() => api.downloadDocument(s.id, n, `${s.name} — ${d.label} — ${d.filename}`).catch((e) => onError(e.message))}>
                  <Icon name="download" size={14} /> Download
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="sub-actions">
        {s.email && (
          <button className="btn sm" onClick={() => onReply(s)}>
            <Icon name="reply" size={14} /> Reply by email
          </button>
        )}
        <a className="btn ghost sm" href={`https://wa.me/${waNumber(s.phone)}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <a className="btn ghost sm" href={`tel:${s.phone}`}>
          <Icon name="phone" size={14} /> Call
        </a>
        {boards.length > 0 && (
          <select className="select-sm" value="" disabled={adding} onChange={(e) => toBoard(e.target.value)} aria-label="Add to a board">
            <option value="">{adding ? 'Adding…' : 'Add to a board…'}</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <span className="push" />
        <button className="btn ghost sm" onClick={markUnread}>
          Mark unread
        </button>
        <button className="btn ghost sm danger" onClick={remove}>
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>
    </div>
  )
}

export default function Submissions() {
  const [params, setParams] = useSearchParams()
  const kind = FORM_KINDS[params.get('kind')] ? params.get('kind') : ''
  const openParam = Number(params.get('open')) || null
  const [rows, setRows] = useState(null)
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState({})
  const [extraOpen, setExtraOpen] = useState(null)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(openParam)
  const [compose, setCompose] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const { counts, refreshCounts } = useOutletContext() || {}
  const boards = counts?.boards || []

  const load = useCallback(
    async (offset = 0) => {
      try {
        const r = await api.submissions({ kind, q: search, offset, limit: PAGE })
        setRows((prev) => (offset ? [...(prev || []), ...r.rows] : r.rows))
        setTotal(r.total)
        setUnread(r.unread || {})
      } catch (e) {
        setError(e.message)
        setRows((prev) => prev || [])
      }
    },
    [kind, search],
  )

  useEffect(() => {
    load(0)
  }, [load])

  /* a link to one submission (from the dashboard or a mailbox notice) opens it, even if it is further down than the first page */
  useEffect(() => {
    if (!openParam) return
    setOpenId(openParam)
    if (rows && !rows.some((r) => r.id === openParam)) {
      api
        .submission(openParam)
        .then(setExtraOpen)
        .catch((e) => setError(e.message))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam, rows === null])

  useEffect(() => {
    if (!openId) return
    const s = rows?.find((r) => r.id === openId) || (extraOpen?.id === openId ? extraOpen : null)
    if (s && !s.is_read) {
      setRows((list) => list?.map((r) => (r.id === s.id ? { ...r, is_read: true } : r)))
      api.setRead(s.id, true).then(() => refreshCounts?.()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, rows?.length, extraOpen])

  const setKind = (k) => {
    setOpenId(null)
    setExtraOpen(null)
    setParams(k ? { kind: k } : {})
  }

  const reply = (s) => {
    const label = FORM_KINDS[s.kind]?.label.toLowerCase() || 'message'
    setCompose({
      key: `sub-${s.id}`,
      initial: {
        to: s.email,
        subject: `Your ${label} — Skyline Travel Solution`,
        text: `Dear ${s.name.split(' ')[0]},\n\nThank you for your ${label}${summary(s) ? ` (${summary(s)})` : ''}.\n\n`,
        submission_id: s.id,
        preferSystem: true,
      },
    })
  }

  const exportCsv = async () => {
    try {
      const r = await api.submissions({ kind, q: search, limit: 1000 })
      downloadCsv(`skyline-${kind || 'submissions'}-${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLUMNS, r.rows)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!rows) return <div className="page-loading"><span className="spinner" /></div>

  const allUnread = Object.values(unread).reduce((a, b) => a + b, 0)
  const list = extraOpen && !rows.some((r) => r.id === extraOpen.id) ? [extraOpen, ...rows] : rows

  return (
    <div className="page wide">
      <header className="page-head">
        <div>
          <span className="eyebrow">Website messages</span>
          <h1>Form submissions</h1>
          <p className="muted">Enquiries and applications from the website, with the documents people sent.</p>
        </div>
        <div className="page-actions">
          {total > 0 && (
            <button className="btn ghost" onClick={exportCsv}>
              <Icon name="download" size={15} /> Export CSV
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="notice danger">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
      {note && (
        <p className="notice ok">
          <Icon name="checkCircle" size={16} />
          <span>{note}</span>
        </p>
      )}

      <div className="toolbar">
        <div className="seg">
          {[['', 'All', allUnread], ...Object.entries(FORM_KINDS).map(([k, f]) => [k, f.plural, unread[k] || 0])].map(([k, label, n]) => (
            <button key={k || 'all'} className={kind === k ? 'is-on' : undefined} onClick={() => setKind(k)}>
              {label}
              {n > 0 && <span className="count">{n}</span>}
            </button>
          ))}
        </div>
        <form
          className="search grow"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(q.trim())
          }}
        >
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, phones, emails, messages" />
        </form>
      </div>

      <section className="card flush">
        {list.length === 0 && (
          <div className="empty">
            <Icon name="form" size={28} />
            <p>{search ? 'Nothing matches that search.' : 'Nothing here yet. Enquiries and applications from the website forms appear here.'}</p>
          </div>
        )}
        {list.map((s) => {
          const isOpen = openId === s.id
          const docs = s.extra?.documents?.length || 0
          return (
            <article key={s.id} className={`sub${s.is_read ? '' : ' is-unread'}${isOpen ? ' is-open' : ''}`}>
              <button className="sub-row" onClick={() => setOpenId(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <span className="sub-dot" aria-hidden="true" />
                <b className="sub-name">{s.name}</b>
                <span className="chip xs">{FORM_KINDS[s.kind]?.label || s.kind}</span>
                <span className="sub-sum">{summary(s) || s.message || s.phone}</span>
                <span className="sub-files">
                  {s.extra?.cv && <span className="badge green">CV</span>}
                  {docs > 0 && (
                    <span className="badge green">
                      <Icon name="clip" size={12} /> {docs}
                    </span>
                  )}
                </span>
                <time title={when(s.created_at)}>{fmtWhen(s.created_at)}</time>
                <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={16} className="muted" />
              </button>
              {isOpen && (
                <Detail
                  s={s}
                  boards={boards}
                  onReply={reply}
                  onError={setError}
                  onChanged={() => {
                    setOpenId(null)
                    setExtraOpen(null)
                    load(0)
                    refreshCounts?.()
                  }}
                />
              )}
            </article>
          )
        })}
        {rows.length < total && (
          <footer className="card-foot center">
            <button className="btn ghost sm" onClick={() => load(rows.length)}>
              Show more ({total - rows.length} older)
            </button>
          </footer>
        )}
      </section>

      {compose && (
        <Compose
          key={compose.key}
          draftKey={compose.key}
          initial={compose.initial}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null)
            setNote('Sent — the conversation is in your mailbox under Sent.')
            load(0)
          }}
        />
      )}
    </div>
  )
}
