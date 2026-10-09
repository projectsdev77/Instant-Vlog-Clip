import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { Camera, Plus, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import { useProject } from '@/store/projectStore'
import type { Clip } from '@/domain/types'
import { StepFooter, StepHeading, StepPage } from '@/features/project/ProjectLayout'
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
  const ready = clips.filter((c) => c.status !== 'error' && c.status !== 'importing')
  const starred = clips.filter((c) => c.mustInclude).length

  const next = async () => {
    if (stepIndex(project.step) < stepIndex('script')) await updateProject({ step: 'script' })
    navigate(stepPath(project.id, 'script'))
  }
  const pick = () => inputRef.current?.click()

  return (
    <>
      <StepPage>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <StepHeading step={1} title="Add your clips" sub="Messy is fine. We skip the shaky and accidental bits." />
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            hidden
            onChange={(e) => {
              void add(e.target.files)
              e.target.value = ''
            }}
          />

          {clips.length === 0 ? (
            <button
              type="button"
              onClick={pick}
              className={cn(
                'group flex h-[360px] w-full flex-col items-center justify-center gap-3 rounded-[28px] border-[1.5px] border-dashed px-6 text-center transition duration-150 ease-ember md:h-[340px]',
                dragging ? 'border-accent bg-accent-soft' : 'border-white/18 hover:border-accent hover:bg-[rgb(255_90_31/.05)]',
              )}
            >
              <span className="mb-2 grid size-[72px] place-items-center rounded-full bg-accent text-white shadow-ember transition duration-150 ease-ember group-hover:-translate-y-1">
                <Camera className="size-8" strokeWidth={2.2} />
              </span>
              <span className="text-[22px] font-bold">Choose videos</span>
              <span className="text-[15px] text-muted">
                <span className="hidden md:inline">or drag them here</span>
                <span className="md:hidden">From your phone’s gallery</span>
              </span>
              <span className="mt-1 text-[13px] font-medium text-faint">MP4, MOV or WebM · up to {LIMITS.maxClips} clips, 10 minutes, 4 GB</span>
            </button>
          ) : (
            <>
              <p className="mb-4 text-[14px] font-medium text-muted">
                {starred ? `${starred} clip${starred > 1 ? 's' : ''} marked must-include. ` : ''}Tap the star on any clip that has to be in.
              </p>
              <ul className={cn('grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]', dragging && 'opacity-60')}>
                {clips.map((c) => (
                  <ClipTile key={c.id} clip={c} onStar={() => updateClip(c.id, { mustInclude: !c.mustInclude })} onRemove={() => removeClip(c.id)} />
                ))}
                <li>
                  <button
                    type="button"
                    onClick={pick}
                    className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-tile)] border-[1.5px] border-dashed border-white/16 text-[15px] font-semibold transition hover:border-accent hover:bg-accent-soft"
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
                      <Plus className="size-5" strokeWidth={2.6} />
                    </span>
                    Add clips
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </StepPage>
      <StepFooter summary={clips.length ? <span className="tabular">{`${clips.length} clips · ${formatDuration(totalSec)} of ${formatDuration(LIMITS.maxTotalSec)} max`}</span> : undefined}>
        <Button size="md" disabled={!ready.length} onClick={next}>
          Continue
        </Button>
      </StepFooter>
    </>
  )
}

function ClipTile({ clip, onStar, onRemove }: { clip: Clip; onStar: () => void; onRemove: () => void }) {
  const busy = clip.status === 'importing'
  const failed = clip.status === 'error'
  return (
    <li className="relative">
      <div className={cn('relative aspect-[9/16] overflow-hidden rounded-[var(--radius-tile)] bg-surface-2', clip.mustInclude && 'shadow-[0_0_0_2px_#ff5a1f]')}>
        {clip.thumbnail && <img src={clip.thumbnail} alt={clip.fileName} className="size-full object-cover" />}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-black/60" />
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/72 text-[13px] font-semibold">
            <Spinner className="size-6" />
            Reading…
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[rgb(42_12_12/.9)] p-3 text-center text-[13px] font-medium">
            <span className="grid size-8 place-items-center rounded-full bg-danger text-[15px] font-extrabold text-danger-fg">!</span>
            <span className="line-clamp-4">{clip.error}</span>
            <Button size="sm" variant="quiet" className="h-9 bg-white/10" onClick={onRemove}>
              Remove
            </Button>
          </div>
        )}
        {!busy && !failed && clip.durationSec > 0 && <span className="tabular absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold">{formatDuration(clip.durationSec)}</span>}
        {!busy && !failed && clip.signals?.duplicateOf && (
          <span className="absolute right-2.5 bottom-2.5 text-[12px] font-bold text-ember-300" title="Looks like a near-copy of another clip; we'll use it less">
            Similar
          </span>
        )}
      </div>
      {!failed && (
        <>
          <button
            type="button"
            onClick={onStar}
            disabled={busy}
            aria-pressed={clip.mustInclude}
            aria-label={clip.mustInclude ? 'Starred: must include' : 'Star: must include'}
            className={cn('absolute top-1.5 left-1.5 grid size-9 place-items-center rounded-full backdrop-blur transition', clip.mustInclude ? 'bg-accent text-white' : 'bg-black/50 text-white hover:bg-black/70')}
          >
            <Star className="size-4" strokeWidth={2.4} fill={clip.mustInclude ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={onRemove} aria-label={`Remove ${clip.fileName}`} className="absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70">
            <X className="size-4" strokeWidth={2.6} />
          </button>
        </>
      )}
    </li>
  )
}
