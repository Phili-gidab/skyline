const BASE = import.meta.env.VITE_API_URL || ''
const KEY = 'skyline-admin-token'

export const getToken = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(KEY, t)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the session simply ends with the tab */
  }
}

/* unverified claims, for routing only — the server checks every request */
export function tokenClaims() {
  const t = getToken()
  if (!t) return null
  try {
    const claims = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.exp * 1000 < Date.now()) {
      setToken(null)
      return null
    }
    return claims
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // some cPanel firewalls reject a POST/PUT with no body, so one is always sent
    body: raw ? body : JSON.stringify(body ?? (method === 'GET' || method === 'DELETE' ? undefined : {})),
  })
  if (res.status === 401 && token) {
    setToken(null)
    if (!location.pathname.startsWith('/admin/login')) location.href = '/admin/login?expired=1'
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

/* Private files (CVs, mail attachments) need the token, which a plain link
   cannot carry — and a token in a URL would leak. Fetch the bytes instead. */
async function fetchBlob(path) {
  const res = await fetch(`${BASE}/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) throw new Error('Could not load that file')
  return res.blob()
}

async function saveBlob(path, filename) {
  const url = URL.createObjectURL(await fetchBlob(path))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const form = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return fd
}

export const mediaUrl = (url) => (url && url.startsWith('/') ? `${BASE}${url}` : url)

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  forgot: (email) => request('/auth/forgot', { method: 'POST', body: { email } }),
  reset: (token, password) => request('/auth/reset', { method: 'POST', body: { token, password } }),
  me: () => request('/auth/me'),
  changePassword: (current, next) => request('/auth/password', { method: 'POST', body: { current, new: next } }),

  overview: () => request('/admin/overview'),

  getSingleton: (key) => request(`/admin/content/${key}`),
  saveSingleton: (key, data) => request(`/admin/content/${key}`, { method: 'PUT', body: data }),
  listItems: (c) => request(`/admin/items/${c}`),
  createItem: (c, data) => request(`/admin/items/${c}`, { method: 'POST', body: data }),
  updateItem: (c, id, data) => request(`/admin/items/${c}/${id}`, { method: 'PUT', body: data }),
  deleteItem: (c, id) => request(`/admin/items/${c}/${id}`, { method: 'DELETE' }),
  reorder: (c, order) => request(`/admin/items/${c}/reorder`, { method: 'POST', body: { order } }),

  upload: (file) => request('/admin/upload', { method: 'POST', body: form(file), raw: true }),
  listUploads: () => request('/admin/uploads'),
  deleteUpload: (name) => request(`/admin/upload/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  submissions: (kind) => request(`/admin/submissions${kind ? `?kind=${kind}` : ''}`),
  setRead: (id, isRead) => request(`/admin/submissions/${id}`, { method: 'PUT', body: { is_read: isRead } }),
  deleteSubmission: (id) => request(`/admin/submissions/${id}`, { method: 'DELETE' }),
  downloadCv: (id, filename) => saveBlob(`/admin/submissions/${id}/cv`, filename),
  downloadDocument: (id, n, filename) => saveBlob(`/admin/submissions/${id}/documents/${n}`, filename),
  openDocument: async (id, n) => {
    // opened in a tab of its own; the blob URL carries no token and dies with the tab
    const url = URL.createObjectURL(await fetchBlob(`/admin/submissions/${id}/documents/${n}?view=1`))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },

  inbox: (box) => request(`/admin/inbox?box=${box || 'inbox'}`),
  inboxMessage: (id) => request(`/admin/inbox/${id}`),
  setInboxStatus: (id, status) => request(`/admin/inbox/${id}/status`, { method: 'PUT', body: { status } }),
  reply: (id, text, attachments = []) => request(`/admin/inbox/${id}/reply`, { method: 'POST', body: { text, attachments } }),
  compose: (payload) => request('/admin/inbox/compose', { method: 'POST', body: payload }),
  uploadMailAttachment: (file) => request('/admin/inbox/attachment', { method: 'POST', body: form(file), raw: true }),
  attachmentBlobUrl: async (msgId, attId) => URL.createObjectURL(await fetchBlob(`/admin/inbox/${msgId}/attachment/${attId}`)),
  downloadAttachment: (msgId, attId, filename) => saveBlob(`/admin/inbox/${msgId}/attachment/${attId}`, filename),

  emails: () => request('/admin/emails'),
  sendTestEmail: (to) => request('/admin/emails/test', { method: 'POST', body: { to } }),

  users: () => request('/admin/users'),
  createUser: (payload) => request('/admin/users', { method: 'POST', body: payload }),
  updateUser: (id, patch) => request(`/admin/users/${id}`, { method: 'PUT', body: patch }),
  inviteUser: (id) => request(`/admin/users/${id}/invite`, { method: 'POST', body: {} }),
}
