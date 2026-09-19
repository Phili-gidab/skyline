import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { FORM_KINDS, SINGLETONS, COLLECTIONS } from '../schemas'

const when = (iso) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const [o, setO] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.overview().then(setO).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="adm-err">{error}</p>
  if (!o) return <p className="adm-dim">Loading…</p>

  const mailOk = o.mail_ready.resend || o.mail_ready.smtp

  return (
    <div className="adm-page wide">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">Overview</span>
          <h1>{greeting()}</h1>
        </div>
        <a className="adm-btn ghost" href="/" target="_blank" rel="noreferrer">
          View the website ↗
        </a>
      </header>

      {!mailOk && (
        <div className="adm-alert">
          <b>Email is not set up yet.</b> Form submissions are still saved here, but no one is emailed about them. Add a Resend
          key or the office mailbox to the server config — see <code>docs/deploy-yegara.md</code>.
        </div>
      )}
      {!o.mail_ready.inbound && (
        <div className="adm-alert soft">
          <b>The mailbox is not receiving yet.</b> It fills once the Resend webhook secret is in the server config.
        </div>
      )}

      <div className="adm-tiles">
        {Object.entries(FORM_KINDS).map(([k, f]) => {
          const c = o.forms[k] || { total: 0, unread: 0 }
          return (
            <Link key={k} className={`adm-tile${c.unread ? ' hot' : ''}`} to={`/admin/submissions?kind=${k}`}>
              <b>{c.unread}</b>
              <span>new {f.plural.toLowerCase()}</span>
              <small>{c.total} in total</small>
            </Link>
          )
        })}
        <Link className={`adm-tile${o.inbox_unread ? ' hot' : ''}`} to="/admin/inbox">
          <b>{o.inbox_unread}</b>
          <span>unread emails</span>
          <small>Mailbox</small>
        </Link>
      </div>

      {o.mail_failed_7d > 0 && (
        <p className="adm-err" style={{ marginTop: 16 }}>
          {o.mail_failed_7d} email{o.mail_failed_7d > 1 ? 's were' : ' was'} not delivered in the last 7 days —{' '}
          <Link to="/admin/email">see the email log</Link>.
        </p>
      )}

      <div className="adm-dash">
        <section>
          <h2 className="adm-sub">Latest submissions</h2>
          <div className="adm-list">
            {o.recent.length === 0 && <p className="adm-dim adm-pad">Nothing yet. Submissions from the website forms appear here.</p>}
            {o.recent.map((r) => (
              <Link key={r.id} className={`adm-recent${r.is_read ? '' : ' unread'}`} to={`/admin/submissions?kind=${r.kind}`}>
                <span className="adm-dot" aria-hidden="true" />
                <b>{r.name}</b>
                <span className="adm-pill">{FORM_KINDS[r.kind]?.label || r.kind}</span>
                <small>{when(r.created_at)}</small>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="adm-sub">Edit the website</h2>
          <div className="adm-quick">
            {[...SINGLETONS.map((s) => ({ ...s, to: `/admin/s/${s.key}` })), ...COLLECTIONS.map((c) => ({ ...c, to: `/admin/c/${c.key}` }))].map((x) => (
              <Link key={x.to} to={x.to}>
                <i aria-hidden="true">{x.icon}</i>
                {x.label}
              </Link>
            ))}
          </div>
          {o.content_updated && <p className="adm-dim" style={{ marginTop: 12 }}>Last change: {when(o.content_updated)}</p>}
        </section>
      </div>
    </div>
  )
}
