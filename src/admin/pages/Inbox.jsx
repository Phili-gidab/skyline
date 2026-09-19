import React, { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api'
import MailAttachments, { fmtSize } from '../MailAttachments'
import Compose from '../Compose'

const BOXES = [
  { v: 'inbox', label: 'Inbox' },
  { v: 'sent', label: 'Sent' },
  { v: 'archived', label: 'Archived' },
]

const when = (iso) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}
const isImage = (t) => /^image\//.test(t || '')

export default function Inbox() {
  const { counts } = useOutletContext() || {}
  const [box, setBox] = useState('inbox')
  const [list, setList] = useState(null)
  const [unread, setUnread] = useState(0)
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [compose, setCompose] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [previews, setPreviews] = useState({})
  const [lightbox, setLightbox] = useState(null)

  /* attachments are staff-only, so an <img src> cannot reach them: fetch each
     image once as a blob and preview it from an object URL */
  useEffect(() => {
    const made = []
    const m = detail?.message
    if (m) {
      for (const a of m.attachments || []) {
        if (!isImage(a.content_type)) continue
        api
          .attachmentBlobUrl(m.id, a.id)
          .then((url) => {
            made.push(url)
            setPreviews((p) => ({ ...p, [a.id]: url }))
          })
          .catch(() => {})
      }
    }
    return () => {
      made.forEach(URL.revokeObjectURL)
      setPreviews({})
      setLightbox(null)
    }
  }, [detail])

  const load = useCallback(async (b) => {
    try {
      const r = await api.inbox(b)
      setList(r.messages)
      setUnread(r.unread)
    } catch (e) {
      setError(e.message)
      setList([])
    }
  }, [])

  useEffect(() => {
    load(box)
  }, [box, load])

  const open = async (id) => {
    setOpenId(id)
    setDetail(null)
    setReply('')
    setReplyFiles([])
    setError('')
    setNote('')
    try {
      setDetail(await api.inboxMessage(id))
    } catch (e) {
      setError(e.message)
    }
    load(box)
  }

  const setStatus = async (id, status) => {
    try {
      await api.setInboxStatus(id, status)
    } catch (e) {
      return setError(e.message)
    }
    if (openId === id) {
      setOpenId(null)
      setDetail(null)
    }
    load(box)
  }

  const sendReply = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.reply(openId, reply, replyFiles)
      setNote('Reply sent.')
      await open(openId)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (!list) return <p className="adm-dim">Loading…</p>
  const msg = detail?.message
  const others = (detail?.thread || []).filter((t) => t.id !== msg?.id)

  return (
    <div className="adm-page mail-page">
      <header className="mail-bar">
        <h1>Mailbox</h1>
        <nav className="adm-tabs flush">
          {BOXES.map((b) => (
            <button
              key={b.v}
              className={box === b.v ? 'on' : undefined}
              onClick={() => {
                setBox(b.v)
                setOpenId(null)
                setDetail(null)
              }}
            >
              {b.label}
              {b.v === 'inbox' && unread > 0 && <b className="adm-badge">{unread}</b>}
            </button>
          ))}
        </nav>
        <button className="adm-btn" onClick={() => setCompose({})}>
          Write
        </button>
      </header>

      {counts && !counts.mail_ready?.inbound && (
        <div className="adm-alert soft">
          Incoming mail arrives here once the Resend webhook is set up (see <code>docs/deploy-yegara.md</code>). Sent messages already
          appear under Sent.
        </div>
      )}
      {error && <p className="adm-err">{error}</p>}
      {note && <p className="adm-ok">{note}</p>}

      <div className="mail">
        <div className="mail-list">
          {list.map((m) => (
            <button key={m.id} className={`mail-row${m.status === 'unread' ? ' unread' : ''}${openId === m.id ? ' on' : ''}`} onClick={() => open(m.id)}>
              <span className="adm-dot" aria-hidden="true" />
              <span className="mail-row-main">
                <span className="mail-row-top">
                  <b>{m.direction === 'out' ? `To ${m.to_email}` : m.from_name || m.from_email}</b>
                  <small>{when(m.created_at)}</small>
                </span>
                <span className="mail-subject">{m.subject}</span>
                <span className="mail-preview">
                  {m.attachments > 0 && <i className="mail-clip">📎 </i>}
                  {m.preview}
                </span>
              </span>
            </button>
          ))}
          {list.length === 0 && <p className="adm-dim adm-pad">Nothing in {box}.</p>}
        </div>

        <div className="mail-read">
          {!msg && (
            <div className="mail-blank">
              <p>Choose a message to read it.</p>
            </div>
          )}
          {msg && (
            <article>
              <header className="mail-head">
                <h2>{msg.subject}</h2>
                <p className="mail-meta">
                  <b>{msg.from_name || msg.from_email}</b>
                  {msg.from_name && <span> &lt;{msg.from_email}&gt;</span>}
                  {msg.to_email && <span> → {msg.to_email}</span>}
                  <span> · {new Date(msg.created_at).toLocaleString()}</span>
                </p>
                <div className="mail-actions">
                  {msg.direction === 'in' && msg.status !== 'archived' && <button onClick={() => setStatus(msg.id, 'archived')}>Archive</button>}
                  {msg.status === 'archived' && <button onClick={() => setStatus(msg.id, 'read')}>Move to inbox</button>}
                  {msg.direction === 'in' && <button onClick={() => setStatus(msg.id, 'unread')}>Mark unread</button>}
                  <button className="danger" onClick={() => confirm('Delete this message?') && setStatus(msg.id, 'deleted')}>
                    Delete
                  </button>
                </div>
              </header>

              {msg.attachments?.length > 0 && (
                <div className="mail-attach">
                  {msg.attachments.map((a) => (
                    <figure className="mail-file" key={a.id}>
                      {previews[a.id] ? (
                        <button type="button" className="mail-thumb" onClick={() => setLightbox({ url: previews[a.id], name: a.filename })}>
                          <img src={previews[a.id]} alt={a.filename} />
                        </button>
                      ) : (
                        <span className="mail-file-icon">{/pdf/i.test(a.content_type) ? 'PDF' : 'FILE'}</span>
                      )}
                      <figcaption>
                        <b title={a.filename}>{a.filename}</b>
                        <small>{fmtSize(a.size)}</small>
                        <button type="button" className="adm-link" onClick={() => api.downloadAttachment(msg.id, a.id, a.filename).catch((e) => setError(e.message))}>
                          Download
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              <div className="mail-body">{msg.text_body}</div>

              {others.length > 0 && (
                <section className="mail-thread">
                  <h3>Earlier in this conversation</h3>
                  {others.map((t) => (
                    <div className="mail-thread-item" key={t.id}>
                      <b>{t.direction === 'out' ? 'Skyline' : t.from_name || t.from_email}</b>
                      <small> · {new Date(t.created_at).toLocaleString()}</small>
                      <p>{t.text_body}</p>
                    </div>
                  ))}
                </section>
              )}

              {msg.direction === 'in' && (
                <form className="mail-reply" onSubmit={sendReply}>
                  <label className="af">
                    <span className="af-label">Reply to {msg.from_name || msg.from_email}</span>
                    <textarea rows={6} required value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply…" />
                  </label>
                  <MailAttachments files={replyFiles} onChange={setReplyFiles} />
                  <div>
                    <button className="adm-btn" disabled={busy}>
                      {busy ? 'Sending…' : 'Send reply'}
                    </button>
                  </div>
                </form>
              )}
            </article>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="adm-modal" onClick={() => setLightbox(null)}>
          <figure className="mail-lightbox">
            <img src={lightbox.url} alt={lightbox.name} />
            <figcaption>{lightbox.name} — click anywhere to close</figcaption>
          </figure>
        </div>
      )}

      {compose && (
        <Compose
          initial={compose}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null)
            setNote('Message sent.')
            setBox('sent')
          }}
        />
      )}
    </div>
  )
}
