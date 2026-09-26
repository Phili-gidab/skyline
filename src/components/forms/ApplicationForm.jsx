import React, { useRef, useState } from 'react'
import { DESTINATIONS } from '../../data/site'
import { Input, Select, TextArea, Honeypot, Failure, Sent } from './FormKit'

const API = import.meta.env.VITE_API_URL || ''

const VISAS = ['Student visa', 'Work visa / permit', 'Visit / tourist visa']

/* The labels the server accepts; anything unrecognised is filed as "Other". */
const LABELS = [
  'Passport',
  'Passport photo',
  'Bank statement',
  'Transcript / certificate',
  'Diploma',
  'Invitation letter',
  'Employment letter',
  'CV',
  'Language certificate',
  'Other',
]

const MAX_FILES = 12
const MAX_FILE = 10 * 1024 * 1024
const MAX_TOTAL = 40 * 1024 * 1024
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,application/pdf,image/*'
const OK_EXT = /\.(pdf|jpe?g|png|webp|heic|heif|docx?)$/i

const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

/* A first guess at what a file is, from its name, so most people never touch the dropdown. */
function guessLabel(name, taken) {
  const n = name.toLowerCase()
  if (/passport|pasport/.test(n) && /photo|pic|img/.test(n)) return 'Passport photo'
  if (/passport|pasport/.test(n)) return 'Passport'
  if (/photo|selfie|picture/.test(n)) return 'Passport photo'
  if (/bank|statement/.test(n)) return 'Bank statement'
  if (/transcript|grade|certificate|cert/.test(n)) return 'Transcript / certificate'
  if (/diploma|degree/.test(n)) return 'Diploma'
  if (/invitation|invite/.test(n)) return 'Invitation letter'
  if (/employ|work|salary/.test(n)) return 'Employment letter'
  if (/\bcv\b|resume|résumé/.test(n)) return 'CV'
  if (/ielts|toefl|duolingo|language/.test(n)) return 'Language certificate'
  return taken.includes('Passport') ? 'Other' : 'Passport'
}

/* The full application: details and documents together, instead of sending
   files one by one on Telegram. Upload runs over XHR so there is a real
   progress bar — a passport scan on mobile data can take a while. */
export default function ApplicationForm() {
  const [files, setFiles] = useState([]) // { id, file, label }
  const [problem, setProblem] = useState('')
  const [drag, setDrag] = useState(false)
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const picker = useRef(null)
  const formRef = useRef(null)

  const total = files.reduce((n, f) => n + f.file.size, 0)

  const add = (list) => {
    setProblem('')
    const incoming = [...list]
    const next = [...files]
    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        setProblem(`You can send up to ${MAX_FILES} documents at a time.`)
        break
      }
      if (!OK_EXT.test(file.name)) {
        setProblem(`"${file.name}" is not a PDF, photo or Word document.`)
        continue
      }
      if (file.size > MAX_FILE) {
        setProblem(`"${file.name}" is ${size(file.size)} — each file can be up to 10 MB.`)
        continue
      }
      if (next.some((f) => f.file.name === file.name && f.file.size === file.size)) continue
      if (next.reduce((n, f) => n + f.file.size, 0) + file.size > MAX_TOTAL) {
        setProblem('Together the documents can be up to 40 MB.')
        break
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        label: guessLabel(file.name, next.map((f) => f.label)),
      })
    }
    setFiles(next)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!files.length) {
      setProblem('Please attach at least one document — your passport, to start with.')
      return
    }
    const fd = new FormData(e.currentTarget)
    fd.append('kind', 'application')
    files.forEach((f) => {
      fd.append('documents[]', f.file, f.file.name)
      fd.append('doc_labels[]', f.label)
    })

    setState('sending')
    setProgress(0)
    setError('')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/api/submit`)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100))
    xhr.onload = () => {
      let data = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* the server answered with something that is not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        setState('sent')
      } else {
        setError(data?.error || (xhr.status === 413 ? 'The documents are too large to send together.' : ''))
        setState('error')
      }
    }
    xhr.onerror = () => {
      setError('The connection dropped while sending.')
      setState('error')
    }
    xhr.send(fd)
  }

  const again = () => {
    setFiles([])
    setState('idle')
    setProgress(0)
    formRef.current?.reset()
  }

  if (state === 'sent') {
    return (
      <Sent title="Your application is with us" onAgain={again}>
        We have your details and your {files.length} document{files.length === 1 ? '' : 's'}. A consultant will review the file
        and contact you about anything still needed — there is no need to send them again on Telegram.
      </Sent>
    )
  }

  return (
    <form className="fm" onSubmit={onSubmit} ref={formRef}>
      <div className="fm-grid">
        <Input label="Full name (as in passport)" name="name" required autoComplete="name" maxLength={190} />
        <Input label="Phone" name="phone" type="tel" required autoComplete="tel" placeholder="09… or +251…" maxLength={64} />
        <Input label="Email" name="email" type="email" required autoComplete="email" maxLength={190} hint="We send the confirmation and updates here." />
        <Select label="Destination" name="destination" required options={[...DESTINATIONS.map((d) => d.country), 'Not sure yet']} placeholder="Choose a country" />
        <Select label="Visa type" name="visa" required options={VISAS} placeholder="Choose a visa" />
        <Input label="Intake or travel date" name="travel" placeholder="e.g. September 2026" maxLength={120} />
        <TextArea label="Anything we should know?" name="message" maxLength={5000} placeholder="A previous refusal, your field of study, questions…" />
      </div>

      <div
        className={`up${drag ? ' is-drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          add(e.dataTransfer.files)
        }}
      >
        <input
          ref={picker}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="up__zone">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <p>
            <b>Drop your documents here</b> or{' '}
            <button type="button" onClick={() => picker.current?.click()}>
              choose files
            </button>
          </p>
          <small>Passport, photo, bank statement, certificates — PDF, photos or Word, up to 10 MB each.</small>
        </div>

        {files.length > 0 && (
          <ul className="up__list">
            {files.map((f) => (
              <li key={f.id}>
                <span className="up__type">{f.file.name.split('.').pop().toUpperCase()}</span>
                <span className="up__name">
                  {f.file.name}
                  <small>{size(f.file.size)}</small>
                </span>
                <select
                  value={f.label}
                  onChange={(e) => setFiles(files.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                  aria-label={`What is ${f.file.name}?`}
                >
                  {LABELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <button type="button" className="up__x" onClick={() => setFiles(files.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.file.name}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <p className="up__total">
            {files.length} document{files.length === 1 ? '' : 's'} · {size(total)} of 40 MB
          </p>
        )}
        {problem && <p className="up__problem">{problem}</p>}
      </div>

      <Honeypot />

      {state === 'sending' && (
        <div className="up__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${progress}%` }} />
          <span>{progress < 100 ? `Uploading… ${progress}%` : 'Saving your application…'}</span>
        </div>
      )}

      {state === 'error' && <Failure error={error} text="Hello Skyline, I would like to apply and send my documents." />}

      <div className="fm-foot">
        <button className="btn btn--solid" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Submit application'}
        </button>
        <p>Your documents go only to our office, and are never shared.</p>
      </div>
    </form>
  )
}
