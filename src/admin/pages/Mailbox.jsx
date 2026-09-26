import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import Icon from '../Icon'
import Compose from '../Compose'
import { fmtSize } from '../MailAttachments'

/* The mailboxes: every box this person reads down the left, a box's
   conversations in the middle, the open conversation on the right.
   Box, folder, search and open message live in the URL, so the dashboard
   (and the browser's Back button) can point straight at any of them. */

const FOLDERS = [
  { v: 'inbox', label: 'Inbox', icon: 'inbox' },
  { v: 'sent', label: 'Sent', icon: 'send' },
  { v: 'archived', label: 'Archived', icon: 'archive' },
  { v: 'spam', label: 'Spam', icon: 'spam' },
  { v: 'trash', label: 'Trash', icon: 'trash' },
]

const DELIVERY = {
  sent: ['Sent', 'grey', 'Handed to the mail service — waiting to hear it arrived'],
  delivered: ['Delivered', 'green', 'Their mail server accepted it'],
  opened: ['Opened', 'green', 'They opened it'],
  delayed: ['Delayed', 'amber', 'Their server has not accepted it yet — the mail service keeps trying'],
  bounced: ['Bounced', 'red', 'Their mail server refused it — check the address'],
  complained: ['Marked as spam', 'red', 'The recipient marked it as spam'],
}

const sameDay = (a, b) => a.toDateString() === b.toDateString()
export const fmtWhen = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return 'Yesterday'
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}
const fmtFull = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

