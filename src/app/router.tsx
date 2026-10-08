import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { HomePage } from '@/features/home/HomePage'

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

export const router = createBrowserRouter([
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
      { path: 'edit', element: page(() => import('@/features/edit/EditStep').then((m) => ({ default: m.EditStep }))) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
