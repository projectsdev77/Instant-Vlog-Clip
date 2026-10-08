import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/features/home/HomePage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
])
