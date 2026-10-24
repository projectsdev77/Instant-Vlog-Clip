import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/Toast'
import './index.css'

// After a new deploy, a tab opened earlier asks for code files that no longer
// exist. Reload once to get the new version (vlogs are saved, so nothing is
// lost); if it happens again right away, the error screen offers a Reload button.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('ivc-reloaded-at') ?? 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem('ivc-reloaded-at', String(Date.now()))
  } catch {
    // no session storage: still reload once
  }
  e.preventDefault()
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
  </StrictMode>,
)
