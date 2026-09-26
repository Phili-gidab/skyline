import React, { useEffect, useRef, useState } from 'react'
import { api } from './api'
import Icon from './Icon'
import MailAttachments from './MailAttachments'

/* Writing an email: new, reply, reply-all or forward, from any mailbox the
   writer belongs to. A dialog for new messages, forwards and answering a form
   submission; inline under a conversation for replies.

   What is typed is kept as a draft in this browser until it is sent or
   discarded, so a slip of the mouse or an ended session loses nothing. */

const DRAFTS = 'skyline-mail-drafts'
const readDrafts = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS) || '{}')
  } catch {
    return {}
  }
}
const writeDraft = (key, draft) => {
  try {
    const all = readDrafts()
    if (draft) all[key] = { ...draft, saved: Date.now() }
    else delete all[key]
    localStorage.setItem(DRAFTS, JSON.stringify(all))
  } catch {
    /* no storage: the draft lives only while the window is open */
  }
}

export const boxLabel = (b) => (b.name ? `${b.name} <${b.address}>` : b.address)

export default function Compose({ boxes: givenBoxes, signature: givenSignature, initial = {}, draftKey = 'new', inline = false, onClose, onSent }) {
  const [boxes, setBoxes] = useState(givenBoxes || null)
  const [signature, setSignature] = useState(givenSignature ?? null)
  const [saved] = useState(() => readDrafts()[draftKey] || null)
  const [draft, setDraft] = useState(() => ({ from_box: '', to: '', cc: '', subject: '', text: '', ...initial, ...(saved || {}) }))
  const [files, setFiles] = useState(saved?.files || [])
  const [touched, setTouched] = useState(Boolean(saved))
  const [showCc, setShowCc] = useState(Boolean(draft.cc))
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signed = useRef(Boolean(saved))
  const body = useRef(null)

  useEffect(() => {
    if (givenBoxes) setBoxes(givenBoxes)
  }, [givenBoxes])

  /* the boxes and the signature, when the caller did not pass them */
  useEffect(() => {
    if (givenBoxes && givenSignature !== undefined) return
    api
      .mailBoxes()
      .then((r) => {
        if (!givenBoxes) setBoxes(r.boxes)
        if (givenSignature === undefined) setSignature(r.signature || '')
      })
      .catch((e) => setError(e.message))
  }, [givenBoxes, givenSignature])

  const mine = (boxes || []).filter((b) => b.member)

  /* a sensible From, and the signature under a fresh draft */
  useEffect(() => {
    if (!mine.length || signature === null) return
    setDraft((d) => {
      const next = { ...d }
      if (!mine.some((b) => b.id === Number(d.from_box))) {
        next.from_box = ((initial.preferSystem && mine.find((b) => b.system)) || mine[0]).id
      }
      if (!signed.current && signature) next.text = `${d.text || ''}\n\n${signature}`
      signed.current = true
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, signature])

  /* the draft follows every change into this browser's storage */
  useEffect(() => {
    if (touched) writeDraft(draftKey, { ...draft, files })
  }, [draft, files, touched, draftKey])

  useEffect(() => {
    if (!inline || !body.current) return
    body.current.focus()
    body.current.setSelectionRange(0, 0)
    body.current.scrollTop = 0
  }, [inline, signature])

  const set = (k) => (e) => {
    const v = e.target.value
    setTouched(true)
    setDraft((d) => ({ ...d, [k]: v }))
  }
  const setAttachments = (fn) => {
    setTouched(true)
    setFiles(fn)
  }

  const discard = () => {
    if (touched && (files.length || draft.to !== (initial.to || '') || (draft.text || '').trim()) && !confirm('Discard this draft?')) return
    writeDraft(draftKey, null)
    onClose?.()
  }

  const send = async (e) => {
    e?.preventDefault()
    if (uploading || busy) return
    setBusy(true)
    setError('')
    try {
      const r = await api.sendMail({
        ...draft,
        from_box: Number(draft.from_box),
        quote: Boolean(draft.reply_to_id) && draft.quote !== false,
        attachments: files,
      })
      writeDraft(draftKey, null)
      onSent?.(r.id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const keys = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send(e)
    if (e.key === 'Escape' && !inline) {
      e.stopPropagation()
      discard()
    }
  }

  const title = draft.forward_of ? 'Forward' : draft.reply_to_id ? 'Reply' : 'New message'

  const form = (
    <form className={`compose${inline ? ' is-inline' : ''}`} onSubmit={send} onKeyDown={keys}>
      <header className="compose-head">
        <h2>{title}</h2>
        {saved && <span className="hint">Draft restored</span>}
        {!inline && (
          <button type="button" className="icon-btn" onClick={discard} aria-label="Close">
            <Icon name="x" />
          </button>
        )}
      </header>
      <div className="compose-fields">
        <label className="compose-row">
          <span>From</span>
          {mine.length > 1 ? (
            <select value={draft.from_box} onChange={set('from_box')}>
              {mine.map((b) => (
                <option key={b.id} value={b.id}>
                  {boxLabel(b)}
                </option>
              ))}
            </select>
          ) : (
            <b className="compose-static">{mine[0] ? boxLabel(mine[0]) : boxes ? 'You have no mailbox to send from' : 'Loading…'}</b>
          )}
        </label>
        <label className="compose-row">
          <span>To</span>
          <input required value={draft.to} onChange={set('to')} placeholder="name@example.com" autoFocus={!inline && !draft.to} />
          {!showCc && (
            <button type="button" className="link-btn" onClick={() => setShowCc(true)}>
              Cc
            </button>
          )}
        </label>
        {showCc && (
          <label className="compose-row">
            <span>Cc</span>
            <input value={draft.cc} onChange={set('cc')} placeholder="Copy someone in — separate addresses with commas" />
          </label>
        )}
        <label className="compose-row">
          <span>Subject</span>
          <input required value={draft.subject} onChange={set('subject')} />
        </label>
      </div>
      <textarea
        ref={body}
        className="compose-text"
        rows={inline ? 9 : 14}
        value={draft.text}
        onChange={set('text')}
        placeholder="Write your message…"
        autoFocus={!inline && Boolean(draft.to)}
      />
      {draft.reply_to_id && (
        <label className="check-row">
          <input type="checkbox" checked={draft.quote !== false} onChange={(e) => setDraft((d) => ({ ...d, quote: e.target.checked }))} />
          <span>Include their message underneath</span>
        </label>
      )}
      {draft.forward_of && <p className="hint">The original message and its attachments go along underneath.</p>}
      <MailAttachments files={files} onChange={setAttachments} onBusy={setUploading} />
      {error && <p className="form-err">{error}</p>}
      <footer className="compose-foot">
        <button className="btn" disabled={busy || uploading || !mine.length}>
          <Icon name="send" size={15} />
          {busy ? 'Sending…' : uploading ? 'Attaching…' : 'Send'}
        </button>
        <button type="button" className="btn ghost" onClick={discard}>
          {inline ? 'Discard' : 'Cancel'}
        </button>
        <small className="hint push">Ctrl + Enter to send</small>
      </footer>
    </form>
  )

  if (inline) return form
  /* a dialog that closes only on purpose: a click that strays onto the
     backdrop must not throw a message away */
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card wide">{form}</div>
    </div>
  )
}
