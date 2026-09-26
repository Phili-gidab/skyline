import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { downloadCsv } from '../csv'
import Icon from '../Icon'

/* what each state means, in the office's words */
const STATES = {
  sent: ['Sent', 'grey', 'Handed to Resend; no delivery report yet'],
  delivered: ['Delivered', 'green', 'The recipient’s mail server accepted it'],
  opened: ['Opened', 'green', 'The recipient opened it'],
  delayed: ['Delayed', 'amber', 'Not accepted yet — Resend keeps trying'],
  bounced: ['Bounced', 'red', 'Refused by the recipient’s server — often a mistyped address'],
  complained: ['Marked as spam', 'red', 'The recipient reported it as spam'],
  failed: ['Not sent', 'red', 'Resend refused it — the reason is underneath'],
}

const CSV_COLUMNS = [
  { label: 'Sent', value: (e) => e.created_at },
  { label: 'To', value: 'to_email' },
  { label: 'Subject', value: 'subject' },
  { label: 'Status', value: (e) => STATES[e.status]?.[0] || e.status },
  { label: 'Error', value: 'error' },
]

const PAGE = 100

export default function Email() {
  const [rows, setRows] = useState(null)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [problems, setProblems] = useState(false)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  const load = useCallback(
    async (offset = 0) => {
      setLoadError('')
      try {
        const r = await api.emails({ q: search, status: problems ? 'problems' : '', offset, limit: PAGE })
        setRows((prev) => (offset ? [...(prev || []), ...r.rows] : r.rows))
        setTotal(r.total)
      } catch (e) {
        setLoadError(e.message)
        setRows((prev) => prev || [])
      }
    },
    [search, problems],
  )

  useEffect(() => {
    load(0)
  }, [load])

  const sendTest = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    setError('')
    try {
      const r = await api.sendTestEmail(to)
      if (r.status === 'sent') setMsg(`Sent to ${r.to}. It should arrive within a minute — if not, look in that mailbox’s spam folder.`)
      else setError(`Could not send: ${r.error || 'Resend is not set up'}`)
      load(0)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="page wide">
      <header className="page-head">
        <div>
          <span className="eyebrow">Website messages</span>
          <h1>Email log</h1>
          <p className="muted">Every email the office sends — confirmations to applicants, replies from the mailboxes, sign-in links — and what happened to it.</p>
        </div>
        <div className="page-actions">
          {rows?.length > 0 && (
            <button className="btn ghost" onClick={() => downloadCsv(`skyline-email-${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLUMNS, rows)}>
              <Icon name="download" size={15} /> Export CSV
            </button>
          )}
        </div>
      </header>

      <form className="card test-mail" onSubmit={sendTest}>
        <label className="field">
          <span className="field-label">Send a test email</span>
          <input type="email" placeholder="Blank sends it to your private email" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>
          <Icon name="send" size={15} /> {busy ? 'Sending…' : 'Send test'}
        </button>
        {msg && <p className="form-ok">{msg}</p>}
        {error && <p className="form-err">{error}</p>}
      </form>

      <div className="toolbar">
        <form
          className="search grow"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(q.trim())
          }}
        >
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by recipient or subject" />
        </form>
        <div className="seg">
          <button type="button" className={!problems ? 'is-on' : undefined} onClick={() => setProblems(false)}>
            All
          </button>
          <button type="button" className={problems ? 'is-on' : undefined} onClick={() => setProblems(true)}>
            Not delivered
          </button>
        </div>
      </div>

      {loadError && (
        <p className="notice danger">
          <Icon name="alert" size={16} />
          <span>Could not load the log: {loadError}</span>
          <button className="link-btn" onClick={() => load(0)}>
            Try again
          </button>
        </p>
      )}

      {rows === null ? (
        <div className="page-loading">
          <span className="spinner" />
        </div>
      ) : (
        <section className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const st = STATES[e.status] || [e.status, 'grey', '']
                  return (
                    <tr key={e.id}>
                      <td className="nowrap muted">{new Date(e.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="clip">{e.to_email}</td>
                      <td className="clip">{e.subject}</td>
                      <td>
                        <span className={`badge ${st[1]}`} title={st[2]}>
                          {st[0]}
                        </span>
                        {e.error && <small className="err-note">{e.error}</small>}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && !loadError && (
                  <tr>
                    <td colSpan="4" className="muted">
                      {search || problems ? 'Nothing matches.' : 'Nothing sent yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length < total && (
            <footer className="card-foot center">
              <button className="btn ghost sm" onClick={() => load(rows.length)}>
                Show more ({total - rows.length} older)
              </button>
            </footer>
          )}
        </section>
      )}
    </div>
  )
}
