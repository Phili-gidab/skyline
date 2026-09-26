import React, { useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, Outlet, Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { SINGLETONS, COLLECTIONS } from './schemas'
import { api, setToken, tokenClaims, SESSION_ENDED } from './api'
import SingletonEditor from './pages/SingletonEditor'
import CollectionManager from './pages/CollectionManager'
import Dashboard from './pages/Dashboard'
import Submissions from './pages/Submissions'
import Mailbox from './pages/Mailbox'
import Email from './pages/Email'
import Media from './pages/Media'
import Team from './pages/Team'
import Account from './pages/Account'
import Board from './pages/Board'
import BoardSettings from './pages/BoardSettings'
import { has, roleLabel } from './roles'
import Icon from './Icon'
import ErrorBoundary from './ErrorBoundary'
import './admin.css'

/* icons for the website sections, by schema key */
const SECTION_ICONS = {
  brand: 'building',
  hero: 'image',
  scholarship: 'cap',
  notice: 'shield',
  destinations: 'globe',
  catalogue: 'list',
  extras: 'plus',
  why: 'checkCircle',
  process: 'steps',
  stats: 'chart',
  specs: 'file',
  roles: 'briefcase',
}

/* ---------------- signed-out screens ---------------- */

function AuthShell({ title, children }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <img src="/logo-lockup.svg" alt="Skyline Travel Solution" />
        <div>
          <h2>The office, in one place</h2>
          <p>Your mailbox, your clients and the website — sign in with your Skyline address.</p>
        </div>
        <small>skyline-et.com · office admin</small>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}

function LoginForm({ presetEmail = '', onDone }) {
  const [email, setEmail] = useState(presetEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { token } = await api.login(email.trim(), password)
      setToken(token)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <label className="field">
        <span className="field-label">Your Skyline address</span>
        <input
          type="text"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          placeholder="name@skyline-et.com"
          autoFocus={!presetEmail}
          spellCheck={false}
          autoCapitalize="none"
        />
      </label>
      <label className="field">
        <span className="field-label">Password</span>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus={Boolean(presetEmail)} />
      </label>
      {error && <p className="form-err">{error}</p>}
      <button className="btn wide lg" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  if (tokenClaims()) return <Navigate to="/admin" replace />
  return (
    <AuthShell title="Sign in">
      {params.get('expired') && <p className="notice subtle">Your session ended — please sign in again.</p>}
      {params.get('reset') && <p className="form-ok">Password saved. Sign in with your new password.</p>}
      <LoginForm
        onDone={() => {
          const next = params.get('next') || ''
          navigate(next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin')
        }}
      />
      <Link className="link-btn" to="/admin/forgot">
        Forgot your password?
      </Link>
    </AuthShell>
  )
}

function Forgot() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.forgot(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Reset your password">
      {sent ? (
        <p className="form-ok">
          If {email} has an account, a link to choose a new password is on its way to the private email saved on it. The link works for one hour.
        </p>
      ) : (
        <form onSubmit={submit} className="form">
          <p className="muted">
            Enter your Skyline address. The link goes to the private email on your account — not to your Skyline mailbox, which you cannot open
            until you are signed in.
          </p>
          <label className="field">
            <span className="field-label">Your Skyline address</span>
            <input type="text" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@skyline-et.com" autoFocus />
          </label>
          {error && <p className="form-err">{error}</p>}
          <button className="btn wide lg" disabled={busy}>
            {busy ? 'Sending…' : 'Send the link'}
          </button>
        </form>
      )}
      <Link className="link-btn" to="/admin/login">
        ← Back to sign in
      </Link>
    </AuthShell>
  )
}

function Reset() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    if (password !== again) return setError('The two passwords do not match')
    setBusy(true)
    setError('')
    try {
      await api.reset(token, password)
      setToken(null)
      navigate('/admin/login?reset=1')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Choose a password">
      <form onSubmit={submit} className="form">
        <p className="muted">At least 10 characters. A short sentence is easier to remember than a jumble.</p>
        <label className="field">
          <span className="field-label">New password</span>
          <input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Once more</span>
          <input type="password" required minLength={10} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <p className="form-err">{error}</p>}
        <button className="btn wide lg" disabled={busy || !token}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        {!token && <p className="form-err">This page needs the link from your email.</p>}
      </form>
    </AuthShell>
  )
}

/* ---------------- the panel ---------------- */

