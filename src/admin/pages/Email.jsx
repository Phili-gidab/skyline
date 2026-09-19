import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { downloadCsv } from '../csv'

/* delivery states worth a colour; everything else renders neutral */
const TONE = { delivered: 'ok', opened: 'ok', sent: 'pending', delayed: 'pending', bounced: 'failed', complained: 'failed', failed: 'failed' }

const CSV_COLUMNS = [
  { label: 'Sent', value: (e) => e.created_at },
  { label: 'To', value: 'to_email' },
  { label: 'Subject', value: 'subject' },
  { label: 'Sent via', value: 'provider' },
  { label: 'Status', value: 'status' },
  { label: 'Error', value: 'error' },
]

export default function Email() {
  const [rows, setRows] = useState(null)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = () => api.emails().then(setRows).catch(() => setRows([]))
  useEffect(() => {
    load()
  }, [])

  const sendTest = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    setError('')
    try {
      const r = await api.sendTestEmail(to)
      if (r.status === 'sent') setMsg(`Sent to ${r.to} via ${r.provider}. Check that inbox — and its spam folder.`)
      else setError(`Could not send: ${r.error || 'no email route is configured'}`)
      load()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (!rows) return <p className="adm-dim">Loading…</p>
  const failed = rows.filter((r) => TONE[r.status] === 'failed').length

  return (
    <div className="adm-page wide">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">Messages</span>
          <h1>
            Email log <span className="adm-count">{rows.length}</span>
          </h1>
        </div>
        <div className="adm-head-actions">
          {failed > 0 && <span className="adm-err">{failed} not delivered</span>}
          {rows.length > 0 && (
            <button className="adm-btn ghost" onClick={() => downloadCsv(`skyline-email-${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLUMNS, rows)}>
              Export CSV
            </button>
          )}
        </div>
      </header>
      <p className="adm-intro">Every email the website sends — notices to the office, confirmations to visitors, replies — with what the mail provider reported back.</p>

      <form className="adm-inline adm-card" onSubmit={sendTest}>
        <label className="af">
          <span className="af-label">Send a test email to</span>
          <input type="email" placeholder="you@example.com (blank = your own address)" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="adm-btn" disabled={busy}>
          {busy ? 'Sending…' : 'Send test'}
        </button>
      </form>
      {msg && <p className="adm-ok">{msg}</p>}
      {error && <p className="adm-err">{error}</p>}

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Sent</th>
              <th>To</th>
              <th>Subject</th>
              <th>Via</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleString()}</td>
                <td>{e.to_email}</td>
                <td>{e.subject}</td>
                <td>{e.provider}</td>
                <td>
                  <span className={`adm-pill ${TONE[e.status] || ''}`}>{e.status}</span>
                  {e.error && (
                    <>
                      <br />
                      <small className="adm-dim">{e.error}</small>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="5" className="adm-dim">
                  Nothing sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
