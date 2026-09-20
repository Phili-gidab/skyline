import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './styles/atlas.css'
import { loadContent } from './lib/content'

const root = ReactDOM.createRoot(document.getElementById('root'))

if (window.location.pathname.startsWith('/admin')) {
  // the admin is its own app and chunk: none of the site's scroll code loads
  const AdminRoot = lazy(() => import('./admin/AdminRoot.jsx'))
  root.render(
    <Suspense fallback={null}>
      <AdminRoot />
    </Suspense>
  )
} else {
  // The site mounts once, on settled content. App is imported only after the
  // content is applied, so nothing reads the defaults on its way in.
  loadContent()
    .then(() => import('./App.jsx'))
    .then(({ default: App }) => {
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      )
    })
}
