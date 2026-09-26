import React, { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api'
import { ROLES, roleLabel } from '../roles'
import Icon from '../Icon'
import { Avatar } from './Mailbox'

/* The team and the mailboxes. Everyone signs in with their own address at
   the office's domain — which is also their mailbox — and gets their first
   password through a one-time link sent to their private email: no password
   is ever emailed, and no link ever goes to a mailbox inside the admin. */

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : null)
const localPart = (email) => String(email || '').split('@')[0]

function AddressInput({ value, onChange, domain, autoFocus }) {
  return (
    <div className="addr-input">
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, '').replace(/@.*$/, ''))}
        placeholder="name"
        autoFocus={autoFocus}
        spellCheck={false}
        autoCapitalize="none"
        pattern="[a-z0-9]([a-z0-9._\-]*[a-z0-9])?"
        title="Letters, numbers, dots and dashes"
      />
      <span>@{domain}</span>
    </div>
  )
}

function PersonDialog({ person, domain, onClose, onSaved }) {
  const isNew = !person?.id
  const [f, setF] = useState({
    name: person?.name || '',
    address: person?.own_address ? localPart(person.email) : '',
    recovery_email: person?.recovery_email || (person && !person.own_address ? person.email : ''),
    role: person?.role || 'agent',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (isNew) {
        const r = await api.createUser(f)
        onSaved(
          r.invited
            ? `${r.email} is set up. The link to choose a password went to ${f.recovery_email}.`
            : `${r.email} is set up, but the sign-in email could not be sent — see the Email log, then use “Send a sign-in link”.`,
        )
      } else {
        const patch = { name: f.name, recovery_email: f.recovery_email, address: f.address }
        if (f.role !== person.role) patch.role = f.role
        const r = await api.updateUser(person.id, patch)
        onSaved(`Saved. ${person.name || 'They'} sign${person.name ? 's' : ''} in as ${r.email}.`)
      }
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={isNew ? 'Add a person' : 'Edit'}>
      <form className="modal-card" onSubmit={save}>
        <header className="modal-head">
          <h2 className="modal-title">{isNew ? 'Add a person' : `Edit ${person.name || person.email}`}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="form">
          <label className="field">
            <span className="field-label">Name</span>
            <input required value={f.name} onChange={set('name')} autoFocus={isNew} placeholder="e.g. Hana Tesfaye" />
          </label>
          <div className="field">
            <span className="field-label">Skyline address</span>
            <AddressInput value={f.address} onChange={(v) => setF((x) => ({ ...x, address: v }))} domain={domain} />
            <small className="field-help">They sign in with it, and it is their own mailbox. {!isNew && 'Changing it takes their mailbox along; mail to the old address then goes to the catch-all.'}</small>
          </div>
          <label className="field">
            <span className="field-label">Private email</span>
            <input type="email" required={isNew} value={f.recovery_email} onChange={set('recovery_email')} placeholder="their own Gmail or similar" />
            <small className="field-help">Where their sign-in and password-reset links go. Never an address at @{domain}.</small>
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select value={f.role} onChange={set('role')}>
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
            <small className="field-help">{ROLES[f.role]?.about}</small>
          </label>
          {error && <p className="form-err">{error}</p>}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Add and send the link' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function MailboxDialog({ box, users, domain, onClose, onSaved }) {
  const isNew = !box?.id
  const shared = isNew || box.kind === 'shared'
  const [f, setF] = useState({
    address: box ? localPart(box.address) : '',
    name: box?.name || 'Skyline Travel Solution',
    roles: box?.roles || [],
    members: box?.members || [],
    catch_all: Boolean(box?.catch_all),
    website: Boolean(box?.website),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toggle = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (isNew) await api.createMailbox(f)
      else
        await api.updateMailbox(
          box.id,
          shared ? { name: f.name, roles: f.roles, members: f.members, catch_all: f.catch_all, website: f.website } : { name: f.name, catch_all: f.catch_all, website: f.website },
        )
      onSaved(isNew ? `${f.address}@${domain} is ready — mail to it arrives in the admin.` : 'Mailbox saved.')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={isNew ? 'New shared mailbox' : 'Edit mailbox'}>
      <form className="modal-card" onSubmit={save}>
        <header className="modal-head">
          <h2 className="modal-title">{isNew ? 'New shared mailbox' : box.address}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="form">
          {isNew && (
            <div className="field">
              <span className="field-label">Address</span>
              <AddressInput value={f.address} onChange={(v) => setF((x) => ({ ...x, address: v }))} domain={domain} autoFocus />
            </div>
          )}
          <label className="field">
            <span className="field-label">Name people see</span>
            <input required value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
            <small className="field-help">Shown as the sender, e.g. “{f.name || 'Skyline Travel Solution'}” &lt;{isNew ? `${f.address || 'name'}@${domain}` : box.address}&gt;.</small>
          </label>
          {shared && (
            <>
              <fieldset className="field">
                <legend className="field-label">Read by everyone who is a…</legend>
                <div className="check-grid">
                  {Object.entries(ROLES).map(([k, r]) => (
                    <label key={k} className="check-row">
                      <input type="checkbox" checked={f.roles.includes(k)} onChange={() => toggle('roles', k)} />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend className="field-label">…and these people by name</legend>
                <div className="check-grid">
                  {users
                    .filter((u) => !u.is_disabled)
                    .map((u) => (
                      <label key={u.id} className="check-row">
                        <input type="checkbox" checked={f.members.includes(u.id)} onChange={() => toggle('members', u.id)} />
                        <span>
                          {u.name || u.email} <small className="muted">{roleLabel(u.role)}</small>
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
            </>
          )}
          <label className="check-row">
            <input type="checkbox" checked={f.catch_all} onChange={(e) => setF((x) => ({ ...x, catch_all: e.target.checked }))} disabled={box?.catch_all} />
            <span>
              Catch-all — mail to any @{domain} address that has no mailbox comes here
              {box?.catch_all && <small className="muted"> (to change it, make another mailbox the catch-all)</small>}
            </span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={f.website} onChange={(e) => setF((x) => ({ ...x, website: e.target.checked }))} disabled={box?.website} />
            <span>
              Website mailbox — confirmations to people who use the website’s forms are sent from here, and new submissions are filed here
              {box?.website && <small className="muted"> (to change it, choose another mailbox)</small>}
            </span>
          </label>
          {error && <p className="form-err">{error}</p>}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Create mailbox' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default function Team() {
  const { user, refreshCounts } = useOutletContext() || {}
  const [people, setPeople] = useState(null)
  const [mail, setMail] = useState(null)
  const [domain, setDomain] = useState('')
  const [dialog, setDialog] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([api.users(), api.mailSettings()])
      setPeople(u.users)
      setDomain(u.domain)
      setMail(m)
    } catch (e) {
      setError(e.message)
      setPeople((p) => p || [])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!people) return <div className="page-loading"><span className="spinner" /></div>

  const done = (msg) => {
    setDialog(null)
    setError('')
    setNote(msg)
    load()
    refreshCounts?.()
  }

  const update = async (u, patch, confirmText) => {
    if (confirmText && !confirm(confirmText)) return
    setError('')
    setNote('')
    setBusyId(u.id)
    try {
      await api.updateUser(u.id, patch)
      await load()
    } catch (e) {
      setError(e.message)
    }
    setBusyId(null)
  }

  const invite = async (u) => {
    setError('')
    setNote('')
    setBusyId(u.id)
    try {
      const r = await api.inviteUser(u.id)
      setNote(`A link to set a password was sent to ${r.to}.`)
    } catch (e) {
      setError(e.message)
    }
    setBusyId(null)
  }

  const removeBox = async (b) => {
    if (!confirm(`Delete the mailbox ${b.address}? Mail sent to it afterwards goes to the catch-all.`)) return
    try {
      await api.deleteMailbox(b.id)
      done(`${b.address} was deleted.`)
    } catch (e) {
      setError(e.message)
    }
  }

  const nameOf = (id) => {
    const u = people.find((p) => p.id === id)
    return u ? u.name || u.email : `#${id}`
  }

  return (
    <div className="page wide">
      <header className="page-head">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Team &amp; mailboxes</h1>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setDialog({ type: 'person' })}>
            <Icon name="plus" size={16} /> Add a person
          </button>
        </div>
      </header>

      {note && <p className="notice ok"><Icon name="checkCircle" size={16} /><span>{note}</span></p>}
      {error && <p className="notice danger"><Icon name="alert" size={16} /><span>{error}</span></p>}

      <section className="card flush">
        <header className="card-head">
          <h2>People <span className="muted">{people.length}</span></h2>
          <small className="muted">Each person signs in with their Skyline address. Their role decides what they can see — the server enforces it, not only the menu.</small>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Private email</th>
                <th>Last signed in</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {people.map((u) => {
                const me = u.id === user?.id
                return (
                  <tr key={u.id} className={u.is_disabled ? 'is-off' : undefined}>
                    <td>
                      <div className="person">
                        <Avatar name={u.name} email={u.email} size={32} />
                        <span>
                          <b>{u.name || '—'}</b>
                          <small className={u.own_address ? 'muted' : 'warn-text'}>
                            {u.email}
                            {!u.own_address && ' — not a Skyline address yet'}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="select-sm"
                        value={u.role}
                        disabled={me || busyId === u.id}
                        onChange={(e) => update(u, { role: e.target.value }, `Make ${u.name || u.email} ${roleLabel(e.target.value)}?\n\n${ROLES[e.target.value].about}`)}
                      >
                        {Object.entries(ROLES).map(([k, r]) => (
                          <option key={k} value={k}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{u.recovery_email || <span className="warn-text">None — they cannot reset a password</span>}</td>
                    <td>{u.is_disabled ? <span className="badge red">No access</span> : when(u.last_login_at) || <span className="muted">Never</span>}</td>
                    <td className="row-actions">
                      <button className="btn ghost sm" onClick={() => setDialog({ type: 'person', person: u })}>
                        Edit
                      </button>
                      {!me && !u.is_disabled && (
                        <button className="btn ghost sm" disabled={busyId === u.id} onClick={() => invite(u)}>
                          {busyId === u.id ? 'Sending…' : 'Send a sign-in link'}
                        </button>
                      )}
                      {!me && (
                        <button
                          className={`btn ghost sm${u.is_disabled ? '' : ' danger'}`}
                          disabled={busyId === u.id}
                          onClick={() =>
                            update(u, { is_disabled: !u.is_disabled }, u.is_disabled ? null : `Remove ${u.name || u.email}'s access? They are signed out at once. Their clients and mail stay.`)
                          }
                        >
                          {u.is_disabled ? 'Restore access' : 'Remove access'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {mail && (
        <section className="card flush">
          <header className="card-head">
            <h2>Mailboxes <span className="muted">{mail.boxes.length}</span></h2>
            <button className="btn ghost sm" onClick={() => setDialog({ type: 'box' })}>
              <Icon name="plus" size={15} /> New shared mailbox
            </button>
          </header>
          <p className="card-note muted">
            Every address at @{mail.domain} arrives here through Resend. A person’s own mailbox is made with their account; shared ones are read by the
            roles and people you choose.{' '}
            {mail.website ? (
              <>
                The website sends its confirmations from <b>{mail.website}</b> and files new form submissions there.
              </>
            ) : (
              'No mailbox is set as the website mailbox yet — edit one and tick “Website mailbox”.'
            )}
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Read by</th>
                  <th>Mail</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {mail.boxes.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="person">
                        <span className={`box-ic${b.kind === 'shared' ? ' shared' : ''}`}>
                          <Icon name={b.kind === 'shared' ? 'users' : 'user'} size={16} />
                        </span>
                        <span>
                          <b>{b.address}</b>
                          <small className="muted">
                            “{b.name}”{b.catch_all && <span className="badge green xs">catch-all</span>}
                            {b.website && <span className="badge blue xs">website</span>}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {b.kind === 'personal' ? (
                        <span>{nameOf(b.owner_id)} <small className="muted">(own)</small></span>
                      ) : (
                        <div className="chips">
                          {b.roles.map((r) => (
                            <span key={r} className="chip">
                              every {roleLabel(r).toLowerCase()}
                            </span>
                          ))}
                          {b.members.map((id) => (
                            <span key={id} className="chip">
                              {nameOf(id)}
                            </span>
                          ))}
                          {!b.roles.length && !b.members.length && <span className="warn-text">Nobody yet — administrators only</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {b.messages} {b.unread > 0 && <span className="badge green">{b.unread} unread</span>}
                    </td>
                    <td className="row-actions">
                      <button className="btn ghost sm" onClick={() => setDialog({ type: 'box', box: b })}>
                        Edit
                      </button>
                      {b.kind === 'shared' && !b.catch_all && !b.website && (
                        <button className="btn ghost sm danger" onClick={() => removeBox(b)} disabled={b.messages > 0} title={b.messages > 0 ? 'Only an empty mailbox can be deleted' : undefined}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <details className="card roles-card">
        <summary>What each role can do</summary>
        <dl className="roles">
          {Object.entries(ROLES).map(([k, r]) => (
            <div key={k}>
              <dt>{r.label}</dt>
              <dd>{r.about}</dd>
            </div>
          ))}
        </dl>
      </details>

      {dialog?.type === 'person' && <PersonDialog person={dialog.person} domain={domain} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.type === 'box' && mail && <MailboxDialog box={dialog.box} users={mail.users} domain={mail.domain} onClose={() => setDialog(null)} onSaved={done} />}
    </div>
  )
}
