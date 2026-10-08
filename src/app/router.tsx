import { createBrowserRouter, Navigate } from 'react-router'
import { HomePage } from '@/features/home/HomePage'
import { ProjectLayout } from '@/features/project/ProjectLayout'
import { ClipsStep } from '@/features/clips/ClipsStep'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  {
    path: '/p/:projectId',
    element: <ProjectLayout />,
    children: [
      { index: true, element: <Navigate to="clips" replace /> },
      { path: 'clips', element: <ClipsStep /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
