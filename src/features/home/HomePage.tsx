import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { Cloud, Download, MoreHorizontal, Play, Plus, Upload } from 'lucide-react'
import { LogoTile, PrivacyLine, Wordmark } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { backupProject, restoreProject } from '@/pipeline/backup'
import { db } from '@/lib/db'
import { formatDuration, relativeDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { createProject, deleteProject } from '@/store/projectStore'
import { stepPath } from '@/features/project/steps'
import type { Project } from '@/domain/types'
import { AccountButton } from '@/features/auth/AccountButton'
import { refreshAccount, useCloud } from '@/cloud/autoSync'
import { deleteFromAccount, isMine, pullProject, videoLink } from '@/cloud/sync'
import type { CloudRow } from '@/cloud/backend'
import { EXAMPLES, FALLBACK_BGS, type CoverItem } from './covers'
import { CoverVideo } from './CoverVideo'
import { WhatYouGet } from './WhatYouGet'
import { SiteFooter } from '@/features/account/SiteLayout'
import { sumShots } from '@/domain/shots'
import { CirclePlay } from 'lucide-react'
import { TutorialIntro } from '@/features/tutorial/TutorialIntro'
import { useTutorial } from '@/features/tutorial/tutorial'
import { SAMPLE_PROMPT, SAMPLE_TITLE } from '@/features/tutorial/samples'

function vlogLength(p: Project): number {
  const edit = p.currentEdit >= 0 ? p.edits[p.currentEdit] : undefined
  return edit ? edit.scenes.reduce((a, s) => a + sumShots(s.shots), 0) : 0
}

/** A vlog on Home: on this device, in the account, or both. */
type Card = { id: string; title: string; updatedAt: number; seconds: number; project?: Project; row?: CloudRow }

export function HomePage() {
  const navigate = useNavigate()
  const { userId, rows } = useCloud()
  const allProjects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  // Signed in: this account's vlogs (and ones made here before signing in), plus the ones only in the account.
  const projects = allProjects?.filter((p) => !userId || isMine(p, userId))
  useEffect(() => {
    if (userId) void refreshAccount()
  }, [userId])
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
  const [deleting, setDeleting] = useState<Card | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const backupInput = useRef<HTMLInputElement>(null)
  const openBackupButton = (
    <Button variant="text" size="sm" className="-my-2" disabled={restoring} onClick={() => backupInput.current?.click()}>
      {restoring ? <Spinner /> : <Upload className="size-4" strokeWidth={2.4} />} Open a backup
    </Button>
  )
  const closeMenu = () => {
    setDeleting(null)
    setConfirmDelete(false)
  }
  const downloadVideo = async (c: Card) => {
    const url = await videoLink(c.id, `${(c.title || 'vlog').replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'vlog'}.mp4`)
    if (!url) return toast('Couldn’t get the video. Try again in a moment.', 'error')
    const a = document.createElement('a')
    a.href = url
    a.click()
    closeMenu()
  }
  const remove = async (c: Card) => {
    closeMenu()
    try {
      if (userId && (c.row || (c.project && c.project.ownerId === userId))) await deleteFromAccount(c.id)
      if (c.project) await deleteProject(c.id)
      useCloud.setState((st) => ({ rows: st.rows?.filter((r) => r.id !== c.id) ?? null }))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  const downloadBackup = async (p: Project) => {
    setBackingUp(true)
    try {
      const { blob, fileName } = await backupProject(p.id)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
      closeMenu()
    } catch (e) {
      toast((e as Error).message || 'Couldn’t make the backup.', 'error')
    } finally {
      setBackingUp(false)
    }
  }
  const openBackup = async (file: File | undefined) => {
    if (!file) return
    setRestoring(true)
    try {
      const p = await restoreProject(file)
      toast(`Restored “${p.title || 'Untitled vlog'}”.`, 'success')
    } catch (e) {
      toast((e as Error).message || 'Couldn’t open that backup.', 'error')
    } finally {
      setRestoring(false)
    }
  }
  const desktop = useMediaQuery('(min-width: 768px)')

  const start = async () => {
    const p = await createProject()
    navigate(stepPath(p.id, 'clips'))
  }
  const open = (p: Project) => navigate(stepPath(p.id, p.step === 'generate' && p.edits.length ? 'edit' : p.step))
  const openCard = async (c: Card) => {
    if (c.project && (!c.row || Date.parse(c.row.updated_at) <= c.project.updatedAt)) return open(c.project)
    // In the account (only, or newer there): bring it to this device first.
    setOpening(c.id)
    try {
      const p = await pullProject(c.id)
      if (p) open(p)
      else if (c.project) open(c.project)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setOpening(null)
    }
  }

  const list = projects ?? []
  const local = new Set(list.map((p) => p.id))
  const rowById = new Map((rows ?? []).map((r) => [r.id, r]))
  const cards: Card[] = [
    ...list.map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt, seconds: vlogLength(p), project: p, row: rowById.get(p.id) })),
    ...(rows ?? []).filter((r) => !local.has(r.id)).map((r) => ({ id: r.id, title: r.title, updatedAt: Date.parse(r.updated_at), seconds: 0, row: r })),
  ].sort((a, b) => b.updatedAt - a.updatedAt)
  const firstVisit = projects !== undefined && cards.length === 0
  const { introSeen, openIntro } = useTutorial()
  // First visit: show how it works before anything else.
  useEffect(() => {
    if (firstVisit && !introSeen) openIntro()
  }, [firstVisit, introSeen, openIntro])
  const trySample = async () => {
    const p = await createProject()
    await db.projects.update(p.id, { title: SAMPLE_TITLE, prompt: SAMPLE_PROMPT })
    navigate(`${stepPath(p.id, 'clips')}?sample=1`)
  }
  const mine: CoverItem[] = firstVisit
    ? []
    : cards.slice(0, 3).map((p, i) => ({
        id: p.id,
        title: p.title || 'Untitled vlog',
        meta: `${relativeDate(p.updatedAt)}${p.seconds ? ` · ${formatDuration(p.seconds)}` : ''}`,
        image: thumbs?.get(p.id) ?? p.row?.cover ?? undefined,
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
          <button type="button" onClick={openIntro} className="flex h-10 items-center gap-1.5 rounded-full border border-white/16 px-3.5 text-[14px] font-semibold text-white/90 transition hover:bg-white/10">
            <CirclePlay className="size-4" strokeWidth={2.4} />
            How it works
          </button>
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
        <CoverFan covers={covers} onOpen={(c) => c.id && void openCard(cards.find((p) => p.id === c.id)!)} />
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

      <WhatYouGet />

      {cards.length > 0 && (
        <section className="relative mx-auto mt-10 max-w-[1120px] px-4 md:px-10">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="title-2">Your vlogs</h2>
            <span className="flex items-center gap-2 text-[14px] text-muted">
              {cards.length} made · {openBackupButton}
            </span>
          </div>
          <p className="-mt-3 mb-5 text-[13px] text-faint">
            {userId
              ? 'Saved to your account: sign in on any device to see them. Your original clips stay on the device you added them on; to keep editing somewhere else, you add them again.'
              : 'Saved in this browser only. Sign in to save them to your account and open them on any device.'}
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-[18px]">
            {cards.map((c, i) => (
              <li key={c.id} className="min-w-0">
                <button type="button" onClick={() => void openCard(c)} disabled={opening === c.id} className="group block w-full text-left">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-[var(--radius-card)] transition duration-150 ease-ember group-hover:-translate-y-1" style={{ background: FALLBACK_BGS[i % FALLBACK_BGS.length] }}>
                    {(thumbs?.get(c.id) ?? c.row?.cover) && <img src={thumbs?.get(c.id) ?? c.row?.cover ?? ''} alt="" className="size-full object-cover" />}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-black/50" />
                    {c.seconds > 0 && <span className="tabular absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold">{formatDuration(c.seconds)}</span>}
                    {!c.project && (
                      <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-semibold backdrop-blur" title="In your account, not on this device yet. Opening it brings it here.">
                        <Cloud className="size-3.5" strokeWidth={2.4} /> In your account
                      </span>
                    )}
                    {c.row?.video_bytes && (
                      <span className="absolute right-2.5 bottom-2.5 grid size-7 place-items-center rounded-full bg-black/60" title="The finished video is saved in your account">
                        <Play className="size-3.5 fill-current" strokeWidth={2.4} />
                      </span>
                    )}
                    {opening === c.id && (
                      <span className="absolute inset-0 grid place-items-center bg-black/55">
                        <Spinner className="size-6" />
                      </span>
                    )}
                  </div>
                </button>
                <div className="mt-2.5 flex items-start gap-1">
                  <button type="button" onClick={() => void openCard(c)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[15px] font-semibold">{c.title || 'Untitled vlog'}</div>
                    <div className="text-[13px] font-medium text-muted">{relativeDate(c.updatedAt)}</div>
                  </button>
                  <button type="button" aria-label={`More options for ${c.title || 'Untitled vlog'}`} onClick={() => setDeleting(c)} className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-fg">
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
        </section>
      )}

      <input ref={backupInput} type="file" accept=".vlogbackup,application/octet-stream" hidden onChange={(e) => void openBackup(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      {cards.length === 0 && projects !== undefined && (
        <div className="relative mx-auto mt-6 flex max-w-[1120px] justify-center px-4 md:px-10">
          {openBackupButton}
        </div>
      )}

      <section className="relative mx-auto mt-16 max-w-[1120px] px-4 text-center md:mt-24 md:px-10">
        <h2 className="mx-auto max-w-[16ch] text-[clamp(34px,5vw,56px)] leading-[1] font-extrabold tracking-[-0.04em] text-balance">Your camera roll is full of vlogs.</h2>
        <p className="mx-auto mt-4 max-w-[44ch] text-[17px] text-muted">Pick a few clips from today and see it come together in about a minute.</p>
        {desktop && (
          <div className="mt-8 flex justify-center">
            <NewVlogButton onClick={start} />
          </div>
        )}
      </section>

      <SiteFooter className="mt-16 pb-28 md:pb-8" />

      <TutorialIntro onTrySample={() => void trySample()} onOwnClips={() => void start()} />

      {/* Phone: main action pinned in thumb reach */}
      {!desktop && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-b from-transparent to-bg to-32% px-4 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <NewVlogButton onClick={start} block />
          <PrivacyLine className="mt-3 justify-center text-[13px]" />
        </div>
      )}

      <Sheet open={!!deleting} title={confirmDelete ? 'Delete this vlog?' : deleting?.title || 'Untitled vlog'} onClose={closeMenu}>
        {confirmDelete ? (
          <>
            <p className="text-muted">
              “{deleting?.title || 'Untitled vlog'}” will be removed {userId && (deleting?.row || deleting?.project?.ownerId === userId) ? 'from this device and your account' : 'from this device'}. This can’t be undone.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="danger" block onClick={() => deleting && void remove(deleting)}>
                Delete vlog
              </Button>
              <Button variant="outline" block onClick={closeMenu}>
                Keep it
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {deleting?.row?.video_bytes && (
              <Button variant="outline" block onClick={() => deleting && void downloadVideo(deleting)}>
                <Download className="size-4" strokeWidth={2.4} /> Download the video
              </Button>
            )}
            {deleting?.project && (
              <>
                <Button variant="outline" block disabled={backingUp} onClick={() => deleting.project && void downloadBackup(deleting.project)}>
                  {backingUp ? <Spinner /> : <Download className="size-4" strokeWidth={2.4} />} Download a backup
                </Button>
                <p className="mb-2 px-1 text-[13px] text-faint">One file with this vlog’s clips, recordings and edits. Open it later with “Open a backup” on this page, on any device.</p>
              </>
            )}
            <Button variant="danger" block onClick={() => setConfirmDelete(true)}>
              Delete vlog
            </Button>
          </div>
        )}
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
      {!item.image && item.video && <CoverVideo item={item} overlay={big && !!item.captions} />}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/60" />
      {big && (
        <>
          {item.tag && <span className="absolute top-3.5 left-3.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-ink uppercase">{item.tag}</span>}
          {!item.captions && (
            <span className="absolute top-1/2 left-1/2 grid size-[60px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink">
              <Play className="ml-0.5 size-5" fill="currentColor" />
            </span>
          )}
          {!item.captions && (
            <span className="absolute inset-x-4 bottom-4">
              <span className="block text-[17px] leading-tight font-bold">{item.title}</span>
              <span className="mt-1 block text-[12px] font-medium text-white/80">{item.meta}</span>
            </span>
          )}
        </>
      )}
      {!big && item.meta && <span className="tabular absolute bottom-3 left-3 text-[12px] font-semibold">{item.meta.split(' · ').pop()}</span>}
    </button>
  )
}
