import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api'

export default function Account() {
  const { user } = useOutletContext() || {}
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    setError('')
    if (next !== again) return setError('The two new passwords do not match')
    setBusy(true)
    try {
      await api.changePassword(current, next)
      setMsg('Password changed.')
      setCurrent('')
      setNext('')
      setAgain('')
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">Settings</span>
          <h1>My account</h1>
        </div>
      </header>
      {user && (
        <p className="adm-intro">
          Signed in as <b>{user.email}</b> — {user.role === 'admin' ? 'administrator' : 'editor'}.
        </p>
      )}
      <form className="adm-form adm-card narrow" onSubmit={submit}>
        <h2 className="adm-sub flush">Change password</h2>
        <label className="af">
          <span className="af-label">Current password</span>
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="af">
          <span className="af-label">New password</span>
          <input type="password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <small className="af-help">At least 10 characters.</small>
        </label>
        <label className="af">
          <span className="af-label">New password, once more</span>
          <input type="password" required minLength={10} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
        </label>
        {msg && <p className="adm-ok">{msg}</p>}
        {error && <p className="adm-err">{error}</p>}
        <div>
          <button className="adm-btn" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  )
}
