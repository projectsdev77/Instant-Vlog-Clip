import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Sheet } from '@/components/ui/Sheet'
import type { Timeline } from '@/domain/timeline'
import type { Project } from '@/domain/types'
import { formatBytes, formatDuration } from '@/lib/format'
import { ExportCancelled, exportVideo, type ExportResult } from '@/render/export'
import { outputSize } from '@/render/styles'

type State = { kind: 'idle' } | { kind: 'running'; progress: number } | { kind: 'done'; result: ExportResult; url: string } | { kind: 'error'; message: string }

function fileName(project: Project, ext: string) {
  const base = (project.title || 'vlog').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vlog'
  return `${base}.${ext}`
}

export function ExportSheet({ project, timeline, onClose }: { project: Project; timeline: Timeline; onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const { width, height } = outputSize(project.settings.aspect, 1920)

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (state.kind !== 'done') return
    return () => URL.revokeObjectURL(state.url)
  }, [state])

  const start = async () => {
    abort.current = new AbortController()
    setState({ kind: 'running', progress: 0 })
    const started = performance.now()
    try {
      const result = await exportVideo(timeline, project, (progress) => setState({ kind: 'running', progress }), abort.current.signal)
      console.info(`Exported ${result.width}x${result.height} ${result.mime} in ${((performance.now() - started) / 1000).toFixed(1)}s`)
      setState({ kind: 'done', result, url: URL.createObjectURL(result.blob) })
    } catch (e) {
      if (e instanceof ExportCancelled) setState({ kind: 'idle' })
      else setState({ kind: 'error', message: (e as Error).message || 'Export failed.' })
    }
  }

  const close = () => {
    abort.current?.abort()
    onClose()
  }

  const share = async (r: ExportResult) => {
    const file = new File([r.blob], fileName(project, r.extension), { type: r.mime })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: project.title })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    download(r)
  }

  const download = (r: ExportResult) => {
    if (state.kind !== 'done') return
    const a = document.createElement('a')
    a.href = state.url
    a.download = fileName(project, r.extension)
    a.click()
  }

  return (
    <Sheet open title="Export your vlog" onClose={close}>
      {state.kind === 'idle' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {width}×{height} · {formatDuration(timeline.duration)} · made on this device, nothing is uploaded.
          </p>
          <Button block size="lg" onClick={start}>
            Export video
          </Button>
        </div>
      )}
      {state.kind === 'running' && (
        <div className="space-y-4 py-2">
          <Progress value={state.progress} />
          <p className="text-center text-sm text-muted">Rendering… {Math.round(state.progress * 100)}%. Keep this tab open.</p>
          <Button block variant="secondary" onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        </div>
      )}
      {state.kind === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-5" /> Ready · {formatBytes(state.result.blob.size)} {state.result.extension.toUpperCase()}
          </div>
          <video src={state.url} controls playsInline className="mx-auto max-h-[45vh] rounded-[var(--radius-control)] bg-black" />
          <div className="flex gap-2">
            <Button block size="lg" onClick={() => share(state.result)}>
              <Share2 className="size-4" /> Share
            </Button>
            <Button size="lg" variant="secondary" onClick={() => download(state.result)}>
              <Download className="size-4" /> Save
            </Button>
          </div>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="space-y-4">
          <p className="text-sm text-danger">{state.message}</p>
          <Button block onClick={start}>
            Try again
          </Button>
        </div>
      )}
    </Sheet>
  )
}
