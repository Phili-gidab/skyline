import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { api } from '../api'
import { FORM_KINDS, SINGLETONS, COLLECTIONS } from '../schemas'
import { roleLabel } from '../roles'
import Icon from '../Icon'
import Compose from '../Compose'
import { fmtWhen } from './Mailbox'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function MailboxCard({ box }) {
  return (
    <section className="card flush dash-box">
      <header className="card-head">
        <Link to={`/admin/mail?box=${box.id}`} className="dash-box-title">
          <span className={`box-ic${box.kind === 'shared' ? ' shared' : ''}`}>
            <Icon name={box.kind === 'shared' ? 'users' : 'user'} size={16} />
          </span>
          <span>
            <b>{box.address}</b>
            <small className="muted">{box.kind === 'shared' ? `Shared · ${box.name}` : 'Your own mailbox'}</small>
          </span>
        </Link>
        {box.unread > 0 ? <span className="count lg">{box.unread}</span> : <span className="muted small">All read</span>}
      </header>
      {box.latest.length === 0 ? (
        <p className="dash-empty muted">Nothing here yet. Mail sent to {box.address} lands here.</p>
      ) : (
        <ul className="dash-mail">
          {box.latest.map((m) => (
            <li key={m.id}>
              <Link to={`/admin/mail?box=${box.id}&open=${m.id}`} className={m.unread ? 'is-unread' : undefined}>
                <span className="dash-mail-dot" aria-hidden="true" />
                <b>{m.from}</b>
                <span className="dash-mail-subject">
                  {m.form && <span className="chip green xs">Form</span>}
                  {m.subject}
                </span>
                <time>{fmtWhen(m.created_at)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <footer className="card-foot">
        <Link to={`/admin/mail?box=${box.id}`} className="link-btn">
          Open {box.address.split('@')[0]}@ <Icon name="arrowRight" size={14} />
        </Link>
      </footer>
    </section>
  )
}

function StatusBar({ breakdown, total }) {
  if (!total || !breakdown?.length) return null
  return (
    <>
      <div className="stack-bar" role="img" aria-label={breakdown.map((b) => `${b.label}: ${b.n}`).join(', ')}>
        {breakdown.map((b) => (
          <span key={b.label} style={{ flexGrow: b.n, background: b.color }} title={`${b.label}: ${b.n}`} />
        ))}
      </div>
      <ul className="legend">
        {[...breakdown]
          .sort((a, b) => b.n - a.n)
          .slice(0, 4)
          .map((b) => (
            <li key={b.label}>
              <span className="swatch" style={{ background: b.color }} />
              {b.label} <b>{b.n}</b>
            </li>
          ))}
      </ul>
    </>
  )
}

export default function Dashboard() {
  const { refreshCounts } = useOutletContext() || {}
  const [o, setO] = useState(null)
  const [error, setError] = useState('')
  const [writing, setWriting] = useState(false)
  const [note, setNote] = useState('')
  const navigate = useNavigate()

  const load = () =>
    api
      .overview()
      .then((r) => {
        setO(r)
        setError('')
      })
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

  if (!o) {
    return error ? (
      <div className="page">
        <p className="notice danger">
          <Icon name="alert" size={16} />
          <span>{error}</span>
          <button className="link-btn" onClick={load}>
            Try again
          </button>
        </p>
      </div>
    ) : (
      <div className="page-loading">
        <span className="spinner" />
      </div>
    )
  }

  const caps = o.caps || []
  const newBoard = async () => {
    const name = prompt('Name of the new board, e.g. "Canada visit visas"')
    if (!name?.trim()) return
    try {
      const { id } = await api.createBoard({ name: name.trim() })
      refreshCounts?.()
      navigate(`/admin/boards/${id}/settings`)
    } catch (e) {
      setNote('')
      setError(e.message)
    }
  }

  const firstName = (o.name || '').split(' ')[0]
  const boxes = o.mailboxes || []
  const myItems = o.my_items || []
  const unreadForms = o.forms ? Object.values(o.forms).reduce((n, f) => n + f.unread, 0) : 0

  return (
    <div className="page wide dash">
      <header className="page-head">
        <div>
          <span className="eyebrow">{roleLabel(o.role)}</span>
          <h1>
            {greeting()}
            {firstName && `, ${firstName}`}
          </h1>
          <p className="muted">
            Signed in as <b>{o.email}</b>
            {o.mail_unread > 0 && (
              <>
                {' '}
                · <Link to="/admin/mail">{o.mail_unread} unread email{o.mail_unread === 1 ? '' : 's'}</Link>
              </>
            )}
            {caps.includes('messages') && unreadForms > 0 && (
              <>
                {' '}
                · <Link to="/admin/submissions">{unreadForms} new from the website</Link>
              </>
            )}
          </p>
        </div>
        <div className="page-actions">
          {boxes.length > 0 && (
            <button className="btn" onClick={() => setWriting(true)}>
              <Icon name="pencil" size={16} /> Write an email
            </button>
          )}
          <a className="btn ghost" href="/" target="_blank" rel="noreferrer">
            <Icon name="external" size={15} /> Website
          </a>
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
      {!o.mail_ready?.resend && (
        <p className="notice danger">
          <Icon name="alert" size={16} />
          <span>
            <b>Email is not set up.</b> Nothing can be sent until the Resend key is in the server config.
          </span>
        </p>
      )}
      {o.mail_failed_7d > 0 && (
        <p className="notice warn">
          <Icon name="alert" size={16} />
          <span>
            {o.mail_failed_7d} email{o.mail_failed_7d > 1 ? 's were' : ' was'} not delivered in the last 7 days.
          </span>
          <Link className="link-btn" to="/admin/email">
            See the email log
          </Link>
        </p>
      )}

      {boxes.length > 0 && (
        <section className="dash-section">
          <h2 className="section-title">Your mailboxes</h2>
          <div className="dash-boxes">
            {boxes.map((b) => (
              <MailboxCard key={b.id} box={b} />
            ))}
          </div>
        </section>
      )}

      {caps.includes('boards') && (myItems.length > 0 || o.role === 'agent') && (
        <section className="dash-section">
          <h2 className="section-title">
            Your clients <span className="muted">{myItems.length}</span>
          </h2>
          {myItems.length === 0 ? (
            <div className="card">
              <p className="muted">No clients are assigned to you yet. When someone assigns you a client, they appear here and on the boards.</p>
            </div>
          ) : (
            <div className="card flush">
              <ul className="dash-clients">
                {myItems.slice(0, 12).map((it) => (
                  <li key={it.id}>
                    <Link to={`/admin/boards/${it.board_id}?open=${it.id}`}>
                      <b>{it.name}</b>
                      <span className="muted">{it.board}</span>
                      {it.status ? (
                        <span className="status-pill" style={{ background: it.status.color }}>
                          {it.status.label}
                        </span>
                      ) : (
                        <span className="status-pill empty">No status</span>
                      )}
                      <time className="muted">{fmtWhen(it.updated_at)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
              {myItems.length > 12 && <p className="card-note muted">…and {myItems.length - 12} more on the boards.</p>}
            </div>
          )}
        </section>
      )}

      {caps.includes('boards') && (o.boards || []).length + (caps.includes('configure') ? 1 : 0) > 0 && (
        <section className="dash-section">
          <h2 className="section-title">{o.role === 'agent' ? 'Boards' : 'Clients by board'}</h2>
          <div className="dash-boards">
            {(o.boards || []).map((b) => (
              <Link key={b.id} className="card board-card" to={`/admin/boards/${b.id}`}>
                <div className="board-card-top">
                  <span className="box-ic shared">
                    <Icon name="board" size={16} />
                  </span>
                  <b>{b.name}</b>
                  <span className="board-card-n">{b.items}</span>
                </div>
                <small className="muted">{o.role === 'agent' ? 'assigned to you' : `clients${b.status ? ` · by ${b.status.toLowerCase()}` : ''}`}</small>
                <StatusBar breakdown={b.breakdown} total={b.items} />
              </Link>
            ))}
            {caps.includes('configure') && (
              <button type="button" className="card board-card add" onClick={newBoard}>
                <Icon name="plus" size={20} />
                <b>New board</b>
                <small className="muted">for a new kind of file</small>
              </button>
            )}
          </div>
        </section>
      )}

      <div className="dash-cols">
        {caps.includes('messages') && (
          <section className="dash-section">
            <h2 className="section-title">From the website</h2>
            <div className="dash-forms">
              {Object.entries(FORM_KINDS).map(([k, f]) => {
                const c = o.forms?.[k] || { total: 0, unread: 0 }
                return (
                  <Link key={k} className={`stat${c.unread ? ' is-hot' : ''}`} to={`/admin/submissions?kind=${k}`}>
                    <b>{c.unread}</b>
                    <span>new {f.plural.toLowerCase()}</span>
                    <small className="muted">{c.total} in total</small>
                  </Link>
                )
              })}
            </div>
            <div className="card flush">
              {(o.recent || []).length === 0 ? (
                <p className="dash-empty muted">Nothing yet. Enquiries and applications from the website forms appear here.</p>
              ) : (
                <ul className="dash-list">
                  {o.recent.map((r) => (
                    <li key={r.id}>
                      <Link to={`/admin/submissions?kind=${r.kind}&open=${r.id}`} className={r.is_read ? undefined : 'is-unread'}>
                        <span className="dash-mail-dot" aria-hidden="true" />
                        <b>{r.name}</b>
                        <span className="chip xs">{FORM_KINDS[r.kind]?.label || r.kind}</span>
                        <time className="muted">{fmtWhen(r.created_at)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <div className="dash-side">
          {o.team && (
            <section className="card">
              <h2 className="card-title">Team</h2>
              <ul className="kv">
                <li>
                  <span>People</span>
                  <b>{o.team.people}</b>
                </li>
                <li>
                  <span>Signed in the last 14 days</span>
                  <b>{o.team.active}</b>
                </li>
                <li>
                  <span>Never signed in</span>
                  <b>{o.team.never}</b>
                </li>
              </ul>
              <Link className="link-btn" to="/admin/team">
                Team &amp; mailboxes <Icon name="arrowRight" size={14} />
              </Link>
            </section>
          )}
          {caps.includes('messages') && (
            <section className="card">
              <h2 className="card-title">Email</h2>
              <ul className="kv">
                <li>
                  <span>Sending (Resend)</span>
                  <b className={o.mail_ready?.resend ? 'ok-text' : 'warn-text'}>{o.mail_ready?.resend ? 'Working' : 'Not set up'}</b>
                </li>
                <li>
                  <span>Receiving</span>
                  <b className={o.mail_ready?.inbound ? 'ok-text' : 'warn-text'}>{o.mail_ready?.inbound ? 'Working' : 'Not set up'}</b>
                </li>
                <li>
                  <span>Sent in 7 days</span>
                  <b>{o.mail_sent_7d ?? 0}</b>
                </li>
                <li>
                  <span>Not delivered</span>
                  <b className={o.mail_failed_7d ? 'warn-text' : undefined}>{o.mail_failed_7d}</b>
                </li>
              </ul>
              <Link className="link-btn" to="/admin/email">
                Email log <Icon name="arrowRight" size={14} />
              </Link>
            </section>
          )}
          {caps.includes('content') && (
            <section className="card">
              <h2 className="card-title">Website</h2>
              <div className="quick">
                {[...SINGLETONS.map((s) => ({ ...s, to: `/admin/s/${s.key}` })), ...COLLECTIONS.map((c) => ({ ...c, to: `/admin/c/${c.key}` }))].map((x) => (
                  <Link key={x.to} to={x.to}>
                    {x.label}
                  </Link>
                ))}
              </div>
              {o.content_updated && <p className="muted small">Last change {fmtWhen(o.content_updated)}</p>}
            </section>
          )}
        </div>
      </div>

      {writing && (
        <Compose
          draftKey="new"
          onClose={() => setWriting(false)}
          onSent={() => {
            setWriting(false)
            setNote('Sent.')
            load()
          }}
        />
      )}
    </div>
  )
}