const PALETTE = ['#0e8f47', '#2563eb', '#9333ea', '#c2410c', '#0891b2', '#be185d', '#4d7c0f', '#b45309']
export function Avatar({ name, email, size = 34 }) {
  const label = (name || email || '?').trim()
  const parts = label.replace(/<.*>/, '').split(/[\s.@_-]+/).filter(Boolean)
  const initials = ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase()
  let h = 0
  for (const c of email || label) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <span className="avatar" style={{ width: size, height: size, background: PALETTE[h % PALETTE.length], fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  )
}

const who = (m) => m.from_name || m.from_email
const splitList = (s) =>
  String(s || '')
    .split(/\s*,\s*/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

/* a conversation per row: the newest message stands for the thread */
function groupThreads(messages) {
  const map = new Map()
  for (const m of messages) {
    const t = map.get(m.thread_key)
    if (!t) map.set(m.thread_key, { key: m.thread_key, top: m, ids: [m.id], unread: m.status === 'unread', n: 1, attachments: m.attachments > 0 })
    else {
      t.ids.push(m.id)
      t.n++
      t.unread = t.unread || m.status === 'unread'
      t.attachments = t.attachments || m.attachments > 0
    }
  }
  return [...map.values()]
}

/* ---------- message bodies ---------- */

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g
function Linkified({ text }) {
  const parts = String(text).split(URL_RE)
  return parts.map((p, i) =>
    i % 2 ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer">
        {p}
      </a>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  )
}

/* what was written, apart from the quoted history underneath it */
function splitQuoted(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  let at = lines.findIndex((l, i) => /^\s*On .{6,200} wrote:\s*$/.test(l) && /^\s*>/.test(lines[i + 1] || ''))
  if (at < 0) {
    let j = lines.length - 1
    while (j >= 0 && (/^\s*>/.test(lines[j]) || !lines[j].trim())) j--
    if (lines.slice(j + 1).filter((l) => /^\s*>/.test(l)).length >= 2) at = j + 1
  }
  if (at <= 0) return [text, '']
  return [lines.slice(0, at).join('\n').trimEnd(), lines.slice(at).join('\n')]
}

function TextBody({ text }) {
  const [main, quoted] = splitQuoted(text)
  const [open, setOpen] = useState(false)
  return (
    <div className="mail-text">
      <Linkified text={main || '(no text)'} />
      {quoted && (
        <>
          <button type="button" className="quote-toggle" onClick={() => setOpen((v) => !v)} title={open ? 'Hide the quoted text' : 'Show the quoted text'}>
            •••
          </button>
          {open && (
            <div className="mail-quoted">
              <Linkified text={quoted} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* Received HTML, shown the way a mail client shows it but inert: a sandboxed
   frame with no scripts, links opening in a new tab, and pictures from the
   internet held back until asked for — a remote image tells the sender the
   mail was opened. */
function HtmlBody({ html, message }) {
  const [images, setImages] = useState(false)
  const [height, setHeight] = useState(160)
  const [cids, setCids] = useState({})
  const frame = useRef(null)

  useEffect(() => {
    const made = []
    for (const a of message.attachments || []) {
      if (!a.cid || !/^image\//.test(a.content_type)) continue
      api
        .mailAttachmentBlobUrl(message.id, a.id)
        .then((url) => {
          made.push(url)
          setCids((c) => ({ ...c, [a.cid]: url }))
        })
        .catch(() => {})
    }
    return () => made.forEach(URL.revokeObjectURL)
  }, [message])

  const remote = /<img[^>]+src\s*=\s*["']?\s*https?:/i.test(html) || /url\(\s*["']?\s*https?:/i.test(html)

  const doc = useMemo(() => {
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    parsed.querySelectorAll('script,iframe,object,embed,form,input,button,textarea,select,meta,link,base,frame,frameset').forEach((n) => n.remove())
    parsed.querySelectorAll('*').forEach((el) => {
      for (const at of [...el.attributes]) if (/^on/i.test(at.name)) el.removeAttribute(at.name)
    })
    parsed.querySelectorAll('a').forEach((a) => {
      const href = (a.getAttribute('href') || '').trim()
      if (!/^(https?:|mailto:|tel:)/i.test(href)) a.removeAttribute('href')
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    })
    parsed.querySelectorAll('img').forEach((img) => {
      const src = (img.getAttribute('src') || '').trim()
      if (/^cid:/i.test(src)) {
        const id = src.slice(4).replace(/[<>]/g, '')
        if (cids[id]) img.setAttribute('src', cids[id])
      }
    })
    const styles = [...parsed.querySelectorAll('style')].map((s) => s.outerHTML).join('')
    parsed.querySelectorAll('style').forEach((s) => s.remove())
    const csp = `default-src 'none'; img-src data: blob:${images ? ' https: http:' : ''}; style-src 'unsafe-inline'; font-src data:`
    return (
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">` +
      '<style>html,body{margin:0;padding:0;background:#fff}body{font:14px/1.6 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1c2420;overflow-wrap:anywhere}' +
      'img{max-width:100%;height:auto}table{max-width:100%!important}a{color:#0b6d37}blockquote{margin:0 0 0 .4em;padding-left:.8em;border-left:3px solid #d5dbd7;color:#5b6660}</style>' +
      `${styles}</head><body>${parsed.body.innerHTML}</body></html>`
    )
  }, [html, images, cids])

  const fit = useCallback(() => {
    const d = frame.current?.contentDocument
    if (d?.documentElement) setHeight(Math.min(Math.max(d.documentElement.scrollHeight, 40), 30000))
  }, [])

  useEffect(() => {
    const t = setTimeout(fit, 400)
    return () => clearTimeout(t)
  }, [doc, fit])

  return (
    <div className="mail-html">
      {remote && !images && (
        <div className="notice subtle">
          <Icon name="image" size={16} />
          <span>Pictures from the internet are hidden, so the sender cannot tell this was opened.</span>
          <button type="button" className="link-btn" onClick={() => setImages(true)}>
            Show pictures
          </button>
        </div>
      )}
      <iframe
        ref={frame}
        className="mail-frame"
        title={`Message from ${who(message)}`}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={doc}
        style={{ height }}
        onLoad={fit}
      />
    </div>
  )
}

function Attachments({ message, onError }) {
  const [thumbs, setThumbs] = useState({})
  useEffect(() => {
    const made = []
    for (const a of message.attachments || []) {
      if (!/^image\/(jpeg|png|gif|webp)$/.test(a.content_type) || a.size > 6 * 1024 * 1024) continue
      api
        .mailAttachmentBlobUrl(message.id, a.id)
        .then((url) => {
          made.push(url)
          setThumbs((t) => ({ ...t, [a.id]: url }))
        })
        .catch(() => {})
    }
    return () => made.forEach(URL.revokeObjectURL)
  }, [message])

  const list = (message.attachments || []).filter((a) => !a.cid || !/^image\//.test(a.content_type))
  if (!list.length) return null
  return (
    <ul className="att-grid">
      {list.map((a) => (
        <li key={a.id} className="att">
          <button type="button" className="att-preview" onClick={() => api.openMailAttachment(message.id, a.id).catch((e) => onError(e.message))} title="Open">
            {thumbs[a.id] ? <img src={thumbs[a.id]} alt="" /> : <span className="att-type">{(a.filename.split('.').pop() || 'file').slice(0, 4).toUpperCase()}</span>}
          </button>
          <div className="att-meta">
            <b title={a.filename}>{a.filename}</b>
            <small>{fmtSize(a.size)}</small>
          </div>
          <button type="button" className="icon-btn sm" title="Download" onClick={() => api.downloadMailAttachment(message.id, a.id, a.filename).catch((e) => onError(e.message))}>
            <Icon name="download" size={15} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ---------- one message inside a conversation ---------- */

function ThreadMessage({ m, open, onToggle, onError }) {
  const [plain, setPlain] = useState(false)
  const dl = m.direction === 'out' && DELIVERY[m.delivery]
  const suspicious = m.direction === 'in' && /dmarc=fail/.test(m.auth || '')
  return (
    <article className={`tmsg${open ? ' is-open' : ''}`}>
      <header className="tmsg-head" onClick={onToggle}>
        <Avatar name={who(m)} email={m.from_email} />
        <div className="tmsg-who">
          <b>{who(m)}</b>
          {m.from_name && <span className="muted"> &lt;{m.from_email}&gt;</span>}
          {open ? (
            <small className="muted tmsg-to">
              to {m.to_email || '—'}
              {m.cc_email && `, cc ${m.cc_email}`}
            </small>
          ) : (
            <small className="muted tmsg-snip">{(m.text_body || '').replace(/\s+/g, ' ').slice(0, 140)}</small>
          )}
        </div>
        <div className="tmsg-side">
          {dl && (
            <span className={`badge ${dl[1]}`} title={dl[2]}>
              {dl[0]}
            </span>
          )}
          {m.attachments?.length > 0 && <Icon name="clip" size={14} className="muted" />}
          <time dateTime={m.created_at} title={fmtFull(m.created_at)}>
            {fmtWhen(m.created_at)}
          </time>
        </div>
      </header>
      {open && (
        <div className="tmsg-body">
          {suspicious && (
            <div className="notice danger">
              <Icon name="alert" size={16} />
              <span>This message failed the sender checks — it may not really be from {m.from_email}. Do not open links or files unless you are sure.</span>
            </div>
          )}
          {m.html && !plain ? <HtmlBody html={m.html} message={m} /> : <TextBody text={m.text_body} />}
          {m.html && (
            <button type="button" className="link-btn sm" onClick={() => setPlain((v) => !v)}>
              {plain ? 'Show formatted' : 'Show as plain text'}
            </button>
          )}
          <Attachments message={m} onError={onError} />
        </div>
      )}
    </article>
  )
}

/* ---------- the reading pane ---------- */

function Reader({ id, boxes, signature, onChanged, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [reply, setReply] = useState(null)
  const [forward, setForward] = useState(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await api.mailThread(id)
      setData(r)
      const last = r.thread[r.thread.length - 1]
      setExpanded(new Set([r.focus, last?.id]))
    } catch (e) {
      setError(e.message)
    }
  }, [id])

  useEffect(() => {
    setData(null)
    setReply(null)
    setForward(null)
    setNote('')
    load()
  }, [load])

  if (error && !data) return <div className="reader-empty"><p className="form-err">{error}</p></div>
  if (!data) return <div className="reader-empty"><span className="spinner" /></div>

  const { thread, box, submission } = data
  const focus = thread.find((m) => m.id === data.focus) || thread[thread.length - 1]
  const lastIn = [...thread].reverse().find((m) => m.direction === 'in')
  const canSend = Boolean(box?.member)
  const status = focus.status
  const ids = (pred) => thread.filter(pred).map((m) => m.id)

  const act = async (list, statusTo, message) => {
    if (!list.length) return
    try {
      await api.mailBulk(list, statusTo)
      setNote(message)
      onChanged(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const replyTo = (m, all) => {
    const own = new Set((boxes || []).map((b) => b.address))
    let to
    let cc = []
    if (m.direction === 'in') {
      to = [m.reply_to || m.from_email]
      if (all) cc = [...splitList(m.to_email), ...splitList(m.cc_email)].filter((a) => !own.has(a) && !to.includes(a))
    } else {
      to = splitList(m.to_email)
      if (all) cc = splitList(m.cc_email)
    }
    const subject = /^\s*re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`
    setForward(null)
    setReply({ key: `reply-${m.id}`, initial: { from_box: box?.member ? box.id : '', to: to.join(', '), cc: [...new Set(cc)].join(', '), subject, reply_to_id: m.id, quote: true } })
  }
  const forwardOf = (m) => {
    setReply(null)
    setForward({ key: `fwd-${m.id}`, initial: { from_box: box?.member ? box.id : '', subject: /^\s*fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`, forward_of: m.id } })
  }

  const inFolder = status === 'deleted' ? 'trash' : status === 'spam' ? 'spam' : status === 'archived' ? 'archived' : focus.direction === 'out' ? 'sent' : 'inbox'

  return (
    <div className="reader">
      <div className="reader-bar">
        <button type="button" className="icon-btn only-narrow" onClick={onBack} aria-label="Back to the list">
          <Icon name="arrowLeft" />
        </button>
        {inFolder === 'inbox' && (
          <button type="button" className="btn ghost sm" onClick={() => act(ids((m) => m.direction === 'in' && ['unread', 'read'].includes(m.status)), 'archived', 'Archived.')}>
            <Icon name="archive" size={15} /> Archive
          </button>
        )}
        {['archived', 'spam', 'trash'].includes(inFolder) && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => act(ids((m) => m.status === status), 'read', inFolder === 'spam' ? 'Moved to the inbox — not spam.' : 'Moved back.')}
          >
            <Icon name="undo" size={15} /> {inFolder === 'spam' ? 'Not spam' : inFolder === 'trash' ? 'Restore' : 'Move to inbox'}
          </button>
        )}
        {inFolder === 'inbox' && (
          <button type="button" className="btn ghost sm" onClick={() => act(ids((m) => m.direction === 'in' && m.status !== 'deleted'), 'spam', 'Moved to spam.')}>
            <Icon name="spam" size={15} /> Spam
          </button>
        )}
        {inFolder !== 'trash' ? (
          <button type="button" className="btn ghost sm danger" onClick={() => act(ids((m) => m.status !== 'deleted'), 'deleted', 'Moved to the trash.')}>
            <Icon name="trash" size={15} /> Delete
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost sm danger"
            onClick={async () => {
              if (!confirm('Delete this conversation for good? It cannot be brought back.')) return
              try {
                for (const m of thread.filter((x) => x.status === 'deleted')) await api.deleteMailForever(m.id)
                onChanged(true)
              } catch (e) {
                setError(e.message)
              }
            }}
          >
            <Icon name="trash" size={15} /> Delete for good
          </button>
        )}
        {lastIn && inFolder === 'inbox' && (
          <button type="button" className="btn ghost sm" onClick={() => act([lastIn.id], 'unread', 'Marked unread.')}>
            <Icon name="mail" size={15} /> Mark unread
          </button>
        )}
      </div>

      <div className="reader-scroll">
        <header className="reader-head">
          <h2>{focus.subject || '(no subject)'}</h2>
          <div className="reader-tags">
            {box && (
              <span className="chip">
                <Icon name={box.kind === 'shared' ? 'users' : 'user'} size={13} /> {box.address}
              </span>
            )}
            {focus.source === 'form' && <span className="chip green">Website form</span>}
            {!canSend && box && <span className="chip amber" title="You can read this mailbox as an administrator, but only its owner sends from it">Read only</span>}
          </div>
        </header>

        {note && <p className="form-ok">{note}</p>}
        {error && <p className="form-err">{error}</p>}

        {submission && (
          <div className="notice">
            <Icon name="form" size={16} />
            <span>
              {submission.name} sent this through the website{submission.phone ? ` — phone ${submission.phone}` : ''}.
            </span>
            <Link className="link-btn" to={`/admin/submissions?open=${submission.id}`}>
              Open the application
            </Link>
          </div>
        )}

        <div className="thread">
          {thread.map((m) => (
            <ThreadMessage
              key={m.id}
              m={m}
              open={expanded.has(m.id)}
              onError={setError}
              onToggle={() =>
                setExpanded((s) => {
                  const n = new Set(s)
                  if (n.has(m.id)) n.delete(m.id)
                  else n.add(m.id)
                  return n
                })
              }
            />
          ))}
        </div>

        {canSend && !reply && !forward && (
          <div className="reader-actions">
            {focus.source === 'form' && !(focus.reply_to) ? (
              <p className="hint">They left no email address — use the phone number in the message.</p>
            ) : (
              <>
                <button type="button" className="btn ghost" onClick={() => replyTo(thread[thread.length - 1], false)}>
                  <Icon name="reply" size={16} /> Reply
                </button>
                {(splitList(thread[thread.length - 1].to_email).length + splitList(thread[thread.length - 1].cc_email).length > 1) && (
                  <button type="button" className="btn ghost" onClick={() => replyTo(thread[thread.length - 1], true)}>
                    <Icon name="replyAll" size={16} /> Reply all
                  </button>
                )}
              </>
            )}
            <button type="button" className="btn ghost" onClick={() => forwardOf(focus)}>
              <Icon name="forward" size={16} /> Forward
            </button>
          </div>
        )}

        {reply && (
          <div className="reader-reply">
            <Compose
              key={reply.key}
              inline
              boxes={boxes}
              signature={signature}
              draftKey={reply.key}
              initial={reply.initial}
              onClose={() => setReply(null)}
              onSent={() => {
                setReply(null)
                setNote('Reply sent.')
                load()
                onChanged(false)
              }}
            />
          </div>
        )}
      </div>

      {forward && (
        <Compose
          key={forward.key}
          boxes={boxes}
          signature={signature}
          draftKey={forward.key}
          initial={forward.initial}
          onClose={() => setForward(null)}
          onSent={() => {
            setForward(null)
            setNote('Forwarded.')
            load()
            onChanged(false)
          }}
        />
      )}
    </div>
  )
}

/* ---------- the page ---------- */

export default function Mailbox() {
  const { refreshCounts } = useOutletContext() || {}
  const [params, setParams] = useSearchParams()
  const [boxes, setBoxes] = useState(null)
  const [signature, setSignature] = useState('')
  const [list, setList] = useState(null)
  const [counts, setCounts] = useState({})
  const [error, setError] = useState('')
  const [query, setQuery] = useState(params.get('q') || '')
  const [selected, setSelected] = useState(new Set())
  const [compose, setCompose] = useState(null)
  const [flash, setFlash] = useState('')
  const [showOthers, setShowOthers] = useState(false)
  const seq = useRef(0)

  const boxId = Number(params.get('box')) || null
  const folder = FOLDERS.some((f) => f.v === params.get('folder')) ? params.get('folder') : 'inbox'
  const openId = Number(params.get('open')) || null
  const q = params.get('q') || ''

  const go = (patch, replace = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next, { replace })
  }

  const loadBoxes = useCallback(async () => {
    try {
      const r = await api.mailBoxes()
      setBoxes(r.boxes)
      setSignature(r.signature || '')
      return r.boxes
    } catch (e) {
      setError(e.message)
      setBoxes([])
      return []
    }
  }, [])

  useEffect(() => {
    loadBoxes().then((bs) => {
      if (!boxId && bs.length) go({ box: (bs.find((b) => b.member) || bs[0]).id }, true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadList = useCallback(async () => {
    if (!boxId) return
    const n = ++seq.current
    try {
      const r = await api.mailList(boxId, folder, q)
      if (n !== seq.current) return // a newer request has been made since
      setList(r.messages)
      setCounts(r.counts || {})
      setError('')
    } catch (e) {
      if (n === seq.current) {
        setError(e.message)
        setList([])
      }
    }
  }, [boxId, folder, q])

  useEffect(() => {
    setList(null)
    setSelected(new Set())
    loadList()
  }, [loadList])

  /* new mail shows up without a reload: every 30 seconds, and on coming back to the tab */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      loadList()
      loadBoxes()
    }
    const t = setInterval(tick, 30000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [loadList, loadBoxes])

  useEffect(() => setQuery(q), [q])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(''), 4000)
    return () => clearTimeout(t)
  }, [flash])

  const changed = (closeReader) => {
    loadList()
    loadBoxes()
    refreshCounts?.()
    if (closeReader) go({ open: null })
  }

  const threads = useMemo(() => groupThreads(list || []), [list])
  const box = (boxes || []).find((b) => b.id === boxId)
  const mine = (boxes || []).filter((b) => b.member)
  const others = (boxes || []).filter((b) => !b.member)

  const bulk = async (status, message) => {
    const ids = threads.filter((t) => selected.has(t.key)).flatMap((t) => t.ids)
    if (!ids.length) return
    try {
      await api.mailBulk(ids, status)
      setFlash(message)
      setSelected(new Set())
      changed(false)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!boxes) return <div className="page-loading"><span className="spinner" /></div>
  if (!boxes.length) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Mailbox</h1>
        </header>
        <div className="empty">
          <Icon name="mail" size={28} />
          <p>You have no mailbox yet. An administrator gives you one on the Team page.</p>
        </div>
      </div>
    )
  }

  const boxRow = (b) => (
    <button
      key={b.id}
      type="button"
      className={`mbx-box${b.id === boxId ? ' is-on' : ''}`}
      onClick={() => go({ box: b.id, folder: null, open: null, q: null })}
      title={b.address}
    >
      <Icon name={b.kind === 'shared' ? 'users' : 'user'} size={16} />
      <span className="mbx-box-name">
        <b>{b.address.split('@')[0]}@</b>
        <small>{b.kind === 'shared' ? 'shared' : b.own ? 'yours' : b.name}</small>
      </span>
      {b.unread > 0 && <span className="count">{b.unread}</span>}
    </button>
  )

  const allChecked = threads.length > 0 && threads.every((t) => selected.has(t.key))

  return (
    <div className={`mbx${openId ? ' has-open' : ''}`}>
      <aside className="mbx-rail">
        <button type="button" className="btn wide" onClick={() => setCompose({ key: 'new', initial: { from_box: box?.member ? box.id : '' } })} disabled={!mine.length}>
          <Icon name="pencil" size={16} /> Write
        </button>
        <nav className="mbx-boxes" aria-label="Mailboxes">
          <span className="rail-label">Your mailboxes</span>
          {mine.map(boxRow)}
          {others.length > 0 && (
            <>
              <button type="button" className="rail-label as-button" onClick={() => setShowOthers((v) => !v)}>
                <Icon name={showOthers ? 'chevronDown' : 'chevronRight'} size={13} /> Team mailboxes ({others.length})
              </button>
              {showOthers && others.map(boxRow)}
            </>
          )}
        </nav>
      </aside>

      <section className="mbx-list" aria-label="Conversations">
        <header className="mbx-list-head">
          <div className="mbx-title">
            <h1>{box ? box.address : 'Mailbox'}</h1>
            {box && <small>{box.name}{!box.member && ' · read only'}</small>}
          </div>
          <nav className="seg" aria-label="Folders">
            {FOLDERS.map((f) => (
              <button key={f.v} type="button" className={folder === f.v ? 'is-on' : undefined} onClick={() => go({ folder: f.v === 'inbox' ? null : f.v, open: null })}>
                {f.label}
                {f.v === 'inbox' && counts.inbox > 0 && <span className="count">{counts.inbox}</span>}
                {f.v === 'spam' && counts.spam > 0 && <span className="count grey">{counts.spam}</span>}
              </button>
            ))}
          </nav>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault()
              go({ q: query.trim() || null, open: null })
            }}
          >
            <Icon name="search" size={16} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${FOLDERS.find((f) => f.v === folder).label.toLowerCase()}`} />
            {q && (
              <button type="button" className="icon-btn sm" onClick={() => go({ q: null })} aria-label="Clear the search">
                <Icon name="x" size={14} />
              </button>
            )}
          </form>
          {threads.length > 0 && (
            <div className="bulkbar">
              <label className="check" title="Select all">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => setSelected(e.target.checked ? new Set(threads.map((t) => t.key)) : new Set())}
                />
              </label>
              {selected.size > 0 ? (
                <>
                  <span className="muted">{selected.size} selected</span>
                  {folder === 'inbox' && (
                    <>
                      <button type="button" className="icon-btn" title="Mark read" onClick={() => bulk('read', 'Marked read.')}>
                        <Icon name="mailOpen" size={16} />
                      </button>
                      <button type="button" className="icon-btn" title="Mark unread" onClick={() => bulk('unread', 'Marked unread.')}>
                        <Icon name="mail" size={16} />
                      </button>
                      <button type="button" className="icon-btn" title="Archive" onClick={() => bulk('archived', 'Archived.')}>
                        <Icon name="archive" size={16} />
                      </button>
                    </>
                  )}
                  {['archived', 'spam', 'trash'].includes(folder) && (
                    <button type="button" className="icon-btn" title={folder === 'spam' ? 'Not spam' : 'Restore'} onClick={() => bulk('read', 'Moved back.')}>
                      <Icon name="undo" size={16} />
                    </button>
                  )}
                  {folder !== 'trash' && (
                    <button type="button" className="icon-btn danger" title="Delete" onClick={() => bulk('deleted', 'Moved to the trash.')}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </>
              ) : (
                <span className="muted">
                  {threads.length} conversation{threads.length === 1 ? '' : 's'}
                  {q && ` matching “${q}”`}
                </span>
              )}
              {folder === 'trash' && selected.size === 0 && (
                <button
                  type="button"
                  className="link-btn push danger"
                  onClick={async () => {
                    if (!confirm('Empty the trash? Everything in it is deleted for good.')) return
                    try {
                      await api.emptyTrash(boxId)
                      changed(true)
                    } catch (e) {
                      setError(e.message)
                    }
                  }}
                >
                  Empty trash
                </button>
              )}
            </div>
          )}
        </header>

        {flash && <p className="form-ok pad">{flash}</p>}
        {error && <p className="form-err pad">{error}</p>}

        <div className="mbx-rows">
          {list === null && <div className="page-loading"><span className="spinner" /></div>}
          {list && threads.length === 0 && (
            <div className="empty">
              <Icon name={FOLDERS.find((f) => f.v === folder).icon} size={28} />
              <p>{q ? 'Nothing matches that search.' : folder === 'inbox' ? 'No mail here. New messages appear on their own.' : `Nothing in ${folder}.`}</p>
            </div>
          )}
          {threads.map((t) => {
            const m = t.top
            const out = m.direction === 'out'
            const dl = out && DELIVERY[m.delivery]
            return (
              <div key={t.key} className={`mrow${t.unread ? ' is-unread' : ''}${openId && t.ids.includes(openId) ? ' is-on' : ''}${selected.has(t.key) ? ' is-picked' : ''}`}>
                <label className="check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(t.key)}
                    onChange={(e) =>
                      setSelected((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(t.key)
                        else n.delete(t.key)
                        return n
                      })
                    }
                    aria-label={`Select “${m.subject}”`}
                  />
                </label>
                <button type="button" className="mrow-main" onClick={() => go({ open: m.id })}>
                  <span className="mrow-top">
                    <b className="mrow-who">
                      {out ? `To: ${splitList(m.to_email).join(', ')}` : who(m)}
                      {m.thread_n > 1 && <span className="mrow-n">{m.thread_n}</span>}
                    </b>
                    <time dateTime={m.created_at} title={fmtFull(m.created_at)}>
                      {fmtWhen(m.created_at)}
                    </time>
                  </span>
                  <span className="mrow-subject">
                    {m.source === 'form' && <span className="chip green xs">Form</span>}
                    {m.subject || '(no subject)'}
                  </span>
                  <span className="mrow-preview">
                    {t.attachments && <Icon name="clip" size={13} />}
                    {dl && <span className={`dot ${dl[1]}`} title={dl[0]} />}
                    {m.preview}
                  </span>
                </button>
              </div>
            )
          })}
          {list && list.length >= 200 && <p className="hint pad">Showing the newest 200 — search to find older mail.</p>}
        </div>
      </section>

      <section className="mbx-read" aria-label="Conversation">
        {openId ? (
          <Reader key={openId} id={openId} boxes={boxes} signature={signature} onChanged={changed} onBack={() => go({ open: null })} />
        ) : (
          <div className="reader-empty">
            <Icon name="mailOpen" size={34} />
            <p>Choose a conversation to read it.</p>
            {box?.member && (
              <p className="hint">
                Mail sent to <b>{box.address}</b> arrives here.
              </p>
            )}
          </div>
        )}
      </section>

      {compose && (
        <Compose
          key={compose.key}
          boxes={boxes}
          signature={signature}
          draftKey={compose.key}
          initial={compose.initial}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null)
            setFlash('Sent.')
            go({ folder: 'sent', open: null })
            changed(false)
          }}
        />
      )}
    </div>
  )
}
