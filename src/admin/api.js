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

/* A session that ends mid-work does not throw the page away: the panel shows
   a sign-in dialog over it (AdminApp listens for this), and whatever was
   being written is still there afterwards. */
export const SESSION_ENDED = 'skyline:session-ended'
const sessionEnded = () => window.dispatchEvent(new Event(SESSION_ENDED))

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const token = getToken()
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(raw ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // some cPanel firewalls reject a POST/PUT with no body, so one is always sent
      body: raw ? body : JSON.stringify(body ?? (method === 'GET' || method === 'DELETE' ? undefined : {})),
    })
  } catch {
    throw new Error('Could not reach the server — check the connection and try again')
  }
  if (res.status === 401 && token) sessionEnded()
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    // a page where JSON belongs means /api is not reaching the API at all
    throw new Error(res.ok ? 'The server sent back something unexpected — try again' : `Request failed (${res.status})`)
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

/* Private files (CVs, mail attachments) need the token, which a plain link
   cannot carry — and a token in a URL would leak. Fetch the bytes instead. */
async function fetchBlob(path) {
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  } catch {
    throw new Error('Could not reach the server')
  }
  if (res.status === 401) sessionEnded()
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Could not load that file')
  }
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

/* The tab is opened at the click, before the download — a window opened after
   an await is treated as a popup and blocked. */