function Protected({ children }) {
  const location = useLocation()
  if (!tokenClaims()) return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

/* a page outside this person's role explains itself, rather than showing a bare "forbidden" */
function Need({ cap, children }) {
  const { user } = useContext()
  if (!user) return <div className="page-loading"><span className="spinner" /></div>
  if (!has(user, cap)) {
    return (
      <div className="page">
        <div className="empty">
          <Icon name="lock" size={28} />
          <p>Your role ({roleLabel(user.role)}) does not include this page.</p>
          <Link className="btn ghost" to="/admin">
            Back to the dashboard
          </Link>
        </div>
      </div>
    )
  }
  return children
}

const Ctx = React.createContext({})
const useContext = () => React.useContext(Ctx)

/* the session ended while someone was working: sign in again over the page,
   so what they were writing is still there afterwards */
function SessionDialog({ email, onDone }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Sign in again">
      <div className="modal-card narrow">
        <h2 className="modal-title">Your session ended</h2>
        <p className="muted">Sign in again to carry on — nothing on this page is lost.</p>
        <LoginForm presetEmail={email} onDone={onDone} />
      </div>
    </div>
  )
}

function Layout() {
  const [user, setUser] = useState(null)
  const [meError, setMeError] = useState('')
  const [counts, setCounts] = useState(null)
  const [menu, setMenu] = useState(false)
  const [expired, setExpired] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const loadMe = useCallback(() => {
    setMeError('')
    api
      .me()
      .then(setUser)
      .catch((e) => setMeError(e.message))
  }, [])

  const refreshCounts = useCallback(() => {
    api
      .overview()
      .then(setCounts)
      .catch(() => {})
  }, [])

  useEffect(loadMe, [loadMe])

  // badges: on each page change, every minute, and whenever a page reports a change
  useEffect(() => {
    refreshCounts()
    const id = setInterval(() => document.visibilityState === 'visible' && refreshCounts(), 60000)
    return () => clearInterval(id)
  }, [location.pathname, refreshCounts])

  useEffect(() => setMenu(false), [location.pathname, location.search])

  useEffect(() => {
    const onEnded = () => setExpired(true)
    window.addEventListener(SESSION_ENDED, onEnded)
    return () => window.removeEventListener(SESSION_ENDED, onEnded)
  }, [])

  const unreadMail = counts?.mail_unread || 0
  useEffect(() => {
    document.title = `${unreadMail ? `(${unreadMail}) ` : ''}Skyline — Office admin`
  }, [unreadMail])

  const logout = () => {
    setToken(null)
    navigate('/admin/login')
  }

  const unreadForms = counts?.forms ? Object.values(counts.forms).reduce((n, f) => n + f.unread, 0) : 0
  const hasMail = (counts?.mailboxes || []).length > 0

  /* The menu is built from what this person's role allows. The server refuses
     anything outside it regardless; this only keeps the menu honest. */
  const nav = [
    {
      section: null,
      items: [
        { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
        hasMail && { to: '/admin/mail', label: 'Mailbox', icon: 'inbox', badge: unreadMail },
      ].filter(Boolean),
    },
    has(user, 'boards') && {
      section: 'Clients',
      items: (counts?.boards || []).map((b) => ({ to: `/admin/boards/${b.id}`, label: b.name, icon: 'board', count: b.items })),
    },
    has(user, 'messages') && {
      section: 'Website messages',
      items: [
        { to: '/admin/submissions', label: 'Form submissions', icon: 'form', badge: unreadForms },
        { to: '/admin/email', label: 'Email log', icon: 'activity', alert: counts?.mail_failed_7d > 0 },
      ],
    },
    has(user, 'content') && {
      section: 'Website',
      items: [
        ...SINGLETONS.map((s) => ({ to: `/admin/s/${s.key}`, label: s.label, icon: SECTION_ICONS[s.key] || 'file' })),
        ...COLLECTIONS.map((c) => ({ to: `/admin/c/${c.key}`, label: c.label, icon: SECTION_ICONS[c.key] || 'list' })),
        { to: '/admin/media', label: 'Media library', icon: 'image' },
      ],
    },
    {
      section: 'Settings',
      items: [has(user, 'team') && { to: '/admin/team', label: 'Team & mailboxes', icon: 'users' }, { to: '/admin/account', label: 'My account', icon: 'user' }].filter(Boolean),
    },
  ].filter((g) => g && g.items.length)

  const full = /^\/admin\/(mail|boards\/\d+$)/.test(location.pathname)
  const claims = tokenClaims()

  return (
    <Ctx.Provider value={{ user, counts, refreshCounts }}>
      <div className="shell">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Menu">
            <Icon name={menu ? 'x' : 'menu'} />
          </button>
          <img src="/logo-compact-dark.svg" alt="Skyline" />
          {hasMail && (
            <Link to="/admin/mail" className="icon-btn topbar-mail" aria-label="Mailbox">
              <Icon name="inbox" />
              {unreadMail > 0 && <span className="count">{unreadMail}</span>}
            </Link>
          )}
        </header>
        <aside className={`side${menu ? ' is-open' : ''}`}>
          <div className="side-brand">
            <img src="/logo-compact-dark.svg" alt="Skyline" />
            <small>Office</small>
          </div>
          <nav className="side-nav">
            {nav.map((group, i) => (
              <div className="side-group" key={group.section || i}>
                {group.section && <span className="side-label">{group.section}</span>}
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-on' : undefined)}>
                    <Icon name={item.icon} size={17} />
                    <span className="side-text">{item.label}</span>
                    {item.badge > 0 && <span className="count">{item.badge}</span>}
                    {item.alert && <span className="dot red" title="Some emails were not delivered" />}
                    {item.count !== undefined && !item.badge && <small className="side-count">{item.count}</small>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-foot">
            {user && (
              <Link to="/admin/account" className="side-me">
                <span className="avatar sm">{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>
                <span>
                  <b>{user.name || user.email}</b>
                  <small>
                    {user.email} · {roleLabel(user.role)}
                  </small>
                </span>
              </Link>
            )}
            <div className="side-foot-actions">
              <a href="/" target="_blank" rel="noreferrer">
                <Icon name="external" size={15} /> Website
              </a>
              <button onClick={logout}>
                <Icon name="logout" size={15} /> Sign out
              </button>
            </div>
          </div>
        </aside>
        {menu && <div className="scrim" onClick={() => setMenu(false)} />}
        <main className={`main${full ? ' is-full' : ''}`}>
          {meError && (
            <div className="notice danger">
              <Icon name="alert" size={16} />
              <span>Could not load your account: {meError}</span>
              <button className="link-btn" onClick={loadMe}>
                Try again
              </button>
            </div>
          )}
          <ErrorBoundary routeKey={location.pathname}>
            <Outlet context={{ user, counts, refreshCounts }} />
          </ErrorBoundary>
        </main>
        {expired && (
          <SessionDialog
            email={user?.email || claims?.email || ''}
            onDone={() => {
              setExpired(false)
              loadMe()
              refreshCounts()
            }}
          />
        )}
      </div>
    </Ctx.Provider>
  )
}

function SingletonRoute() {
  const { key } = useParams()
  const schema = SINGLETONS.find((s) => s.key === key)
  if (!schema) return <Navigate to="/admin" replace />
  return <SingletonEditor key={key} schema={schema} />
}

function CollectionRoute() {
  const { key } = useParams()
  const schema = COLLECTIONS.find((c) => c.key === key)
  if (!schema) return <Navigate to="/admin" replace />
  return <CollectionManager key={key} schema={schema} />
}

function BoardRoute() {
  const { id } = useParams()
  return <Board key={id} />
}

export default function AdminApp() {
  useEffect(() => {
    document.title = 'Skyline — Office admin'
  }, [])

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="forgot" element={<Forgot />} />
      <Route path="reset" element={<Reset />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="mail" element={<Mailbox />} />
        <Route path="inbox" element={<Navigate to="/admin/mail" replace />} />
        <Route path="s/:key" element={<Need cap="content"><SingletonRoute /></Need>} />
        <Route path="c/:key" element={<Need cap="content"><CollectionRoute /></Need>} />
        <Route path="media" element={<Need cap="content"><Media /></Need>} />
        <Route path="submissions" element={<Need cap="messages"><Submissions /></Need>} />
        <Route path="email" element={<Need cap="messages"><Email /></Need>} />
        <Route path="team" element={<Need cap="team"><Team /></Need>} />
        <Route path="account" element={<Account />} />
        <Route path="boards/:id" element={<Need cap="boards"><BoardRoute /></Need>} />
        <Route path="boards/:id/settings" element={<Need cap="configure"><BoardSettings /></Need>} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
