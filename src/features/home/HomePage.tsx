import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { Film, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { db } from '@/lib/db'
import { formatDuration, relativeDate } from '@/lib/format'
import { createProject, deleteProject } from '@/store/projectStore'
import { stepPath } from '@/features/project/steps'
import type { Project } from '@/domain/types'
import { aiMode } from '@/ai'
import { AccountButton } from '@/features/auth/AccountButton'

export function HomePage() {
  const navigate = useNavigate()
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])

  const start = async () => {
    const p = await createProject()
    navigate(stepPath(p.id, 'clips'))
  }

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg">
            <Film className="size-4" />
          </span>
          Instant Vlog Clip
        </div>
        {aiMode === 'mock' ? <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">Demo AI</span> : <AccountButton />}
      </header>

      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your clips, made into a vlog.</h1>
        <p className="mt-3 max-w-md text-muted">Add the videos from your day, say what happened, and get a narrated mini vlog with captions and music in about a minute.</p>
        <Button size="lg" className="mt-6" onClick={start}>
          <Plus className="size-5" /> New vlog
        </Button>
        <p className="mt-3 text-xs text-muted">Your videos stay on this device.</p>
      </section>

      {projects && projects.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">Your vlogs</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => navigate(stepPath(p.id, p.step))} />
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const firstClip = useLiveQuery(() => (project.clipIds[0] ? db.clips.get(project.clipIds[0]) : undefined), [project.clipIds[0]])
  const edit = project.currentEdit >= 0 ? project.edits[project.currentEdit] : undefined
  const duration = edit ? edit.scenes.reduce((a, s) => a + s.shots.reduce((b, x) => b + x.out - x.in, 0), 0) : 0
  return (
    <li className="group relative">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="aspect-[9/16] overflow-hidden rounded-[var(--radius-card)] bg-surface-2">
          {firstClip?.thumbnail ? <img src={firstClip.thumbnail} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted"><Film className="size-6" /></div>}
        </div>
        <div className="mt-2 truncate text-sm font-medium">{project.title || 'Untitled vlog'}</div>
        <div className="text-xs text-muted">
          {relativeDate(project.updatedAt)} · {edit ? formatDuration(duration) : `${project.clipIds.length} clips`}
        </div>
      </button>
      <button
        type="button"
        aria-label="Delete vlog"
        onClick={() => confirm('Delete this vlog? Its clips are removed from this device.') && deleteProject(project.id)}
        className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}
