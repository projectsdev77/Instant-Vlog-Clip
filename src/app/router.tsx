import { createBrowserRouter, Navigate } from 'react-router'
import { HomePage } from '@/features/home/HomePage'
import { ProjectLayout } from '@/features/project/ProjectLayout'
import { ClipsStep } from '@/features/clips/ClipsStep'
import { ScriptStep } from '@/features/script/ScriptStep'
import { VoiceStep } from '@/features/voice/VoiceStep'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  {
    path: '/p/:projectId',
    element: <ProjectLayout />,
    children: [
      { index: true, element: <Navigate to="clips" replace /> },
      { path: 'clips', element: <ClipsStep /> },
      { path: 'script', element: <ScriptStep /> },
      { path: 'voice', element: <VoiceStep /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