async function openBlob(path) {
  const win = window.open('', '_blank')
  try {
    const url = URL.createObjectURL(await fetchBlob(path))
    if (win) {
      win.opener = null
      win.location.href = url
    } else {
      window.location.assign(url)
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (e) {
    win?.close()
    throw e
  }
}

const form = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return fd
}

/* Only web links and the site's own paths are ever put in an href: a saved
   "javascript:" value must not run in a signed-in admin's tab. */
export const safeUrl = (url) => {
  const u = String(url || '').trim()
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u
  if (u.startsWith('/') && !u.startsWith('//')) return `${BASE}${u}`
  return ''
}
export const mediaUrl = safeUrl

const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  forgot: (email) => request('/auth/forgot', { method: 'POST', body: { email } }),
  reset: (token, password) => request('/auth/reset', { method: 'POST', body: { token, password } }),
  me: () => request('/auth/me'),
  updateProfile: (patch) => request('/auth/profile', { method: 'PUT', body: patch }),
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

  submissions: (params = {}) => request(`/admin/submissions?${qs(params)}`),
  submission: (id) => request(`/admin/submissions/${id}`),
  setRead: (id, isRead) => request(`/admin/submissions/${id}`, { method: 'PUT', body: { is_read: isRead } }),
  deleteSubmission: (id) => request(`/admin/submissions/${id}`, { method: 'DELETE' }),
  downloadCv: (id, filename) => saveBlob(`/admin/submissions/${id}/cv`, filename),
  downloadDocument: (id, n, filename) => saveBlob(`/admin/submissions/${id}/documents/${n}`, filename),
  openDocument: (id, n) => openBlob(`/admin/submissions/${id}/documents/${n}?view=1`),

  /* the mailboxes */
  mailBoxes: () => request('/admin/mail/boxes'),
  mailList: (box, folder, q) => request(`/admin/mail/messages?${qs({ box, folder, q })}`),
  mailThread: (id) => request(`/admin/mail/messages/${id}`),
  setMailStatus: (id, status) => request(`/admin/mail/messages/${id}`, { method: 'PUT', body: { status } }),
  deleteMailForever: (id) => request(`/admin/mail/messages/${id}`, { method: 'DELETE' }),
  mailBulk: (ids, status) => request('/admin/mail/bulk', { method: 'POST', body: { ids, status } }),
  emptyTrash: (box) => request('/admin/mail/bulk', { method: 'POST', body: { box, status: 'purge' } }),
  sendMail: (payload) => request('/admin/mail/send', { method: 'POST', body: payload }),
  uploadMailAttachment: (file) => request('/admin/mail/attachments', { method: 'POST', body: form(file), raw: true }),
  mailAttachmentBlobUrl: async (msgId, attId) => URL.createObjectURL(await fetchBlob(`/admin/mail/messages/${msgId}/attachments/${attId}?view=1`)),
  downloadMailAttachment: (msgId, attId, filename) => saveBlob(`/admin/mail/messages/${msgId}/attachments/${attId}`, filename),
  openMailAttachment: (msgId, attId) => openBlob(`/admin/mail/messages/${msgId}/attachments/${attId}?view=1`),
  mailSettings: () => request('/admin/mail/settings'),
  createMailbox: (payload) => request('/admin/mail/settings', { method: 'POST', body: payload }),
  updateMailbox: (id, patch) => request(`/admin/mail/settings/${id}`, { method: 'PUT', body: patch }),
  deleteMailbox: (id) => request(`/admin/mail/settings/${id}`, { method: 'DELETE' }),

  emails: (params = {}) => request(`/admin/emails?${qs(params)}`),
  sendTestEmail: (to) => request('/admin/emails/test', { method: 'POST', body: { to } }),

  /* work boards */
  boards: () => request('/admin/boards'),
  board: (id, params = {}) => request(`/admin/boards/${id}?${qs(params)}`),
  createBoard: (payload) => request('/admin/boards', { method: 'POST', body: payload }),
  updateBoard: (id, patch) => request(`/admin/boards/${id}`, { method: 'PUT', body: patch }),
  deleteBoard: (id) => request(`/admin/boards/${id}`, { method: 'DELETE' }),
  addColumn: (boardId, payload) => request(`/admin/boards/${boardId}/columns`, { method: 'POST', body: payload }),
  updateColumn: (id, patch) => request(`/admin/columns/${id}`, { method: 'PUT', body: patch }),
  deleteColumn: (id) => request(`/admin/columns/${id}`, { method: 'DELETE' }),
  reorderColumns: (boardId, order) => request(`/admin/boards/${boardId}/columns/reorder`, { method: 'POST', body: { order } }),
  addGroup: (boardId, payload) => request(`/admin/boards/${boardId}/groups`, { method: 'POST', body: payload }),
  updateGroup: (id, patch) => request(`/admin/groups/${id}`, { method: 'PUT', body: patch }),
  deleteGroup: (id) => request(`/admin/groups/${id}`, { method: 'DELETE' }),
  addItem: (boardId, payload) => request(`/admin/boards/${boardId}/items`, { method: 'POST', body: payload }),
  boardItem: (id) => request(`/admin/board-items/${id}`),
  updateBoardItem: (id, patch) => request(`/admin/board-items/${id}`, { method: 'PUT', body: patch }),
  archiveBoardItem: (id) => request(`/admin/board-items/${id}`, { method: 'DELETE' }),
  restoreBoardItem: (id) => request(`/admin/board-items/${id}/restore`, { method: 'POST', body: {} }),
  bulkBoardItems: (boardId, payload) => request(`/admin/boards/${boardId}/items/bulk`, { method: 'POST', body: payload }),
  reorderItems: (boardId, groupId, order) => request(`/admin/boards/${boardId}/items/reorder`, { method: 'POST', body: { group_id: groupId, order } }),
  addUpdate: (itemId, body) => request(`/admin/board-items/${itemId}/updates`, { method: 'POST', body: { body } }),
  deleteUpdate: (id) => request(`/admin/updates/${id}`, { method: 'DELETE' }),
  revealSecret: (itemId, k) => request(`/admin/board-items/${itemId}/secrets/${k}/reveal`, { method: 'POST', body: {} }),
  setSecret: (itemId, k, value) => request(`/admin/board-items/${itemId}/secrets/${k}`, { method: 'PUT', body: { value } }),
  mapPerson: (boardId, payload) => request(`/admin/boards/${boardId}/map-person`, { method: 'POST', body: payload }),
  fromSubmission: (boardId, submissionId, groupId) =>
    request(`/admin/boards/${boardId}/from-submission`, { method: 'POST', body: { submission_id: submissionId, group_id: groupId } }),
  openItemDocument: (itemId, n) => openBlob(`/admin/board-items/${itemId}/documents/${n}?view=1`),
  downloadItemDocument: (itemId, n, filename) => saveBlob(`/admin/board-items/${itemId}/documents/${n}`, filename),

  users: () => request('/admin/users'),
  createUser: (payload) => request('/admin/users', { method: 'POST', body: payload }),
  updateUser: (id, patch) => request(`/admin/users/${id}`, { method: 'PUT', body: patch }),
  inviteUser: (id) => request(`/admin/users/${id}/invite`, { method: 'POST', body: {} }),
}
