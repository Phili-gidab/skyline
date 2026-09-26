import React, { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api, setToken } from '../api'
import { roleLabel, ROLES } from '../roles'
import Icon from '../Icon'

export default function Account() {
  const { user, counts } = useOutletContext() || {}
  const [me, setMe] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pw, setPw] = useState({ current: '', next: '', again: '' })
  const [msg, setMsg] = useState({})
  const [busy, setBusy] = useState('')

  const load = () =>
    api
      .me()
      .then((m) => {
        setMe(m)
        setProfile({ name: m.name || '', recovery_email: m.recovery_email || '', signature: m.signature || '' })
      })
      .catch((e) => setMsg({ profile: ['err', e.message] }))

  useEffect(() => {
    load()
  }, [])

  if (!me || !profile) return <div className="page-loading"><span className="spinner" /></div>

  const saveProfile = async (e) => {
    e.preventDefault()
    setBusy('profile')
    setMsg({})
    try {
      await api.updateProfile(profile)
      setMsg({ profile: ['ok', 'Saved.'] })
      load()
    } catch (err) {
      setMsg({ profile: ['err', err.message] })
    }
    setBusy('')
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setMsg({})
    if (pw.next !== pw.again) return setMsg({ pw: ['err', 'The two new passwords do not match'] })
    setBusy('pw')
    try {
      const r = await api.changePassword(pw.current, pw.next)
      if (r.token) setToken(r.token)
      setMsg({ pw: ['ok', 'Password changed. Anywhere else you were signed in has been signed out.'] })
      setPw({ current: '', next: '', again: '' })
    } catch (err) {
      setMsg({ pw: ['err', err.message] })
    }
    setBusy('')
  }

  const note = (k) => msg[k] && <p className={msg[k][0] === 'ok' ? 'form-ok' : 'form-err'}>{msg[k][1]}</p>
  const boxes = counts?.mailboxes || []

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>My account</h1>
        </div>
      </header>

      <section className="card">
        <div className="me-card">
          <span className="avatar lg">{(me.name || me.email).slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{me.name || me.email}</b>
            <span className="muted">
              Signs in as <b>{me.email}</b> · {roleLabel(me.role)}
            </span>
            <small className="muted">{ROLES[me.role]?.about}</small>
          </div>
        </div>
        {boxes.length > 0 && (
          <div className="me-boxes">
            <span className="field-label">Your mailboxes</span>
            <div className="chips">
              {boxes.map((b) => (
                <Link key={b.id} className="chip link" to={`/admin/mail?box=${b.id}`}>
                  <Icon name={b.kind === 'shared' ? 'users' : 'user'} size={13} /> {b.address}
                  {b.unread > 0 && <span className="count">{b.unread}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <form className="card form" onSubmit={saveProfile}>
        <h2 className="card-title">Profile</h2>
        <label className="field">
          <span className="field-label">Name</span>
          <input required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <small className="field-help">How colleagues see you, and the sender name on mail from your own mailbox.</small>
        </label>
        <label className="field">
          <span className="field-label">Private email</span>
          <input type="email" value={profile.recovery_email} onChange={(e) => setProfile({ ...profile, recovery_email: e.target.value })} placeholder="you@gmail.com" />
          <small className="field-help">
            Where a password-reset link goes if you forget your password. It has to be outside @{me.mail_domain} — your Skyline mailbox is only readable once you are signed in.
          </small>
        </label>
        <label className="field">
          <span className="field-label">Email signature</span>
          <textarea rows={5} value={profile.signature} onChange={(e) => setProfile({ ...profile, signature: e.target.value })} />
          <small className="field-help">Put under every new email and reply you write. Clear it to go back to the standard one.</small>
        </label>
        {note('profile')}
        <div>
          <button className="btn" disabled={busy === 'profile'}>
            {busy === 'profile' ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <form className="card form" onSubmit={savePassword}>
        <h2 className="card-title">Change password</h2>
        <label className="field">
          <span className="field-label">Current password</span>
          <input type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
        </label>
        <div className="field-pair">
          <label className="field">
            <span className="field-label">New password</span>
            <input type="password" required minLength={10} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
            <small className="field-help">At least 10 characters.</small>
          </label>
          <label className="field">
            <span className="field-label">New password, once more</span>
            <input type="password" required minLength={10} value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} autoComplete="new-password" />
          </label>
        </div>
        {note('pw')}
        <div>
          <button className="btn" disabled={busy === 'pw'}>
            {busy === 'pw' ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  )
}
