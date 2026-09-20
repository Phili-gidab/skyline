import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, Outlet, Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { SINGLETONS, COLLECTIONS } from './schemas'
import { api, setToken, tokenClaims } from './api'
import SingletonEditor from './pages/SingletonEditor'
import CollectionManager from './pages/CollectionManager'
import Dashboard from './pages/Dashboard'
import Submissions from './pages/Submissions'
import Inbox from './pages/Inbox'
import Email from './pages/Email'
import Media from './pages/Media'
import Team from './pages/Team'
import Account from './pages/Account'
import ErrorBoundary from './ErrorBoundary'
import './admin.css'

/* ---------------- signed-out screens ---------------- */

function AuthShell({ title, children }) {
  return (
    <div className="adm-auth">
      <aside className="adm-auth-brand">
        <img src="/logo-lockup.svg" alt="Skyline Travel Solution" />
        <div>
          <h2>The website, from the inside</h2>
          <p>Content, enquiries, applications and the office mailbox for skyline-et.com.</p>
        </div>
        <span className="adm-auth-foot">Website admin</span>
      </aside>
      <main className="adm-auth-main">
        <div className="adm-auth-card">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [params] = useSearchParams()
  const navigate = useNavigate()

  if (tokenClaims()) return <Navigate to="/admin" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { token } = await api.login(email, password)
      setToken(token)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Sign in">
      {params.get('expired') && <p className="adm-note">Your session ended — please sign in again.</p>}
      {params.get('reset') && <p className="adm-ok">Password saved. Sign in with your new password.</p>}
      <form onSubmit={submit} className="adm-form">
        <label className="af">
          <span className="af-label">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="af">
          <span className="af-label">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="adm-err">{error}</p>}
        <button className="adm-btn wide" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <Link className="adm-link" to="/admin/forgot">
          Forgot your password?
        </Link>
      </form>
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
      await api.forgot(email)
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
        <p className="adm-ok">If {email} has an account, a link to choose a new password is on its way. It works for one hour.</p>
      ) : (
        <form onSubmit={submit} className="adm-form">
          <p className="adm-dim">Enter your email and we will send you a link to choose a new password.</p>
          <label className="af">
            <span className="af-label">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          {error && <p className="adm-err">{error}</p>}
          <button className="adm-btn wide" disabled={busy}>
            {busy ? 'Sending…' : 'Send the link'}
          </button>
        </form>
      )}
      <Link className="adm-link" to="/admin/login">
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
      <form onSubmit={submit} className="adm-form">
        <p className="adm-dim">At least 10 characters. A short sentence is easier to remember than a jumble.</p>
        <label className="af">
          <span className="af-label">New password</span>
          <input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </label>
        <label className="af">
          <span className="af-label">Once more</span>
          <input type="password" required minLength={10} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <p className="adm-err">{error}</p>}
        <button className="adm-btn wide" disabled={busy || !token}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        {!token && <p className="adm-err">This page needs the link from your email.</p>}
      </form>
    </AuthShell>
  )
}

/* ---------------- the panel ---------------- */

function Protected({ children }) {
  if (!tokenClaims()) return <Navigate to="/admin/login" replace />
  return children
}

function Layout() {
  const [user, setUser] = useState(null)
  const [counts, setCounts] = useState(null)
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    api.me().then(setUser).catch(() => {})
  }, [])

  // unread badges, refreshed as staff move around and every minute
  useEffect(() => {
    const load = () => api.overview().then(setCounts).catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [location.pathname])

  useEffect(() => setMenu(false), [location.pathname])

  const logout = () => {
    setToken(null)
    navigate('/admin/login')
  }

  const unreadForms = counts ? Object.values(counts.forms || {}).reduce((n, f) => n + f.unread, 0) : 0
  const nav = [
    { section: null, items: [{ to: '/admin', label: 'Dashboard', icon: '◈', end: true }] },
    {
      section: 'Messages',
      items: [
        { to: '/admin/submissions', label: 'Form submissions', icon: '▤', badge: unreadForms },
        { to: '/admin/inbox', label: 'Mailbox', icon: '✉', badge: counts?.inbox_unread },
        { to: '/admin/email', label: 'Email log', icon: '↗' },
      ],
    },
    { section: 'Website', items: SINGLETONS.map((s) => ({ to: `/admin/s/${s.key}`, label: s.label, icon: s.icon })) },
    { section: 'Lists', items: COLLECTIONS.map((c) => ({ to: `/admin/c/${c.key}`, label: c.label, icon: c.icon })) },
    {
      section: 'Settings',
      items: [
        { to: '/admin/media', label: 'Media library', icon: '▧' },
        ...(user?.role === 'admin' ? [{ to: '/admin/team', label: 'Team', icon: '☺' }] : []),
        { to: '/admin/account', label: 'My account', icon: '⚿' },
      ],
    },
  ]

  return (
    <div className="adm">
      <header className="adm-top">
        <img src="/logo-compact-dark.svg" alt="Skyline" />
        <button className="adm-menu-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
          {menu ? 'Close' : 'Menu'}
        </button>
      </header>
      <aside className={`adm-side${menu ? ' open' : ''}`}>
        <div className="adm-brand">
          <img src="/logo-compact-dark.svg" alt="Skyline" />
          <small>Website admin</small>
        </div>
        <nav>
          {nav.map((group, i) => (
            <div className="adm-group" key={group.section || i}>
              {group.section && <span className="adm-group-label">{group.section}</span>}
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : undefined)}>
                  <i aria-hidden="true">{item.icon}</i>
                  <span>{item.label}</span>
                  {item.badge > 0 && <b className="adm-badge">{item.badge}</b>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="adm-side-foot">
          {user && (
            <p>
              {user.name || user.email}
              <small>{user.role === 'admin' ? 'Administrator' : 'Editor'}</small>
            </p>
          )}
          <a href="/" target="_blank" rel="noreferrer">
            View the website ↗
          </a>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="adm-main">
        <ErrorBoundary routeKey={location.pathname}>
          <Outlet context={{ user, counts }} />
        </ErrorBoundary>
      </main>
    </div>
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

export default function AdminApp() {
  useEffect(() => {
    document.title = 'Skyline — Website admin'
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
        <Route path="s/:key" element={<SingletonRoute />} />
        <Route path="c/:key" element={<CollectionRoute />} />
        <Route path="submissions" element={<Submissions />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="email" element={<Email />} />
        <Route path="media" element={<Media />} />
        <Route path="team" element={<Team />} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
