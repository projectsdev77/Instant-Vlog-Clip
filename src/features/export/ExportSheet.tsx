import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, Share2 } from 'lucide-react'
import { PrivacyLine } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Sheet } from '@/components/ui/Sheet'
import type { Timeline } from '@/domain/timeline'
import type { Clip, Project } from '@/domain/types'
import { formatBytes, formatDuration } from '@/lib/format'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { ExportCancelled, exportVideo, pickFormat, type ExportResult } from '@/render/export'
import { outputSize } from '@/render/styles'

type State = { kind: 'ready' } | { kind: 'rendering'; progress: number } | { kind: 'done'; result: ExportResult; url: string } | { kind: 'error'; message: string; at: number }

function fileName(project: Project, ext: string) {
  const base = (project.title || 'vlog').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vlog'
  return `${base}.${ext}`
}

export function ExportSheet({ project, timeline, clips, onClose }: { project: Project; timeline: Timeline; clips: Clip[]; onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: 'ready' })
  const [container, setContainer] = useState('MP4')
  const abort = useRef<AbortController | null>(null)
  const desktop = useMediaQuery('(min-width: 768px)')
  const { width, height } = outputSize(project.settings.aspect, 1920)
  const cover = clips.find((c) => c.id === timeline.shots[0]?.clip.id)?.thumbnail

  useEffect(() => {
    void pickFormat(width, height)
      .then((f) => setContainer(f.extension.toUpperCase()))
      .catch(() => {})
  }, [width, height])
  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (state.kind !== 'done') return
    return () => URL.revokeObjectURL(state.url)
  }, [state])

  const start = async () => {
    abort.current = new AbortController()
    setState({ kind: 'rendering', progress: 0 })
    let last = 0
    try {
      const result = await exportVideo(timeline, project, (progress) => setState({ kind: 'rendering', progress: (last = progress) }), abort.current.signal)
      setState({ kind: 'done', result, url: URL.createObjectURL(result.blob) })
    } catch (e) {
      if (e instanceof ExportCancelled) setState({ kind: 'ready' })
      else setState({ kind: 'error', at: last, message: (e as Error).message || 'Something went wrong while rendering.' })
    }
  }

  const close = () => {
    abort.current?.abort()
    onClose()
  }

  const download = () => {
    if (state.kind !== 'done') return
    const a = document.createElement('a')
    a.href = state.url
    a.download = fileName(project, state.result.extension)
    a.click()
  }

  const share = async () => {
    if (state.kind !== 'done') return
    const r = state.result
    const file = new File([r.blob], fileName(project, r.extension), { type: r.mime })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: project.title })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    download()
  }

  const estMb = Math.max(0.5, timeline.duration * 0.22)
  const title = state.kind === 'done' ? 'Your vlog is ready' : state.kind === 'rendering' ? 'Making your video' : 'Export your vlog'

  return (
    <Sheet open title={title} onClose={close}>
      {state.kind === 'ready' && (
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface-2 p-3">
            <span className="block aspect-[9/16] w-[54px] shrink-0 overflow-hidden rounded-[var(--radius-thumb)] bg-black">{cover && <img src={cover} alt="" className="size-full object-cover" />}</span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-bold">{project.title || 'Untitled vlog'}</span>
              <span className="tabular block text-[13px] font-medium text-muted">
                {width}×{height} · 30 fps · {container}
              </span>
              <span className="tabular block text-[13px] font-medium text-muted">
                {formatDuration(timeline.duration)} · about {Math.round(estMb)} MB
              </span>
            </span>
          </div>
          <PrivacyLine>Made on this device. Nothing is uploaded.</PrivacyLine>
          <Button variant="ember" block className="h-14" onClick={start}>
            Export video
          </Button>
        </div>
      )}

      {state.kind === 'rendering' && (
        <div className="space-y-5 py-1">
          <div className="tabular text-[44px] leading-none font-extrabold tracking-[-0.03em]">{Math.round(state.progress * 100)}%</div>
          <Progress value={state.progress} />
          <p className="text-[15px] text-muted">Keep this tab open. A 30-second vlog takes about half a minute.</p>
          <Button variant="outline" block onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        </div>
      )}

      {state.kind === 'done' && (
        <div className="space-y-5">
          <video src={state.url} controls playsInline className="mx-auto block aspect-[9/16] w-[170px] rounded-[var(--radius-card)] bg-black object-cover shadow-cover" />
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(47_191_113/.14)] px-3 py-1.5 text-[14px] font-semibold text-success-soft">
              <CheckCircle2 className="size-4" strokeWidth={2.4} /> Ready · {formatBytes(state.result.blob.size)}
            </span>
          </div>
          {desktop ? (
            <div className="flex flex-col gap-2">
              <Button block onClick={download}>
                <Download className="size-[18px]" strokeWidth={2.4} /> Download video
              </Button>
              <Button block variant="outline" onClick={share}>
                <Share2 className="size-[18px]" strokeWidth={2.4} /> Share…
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button block onClick={share}>
                <Share2 className="size-[18px]" strokeWidth={2.4} /> Share
              </Button>
              <Button block variant="outline" onClick={download}>
                <Download className="size-[18px]" strokeWidth={2.4} /> Save to Photos
              </Button>
            </div>
          )}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="space-y-4">
          <p className="rounded-[var(--radius-card)] bg-danger-surface p-4 text-[15px] shadow-[inset_0_0_0_1px_rgb(255_79_79/.35)]">
            Export stopped at {Math.round(state.at * 100)}%. {state.message}
          </p>
          <Button block onClick={start}>
            Try again
          </Button>
        </div>
      )}
    </Sheet>
  )
}
