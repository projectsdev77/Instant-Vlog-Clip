import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangle, Copy, ImagePlus, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import { useProject } from '@/store/projectStore'
import type { Clip } from '@/domain/types'
import { StepFooter } from '@/features/project/ProjectLayout'
import { stepIndex, stepPath } from '@/features/project/steps'
import { importFiles } from './importClips'
import { ACCEPT_ATTR, LIMITS } from './limits'

export function ClipsStep() {
  const { project, clips, updateClip, removeClip, updateProject } = useProject()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const navigate = useNavigate()
  if (!project) return null

  const add = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const { rejected } = await importFiles([...files])
    rejected.forEach((r) => toast(r, 'error'))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void add(e.dataTransfer.files)
  }

  const totalSec = clips.reduce((a, c) => a + c.durationSec, 0)
  const usable = clips.filter((c) => c.status !== 'error' && c.status !== 'importing')
  const processing = clips.some((c) => c.status === 'importing')

  const next = async () => {
    if (stepIndex(project.step) < stepIndex('script')) await updateProject({ step: 'script' })
    navigate(stepPath(project.id, 'script'))
  }

  return (
    <>
      <main
        className="flex-1 px-4 py-5"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <h1 className="text-2xl font-bold tracking-tight">Add your clips</h1>
        <p className="mt-1 text-sm text-muted">Pick the videos from your day. Messy is fine: we'll find the best moments and skip the accidental ones.</p>

        <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => {
          void add(e.target.files)
          e.target.value = ''
        }} />

        {clips.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'mt-6 flex w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-16 text-center transition',
              dragging ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface',
            )}
          >
            <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
              <ImagePlus className="size-7" />
            </span>
            <span className="text-base font-semibold">Choose videos</span>
            <span className="text-sm text-muted">or drag them here · MP4, MOV, WebM · up to {LIMITS.maxClips} clips</span>
          </button>
        ) : (
          <ul className={cn('mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4', dragging && 'opacity-60')}>
            {clips.map((c) => (
              <ClipTile key={c.id} clip={c} onStar={() => updateClip(c.id, { mustInclude: !c.mustInclude })} onRemove={() => removeClip(c.id)} />
            ))}
            <li>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-sm text-muted hover:bg-surface"
              >
                <ImagePlus className="size-6" /> Add more
              </button>
            </li>
          </ul>
        )}
        {clips.length > 0 && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
            <Star className="size-3.5" /> Star clips that must be in the vlog.
          </p>
        )}
      </main>
      <StepFooter hint={clips.length ? `${clips.length} clips · ${formatDuration(totalSec)} of ${formatDuration(LIMITS.maxTotalSec)} max` : undefined}>
        <Button block size="lg" disabled={!usable.length} onClick={next}>
          {processing && !usable.length ? <><Spinner /> Reading clips…</> : 'Continue'}
        </Button>
      </StepFooter>
    </>
  )
}

function ClipTile({ clip, onStar, onRemove }: { clip: Clip; onStar: () => void; onRemove: () => void }) {
  const busy = clip.status === 'importing'
  return (
    <li className="relative">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-surface-2">
        {clip.thumbnail && <img src={clip.thumbnail} alt={clip.fileName} className="size-full object-cover" />}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/30 text-white">
            <Spinner className="size-5" />
          </div>
        )}
        {clip.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 p-2 text-center text-[11px] text-white">
            <AlertTriangle className="size-5 text-warning" />
            {clip.error}
          </div>
        )}
        {clip.durationSec > 0 && <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">{formatDuration(clip.durationSec)}</span>}
        {clip.signals?.duplicateOf && (
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white" title="Looks like a near-copy of another clip; we'll use it less">
            <Copy className="size-3" /> Similar
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onStar}
        aria-pressed={clip.mustInclude}
        aria-label={clip.mustInclude ? 'Starred: must include' : 'Star: must include'}
        className={cn('absolute top-1.5 left-1.5 rounded-full p-1.5', clip.mustInclude ? 'bg-warning text-white' : 'bg-black/45 text-white')}
      >
        <Star className="size-3.5" fill={clip.mustInclude ? 'currentColor' : 'none'} />
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${clip.fileName}`} className="absolute top-1.5 right-1.5 rounded-full bg-black/45 p-1.5 text-white">
        <X className="size-3.5" />
      </button>
    </li>
  )
}
