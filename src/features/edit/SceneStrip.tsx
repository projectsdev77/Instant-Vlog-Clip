import { useEffect, useRef } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Music2, Plus } from 'lucide-react'
import type { Clip, EditPlan, Project } from '@/domain/types'
import type { Timeline } from '@/domain/timeline'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'

type Props = {
  project: Project
  plan: EditPlan
  clips: Clip[]
  timeline: Timeline
  selected: number
  /** playhead, seconds: the playing scene's tile fills as it plays */
  now: number
  compact: boolean
  busy: boolean
  onSelect: (i: number) => void
  onMove: (from: number, to: number) => void
  onAdd: () => void
}

/**
 * The vlog as a row of scenes: tile width follows scene length (fixed on
 * phones), the selected one is ringed, music-only scenes get a note badge.
 * Drag (long-press on touch) or Alt+←/→ to reorder.
 */
export function SceneStrip({ project, plan, clips, timeline, selected, now, compact, busy, onSelect, onMove, onAdd }: Props) {
  const byId = new Map(clips.map((c) => [c.id, c]))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }), useSensor(KeyboardSensor))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = plan.scenes.findIndex((s) => s.id === e.active.id)
    const to = plan.scenes.findIndex((s) => s.id === e.over!.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }
  return (
    <div data-tour="scenes">
      {!compact && (
        <div className="mb-2.5 flex items-center justify-between gap-4 text-[13px]">
          <p className="text-muted">
            Scenes · {plan.scenes.length} · {formatDuration(timeline.duration)} <span className="text-white/40">· click one to edit it</span>
          </p>
          <p className="flex items-center gap-4 text-white/40">
            <span className="flex items-center gap-1.5">
              <Music2 className="size-3.5" strokeWidth={2.4} /> music only
            </span>
            <span>Drag to reorder</span>
          </p>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={plan.scenes.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className={cn('flex gap-1.5', compact ? '-mx-4 overflow-x-auto px-4 py-1 [scrollbar-width:none]' : 'h-[72px]')}>
          <ol aria-label="Scenes" className={cn('flex gap-1.5', !compact && 'min-w-0 flex-1')}>
            {plan.scenes.map((scene, i) => {
              const ts = timeline.scenes[i]
              const line = project.script?.lines.find((l) => l.id === scene.lineId)
              return (
                <Tile
                  key={scene.id}
                  id={scene.id}
                  index={i}
                  last={i === plan.scenes.length - 1}
                  seconds={ts ? ts.end - ts.start : 1}
                  cover={byId.get(scene.shots[0]?.clipId)?.thumbnail}
                  musicOnly={!line}
                  label={line ? `Scene ${i + 1}: ${line.text}` : `Scene ${i + 1} · music only`}
                  times={ts ? `${formatDuration(ts.start)}–${formatDuration(ts.end)}` : ''}
                  progress={ts && now >= ts.start && now < ts.end ? (now - ts.start) / Math.max(0.01, ts.end - ts.start) : null}
                  selected={i === selected}
                  compact={compact}
                  busy={busy}
                  onSelect={() => onSelect(i)}
                  onMove={onMove}
                />
              )
            })}
          </ol>
            <div className={cn('shrink-0', compact ? 'h-[68px] w-[46px]' : 'w-[52px]')}>
              <button type="button" onClick={onAdd} disabled={busy} aria-label="Add a scene" title="Add a scene" className="grid size-full place-items-center rounded-[12px] border-[1.5px] border-dashed border-white/25 text-white/70 transition hover:bg-white/5 hover:text-fg disabled:opacity-40">
                <Plus className="size-5" strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function Tile(props: { id: string; index: number; last: boolean; seconds: number; cover?: string; musicOnly: boolean; label: string; times: string; progress: number | null; selected: boolean; compact: boolean; busy: boolean; onSelect: () => void; onMove: (from: number, to: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id, disabled: props.busy })
  const { index } = props
  // Phones: the strip scrolls sideways, so keep the playing scene in view.
  const node = useRef<HTMLLIElement | null>(null)
  const isPlaying = props.progress !== null
  useEffect(() => {
    if (isPlaying && props.compact) node.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [isPlaying, props.compact])
  return (
    <li
      ref={(el) => {
        setNodeRef(el)
        node.current = el
      }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        ...(props.compact ? {} : { flexGrow: Math.max(0.3, props.seconds), flexBasis: 0 }),
      }}
      className={cn('relative shrink-0', props.compact ? 'h-[68px] w-[46px]' : 'min-w-[44px]', isDragging && 'z-10 opacity-80')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={props.label}
        aria-current={props.selected ? 'true' : undefined}
        title={`Scene ${index + 1} · ${props.times}`}
        onClick={props.onSelect}
        onKeyDown={(e) => {
          if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault()
            e.stopPropagation()
            const to = index + (e.key === 'ArrowLeft' ? -1 : 1)
            if (to >= 0 && !(e.key === 'ArrowRight' && props.last)) props.onMove(index, to)
            return
          }
          listeners?.onKeyDown?.(e)
        }}
        className={cn(
          'relative block size-full touch-manipulation overflow-hidden rounded-[12px] bg-surface-2 bg-cover bg-center',
          props.selected ? 'shadow-[0_0_0_2.5px_#ff5a1f]' : props.progress !== null && 'shadow-[inset_0_0_0_2px_#fff]',
        )}
        style={props.cover ? { backgroundImage: `url(${props.cover})` } : undefined}
      >
        {!props.selected && props.progress === null && <span className="absolute inset-0 bg-black/28" aria-hidden />}
        {/* The scene the preview is on: its tile fills as it plays. */}
        {props.progress !== null && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40" aria-hidden>
            <span className="block h-full bg-white" style={{ width: `${Math.min(100, props.progress * 100)}%` }} />
          </span>
        )}
        <span className={cn('tabular absolute top-1 left-1 grid size-5 place-items-center rounded-full text-[11px] font-bold', props.progress !== null ? 'bg-white text-ink' : 'bg-black/60')} aria-hidden>
          {index + 1}
        </span>
        {props.musicOnly && (
          <span className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-black/60" aria-hidden>
            <Music2 className="size-3" strokeWidth={2.6} />
          </span>
        )}
      </button>
    </li>
  )
}
