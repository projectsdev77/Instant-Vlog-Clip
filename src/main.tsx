import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/Toast'
import { AuthSheet } from '@/features/auth/AuthSheet'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
    <AuthSheet />
  </StrictMode>,
)
