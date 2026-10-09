import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { MoreHorizontal, Play, Plus } from 'lucide-react'
import { DemoBadge, LogoTile, PrivacyLine, Wordmark } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { db } from '@/lib/db'
import { formatDuration, relativeDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { createProject, deleteProject } from '@/store/projectStore'
import { stepPath } from '@/features/project/steps'
import type { Project } from '@/domain/types'
import { aiMode } from '@/ai/mode'
import { AccountButton } from '@/features/auth/AccountButton'
import { EXAMPLES, FALLBACK_BGS, type CoverItem } from './covers'

function vlogLength(p: Project): number {
  const edit = p.currentEdit >= 0 ? p.edits[p.currentEdit] : undefined
  return edit ? edit.scenes.reduce((a, s) => a + s.shots.reduce((b, x) => b + x.out - x.in, 0), 0) : 0
}

export function HomePage() {
  const navigate = useNavigate()
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const thumbs = useLiveQuery(async () => {
    const map = new Map<string, string>()
    for (const p of projects ?? []) {
      const edit = p.currentEdit >= 0 ? p.edits[p.currentEdit] : undefined
      const clipId = edit?.scenes[0]?.shots[0]?.clipId ?? p.clipIds[0]
      const clip = clipId ? await db.clips.get(clipId) : undefined
      if (clip?.thumbnail) map.set(p.id, clip.thumbnail)
    }
    return map
  }, [projects])
  const [deleting, setDeleting] = useState<Project | null>(null)
  const desktop = useMediaQuery('(min-width: 768px)')

  const start = async () => {
    const p = await createProject()
    navigate(stepPath(p.id, 'clips'))
  }
  const open = (p: Project) => navigate(stepPath(p.id, p.step === 'generate' && p.edits.length ? 'edit' : p.step))

  const list = projects ?? []
  const firstVisit = projects !== undefined && list.length === 0
  const mine: CoverItem[] = firstVisit
    ? []
    : list.slice(0, 3).map((p, i) => ({
        id: p.id,
        title: p.title || 'Untitled vlog',
        meta: `${relativeDate(p.updatedAt)}${vlogLength(p) ? ` · ${formatDuration(vlogLength(p))}` : ''}`,
        image: thumbs?.get(p.id),
        bg: FALLBACK_BGS[i % FALLBACK_BGS.length],
        tag: i === 0 ? 'New' : undefined,
      }))
  // Always fan three covers; examples fill in until there are three vlogs.
  const covers: CoverItem[] = [...mine, ...EXAMPLES.slice(0, 3 - mine.length).map((e) => (mine.length ? { ...e, tag: undefined } : e))]

  return (
    <div className="relative min-h-dvh overflow-x-clip pb-40 md:pb-20">
      {/* Ember motion hero background */}
      <div className="ember-motion pointer-events-none absolute inset-x-0 top-0 h-[860px] overflow-hidden md:h-[760px]" aria-hidden>
        <div className="ember-streak top-[250px]" />
        <div className="ember-streak top-[520px] h-px opacity-60" />
        <div className="absolute top-[120px] -right-[60px] h-[560px] w-[600px] rounded-full bg-[radial-gradient(circle,rgb(26_6_2/.55)_0%,rgb(26_6_2/0)_70%)]" />
        <div className="ember-grain" />
        <div className="absolute inset-x-0 bottom-0 h-[240px] bg-gradient-to-b from-transparent via-[rgb(9_9_10/.8)] via-60% to-bg" />
      </div>

      <header className="relative mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10 md:pt-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoTile />
          <Wordmark />
        </div>
        <div className="flex items-center gap-2">
          {aiMode === 'mock' && <DemoBadge className="hidden md:inline-flex" />}
          <AccountButton />
        </div>
      </header>

      <section className="relative mx-auto grid max-w-[1120px] items-center gap-6 px-4 pt-10 md:grid-cols-[1fr_520px] md:gap-4 md:px-10 md:pt-16">
        <div className="min-w-0">
          <h1 className="text-[clamp(46px,7.4vw,84px)] leading-[.96] font-extrabold tracking-[-0.05em] text-balance">Your clips, made into a vlog.</h1>
          <p className="mt-6 max-w-[460px] text-[18px] leading-[1.55] text-white/92">Add the videos from your day, say what happened, and get a narrated mini vlog with captions and music in about a minute.</p>
          {desktop && (
            <div className="mt-9 flex items-center gap-6">
              <NewVlogButton onClick={start} />
              <PrivacyLine />
            </div>
          )}
        </div>
        <CoverFan covers={covers} onOpen={(c) => c.id && open(list.find((p) => p.id === c.id)!)} />
      </section>

      <section className="relative mx-auto mt-6 max-w-[1120px] px-4 md:mt-14 md:px-10">
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 border-b border-border pb-10">
          {[
            ['Add your clips', 'Messy is fine. We skip the accidental ones.'],
            ['Say what happened', 'Write a few lines, or let AI write them.'],
            ['Get your vlog', 'Narrated, captioned and set to music.'],
          ].map(([t, d], i) => (
            <li key={t} className="space-y-1">
              <div className="text-[14px] font-bold text-ember-300">#0{i + 1}</div>
              <div className="text-[17px] font-semibold">{t}</div>
              <p className="text-[15px] text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="relative mx-auto mt-10 max-w-[1120px] px-4 md:px-10">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="title-2">Your vlogs</h2>
          {list.length > 0 && <span className="text-[14px] text-muted">{list.length} made</span>}
        </div>
        {firstVisit ? (
          <div className="rounded-[var(--radius-panel)] bg-surface p-6">
            <div className="text-[16px] font-semibold">Your vlogs will show up here</div>
            <p className="mt-1 text-muted">Each vlog you make is saved on this device, so you can come back and change it later.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-[18px]">
            {list.map((p, i) => (
              <li key={p.id} className="min-w-0">
                <button type="button" onClick={() => open(p)} className="group block w-full text-left">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-[var(--radius-card)] transition duration-150 ease-ember group-hover:-translate-y-1" style={{ background: FALLBACK_BGS[i % FALLBACK_BGS.length] }}>
                    {thumbs?.get(p.id) && <img src={thumbs.get(p.id)} alt="" className="size-full object-cover" />}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-black/50" />
                    {vlogLength(p) > 0 && <span className="tabular absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold">{formatDuration(vlogLength(p))}</span>}
                  </div>
                </button>
                <div className="mt-2.5 flex items-start gap-1">
                  <button type="button" onClick={() => open(p)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[15px] font-semibold">{p.title || 'Untitled vlog'}</div>
                    <div className="text-[13px] font-medium text-muted">{relativeDate(p.updatedAt)}</div>
                  </button>
                  <button type="button" aria-label={`More options for ${p.title || 'Untitled vlog'}`} onClick={() => setDeleting(p)} className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-fg">
                    <MoreHorizontal className="size-5" />
                  </button>
                </div>
              </li>
            ))}
            <li>
              <button type="button" onClick={start} className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-dashed border-white/16 text-[15px] font-semibold hover:border-accent hover:bg-accent-soft">
                <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                  <Plus className="size-5" strokeWidth={2.6} />
                </span>
                New vlog
              </button>
            </li>
          </ul>
        )}
      </section>

      {/* Phone: main action pinned in thumb reach */}
      {!desktop && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-b from-transparent to-bg to-32% px-4 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <NewVlogButton onClick={start} block />
          <PrivacyLine className="mt-3 justify-center text-[13px]" />
        </div>
      )}

      <Sheet open={!!deleting} title="Delete this vlog?" onClose={() => setDeleting(null)}>
        <p className="text-muted">“{deleting?.title || 'Untitled vlog'}” will be removed from this device. This can’t be undone.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="danger"
            block
            onClick={() => {
              if (deleting) void deleteProject(deleting.id)
              setDeleting(null)
            }}
          >
            Delete vlog
          </Button>
          <Button variant="outline" block onClick={() => setDeleting(null)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function NewVlogButton({ onClick, block }: { onClick: () => void; block?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[60px] items-center justify-between gap-5 rounded-full bg-white py-2 pr-2 pl-7 text-[18px] font-bold text-ink shadow-lift transition duration-150 ease-ember hover:-translate-y-0.5 active:scale-[.98] md:h-[62px]',
        block && 'w-full',
      )}
    >
      New vlog
      <span className="grid size-[46px] place-items-center rounded-full bg-accent text-white shadow-ember">
        <Plus className="size-5" strokeWidth={2.8} />
      </span>
    </button>
  )
}

/** Latest three vlogs (or examples) fanned out like prints. */
function CoverFan({ covers, onOpen }: { covers: CoverItem[]; onOpen: (c: CoverItem) => void }) {
  const [front, left, right] = covers
  return (
    <div className="relative mx-auto h-[330px] w-full max-w-[520px] md:h-[500px]">
      <div className="absolute top-1/2 left-1/2 h-[500px] w-[520px] origin-center -translate-x-1/2 -translate-y-1/2 scale-[.64] md:scale-100">
        {left && <Cover item={left} width={186} className="top-[86px] left-[24px] -rotate-[11deg]" onOpen={onOpen} />}
        {right && <Cover item={right} width={186} className="top-[78px] right-[24px] rotate-[10deg]" onOpen={onOpen} />}
        {front && (
          <>
            <div className="absolute top-[40px] left-1/2 h-[405px] w-[228px] -translate-x-1/2 -rotate-2 rounded-[26px] opacity-60 blur-2xl" style={{ background: front.bg }} aria-hidden />
            <Cover item={front} width={228} big className="top-[16px] left-1/2 -translate-x-1/2 -rotate-2" onOpen={onOpen} />
          </>
        )}
      </div>
    </div>
  )
}

function Cover({ item, width, big, className, onOpen }: { item: CoverItem; width: number; big?: boolean; className?: string; onOpen: (c: CoverItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      disabled={!item.id}
      aria-label={item.id ? `Open ${item.title}` : `${item.title} (example)`}
      className={cn('absolute aspect-[9/16] overflow-hidden rounded-[26px] text-left shadow-cover transition duration-150 ease-ember enabled:hover:-translate-y-1.5', className)}
      style={{ width, background: item.bg }}
    >
      {item.image && <img src={item.image} alt="" className="absolute inset-0 size-full object-cover" />}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/60" />
      {big && (
        <>
          {item.tag && <span className="absolute top-3.5 left-3.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-ink uppercase">{item.tag}</span>}
          <span className="absolute top-1/2 left-1/2 grid size-[60px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink">
            <Play className="ml-0.5 size-5" fill="currentColor" />
          </span>
          <span className="absolute inset-x-4 bottom-4">
            <span className="block text-[17px] leading-tight font-bold">{item.title}</span>
            <span className="mt-1 block text-[12px] font-medium text-white/80">{item.meta}</span>
          </span>
        </>
      )}
      {!big && item.meta && <span className="tabular absolute bottom-3 left-3 text-[12px] font-semibold">{item.meta.split(' · ').pop()}</span>}
    </button>
  )
}
