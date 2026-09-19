import { applyContent } from '../data/site'

const API = import.meta.env.VITE_API_URL || ''
const CACHE_KEY = 'skyline-content'

/**
 * Fetch what the admin saved and write it into the site's exports before the
 * page mounts (see applyContent in data/site.js).
 *
 * It never holds the page for long: if the API is slow or absent — a static
 * preview with no PHP behind it — the last good copy this browser saw is used,
 * and failing that the built-in defaults, which are the site as it stands.
 */
export async function loadContent({ timeout = 2500 } = {}) {
  let remote = null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(`${API}/api/content`, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    // a host without the API answers with index.html, not an error
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      remote = await res.json()
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(remote))
      } catch {
        /* private browsing: fine, just no cache */
      }
    }
  } catch {
    /* offline, timed out, or no API here */
  } finally {
    clearTimeout(timer)
  }
  if (!remote) {
    try {
      remote = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    } catch {
      remote = null
    }
  }
  try {
    applyContent(remote)
  } catch (e) {
    console.error('Saved content could not be applied; showing the defaults.', e)
  }
}
