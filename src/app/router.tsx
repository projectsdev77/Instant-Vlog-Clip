import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { UpgradeSheet } from '@/features/account/UpgradeSheet'
import { AuthSheet } from '@/features/auth/AuthSheet'
import { HomePage } from '@/features/home/HomePage'
import { AppError } from './AppError'

// Everything past the home page (video decoding, AI, editor) loads on demand.
const page = (load: () => Promise<{ default: ComponentType }>) => {
  const C = lazy(load)
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <C />
    </Suspense>
  )
}

/** Wraps every page: sheets that any page can open live here, inside the router. */
function Root() {
  return (
    <>
      <Outlet />
      <AuthSheet />
      <UpgradeSheet />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <AppError />,
    children: [
      { path: '/', element: <HomePage /> },
      {
        path: '/p/:projectId',
        element: page(() => import('@/features/project/ProjectLayout').then((m) => ({ default: m.ProjectLayout }))),
        children: [
          { index: true, element: <Navigate to="clips" replace /> },
          { path: 'clips', element: page(() => import('@/features/clips/ClipsStep').then((m) => ({ default: m.ClipsStep }))) },
          { path: 'script', element: page(() => import('@/features/script/ScriptStep').then((m) => ({ default: m.ScriptStep }))) },
          { path: 'voice', element: page(() => import('@/features/voice/VoiceStep').then((m) => ({ default: m.VoiceStep }))) },
          { path: 'generate', element: page(() => import('@/features/generate/GenerateStep').then((m) => ({ default: m.GenerateStep }))) },
          { path: 'record', element: page(() => import('@/features/voice/RecordStep').then((m) => ({ default: m.RecordStep }))) },
          { path: 'edit', element: page(() => import('@/features/edit/EditStep').then((m) => ({ default: m.EditStep }))) },
        ],
      },
      { path: '/signin', element: page(() => import('@/features/auth/SignInPage').then((m) => ({ default: m.SignInPage }))) },
      { path: '/pricing', element: page(() => import('@/features/account/PricingPage').then((m) => ({ default: m.PricingPage }))) },
      { path: '/account', element: page(() => import('@/features/account/AccountPage').then((m) => ({ default: m.AccountPage }))) },
      { path: '/terms', element: page(() => import('@/features/account/LegalPages').then((m) => ({ default: m.TermsPage }))) },
      { path: '/privacy', element: page(() => import('@/features/account/LegalPages').then((m) => ({ default: m.PrivacyPage }))) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
