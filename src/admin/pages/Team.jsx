import React, { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api'
import { ROLES } from '../roles'

/* Admins manage the team. Nobody is ever emailed a password: a new colleague
   gets a one-time link to choose their own. */
export default function Team() {
  const { user } = useOutletContext() || {}
  const [rows, setRows] = useState(null)
  const [add, setAdd] = useState({ email: '', name: '', role: 'editor' })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    api
      .users()
      .then(setRows)
      .catch((e) => {
        setError(e.message)
        setRows([])
      })
  useEffect(() => {
    load()
  }, [])

  if (user && user.role !== 'admin') return <p className="adm-dim">Only an administrator can manage the team.</p>
  if (!rows) return <p className="adm-dim">Loading…</p>

  const update = async (u, patch) => {
    setError('')
    setNote('')
    try {
      await api.updateUser(u.id, patch)
    } catch (e) {
      setError(e.message)
    }
    load()
  }

  const invite = async (u) => {
    setError('')
    try {
      await api.inviteUser(u.id)
      setNote(`A new link to set a password was sent to ${u.email}.`)
    } catch (e) {
      setError(e.message)
    }
  }

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNote('')
    try {
      await api.createUser(add)
      setNote(`${add.email} was invited — they will get an email to choose a password.`)
      setAdd({ email: '', name: '', role: 'editor' })
      load()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="adm-page wide">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">Settings</span>
          <h1>
            Team <span className="adm-count">{rows.length}</span>
          </h1>
        </div>
      </header>
      <p className="adm-intro">
        Each person's role decides what they can see — the server enforces it, not just the menu.
      </p>
      <dl className="adm-roles">
        {Object.entries(ROLES).map(([k, r]) => (
          <div key={k}>
            <dt>{r.label}</dt>
            <dd>{r.about}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="adm-ok">{note}</p>}
      {error && <p className="adm-err">{error}</p>}

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Last signed in</th>
              <th>Access</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={u.is_disabled ? 'off' : undefined}>
                <td>
                  <b>{u.name || '—'}</b>
                  <br />
                  <small className="adm-dim">{u.email}</small>
                </td>
                <td>
                  <select value={u.role} onChange={(e) => update(u, { role: e.target.value })} disabled={u.email === user?.email}>
                    {Object.entries(ROLES).map(([k, r]) => (
                      <option key={k} value={k}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : <span className="adm-dim">Never</span>}</td>
                <td>
                  {u.email === user?.email ? (
                    <span className="adm-dim">You</span>
                  ) : (
                    <button className={`adm-btn small ${u.is_disabled ? '' : 'ghost'}`} onClick={() => update(u, { is_disabled: !u.is_disabled })}>
                      {u.is_disabled ? 'Restore access' : 'Remove access'}
                    </button>
                  )}
                </td>
                <td>
                  {!u.is_disabled && u.email !== user?.email && (
                    <button className="adm-link" onClick={() => invite(u)}>
                      Send a new sign-in link
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="adm-sub">Invite someone</h2>
      <form className="adm-inline adm-card" onSubmit={create}>
        <label className="af">
          <span className="af-label">Email</span>
          <input type="email" required value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} />
        </label>
        <label className="af">
          <span className="af-label">Name</span>
          <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
        </label>
        <label className="af narrow">
          <span className="af-label">Role</span>
          <select value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })}>
            {Object.entries(ROLES).map(([k, r]) => (
              <option key={k} value={k}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button className="adm-btn" disabled={busy}>
          {busy ? 'Inviting…' : 'Send invitation'}
        </button>
      </form>
    </div>
  )
}
