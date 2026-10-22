import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { pickFormat } from '@/render/export'

let check: Promise<string | null> | null = null

/** null when this browser can export the video, else why not (checked once). */
function exportProblem(): Promise<string | null> {
  check ??= pickFormat(1080, 1920).then(
    () => null,
    (e: Error) => e.message || 'This browser can’t export video.',
  )
  return check
}

/**
 * A warning shown early (Clips, Edit) when this browser can't save the video,
 * so nobody finds out only after editing.
 */
export function ExportSupportNotice({ className }: { className?: string }) {
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void exportProblem().then((p) => alive && setProblem(p))
    return () => {
      alive = false
    }
  }, [])
  if (!problem) return null
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-[var(--radius-card)] bg-[rgba(255,90,31,.10)] p-4 text-[14px] shadow-[inset_0_0_0_1px_rgba(255,122,61,.4)] ${className ?? ''}`}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ember-300" strokeWidth={2.4} />
      <p>
        <span className="font-semibold">This browser can’t save your vlog as a video.</span> You can still make and edit it here, but to export it, open this page in the latest Chrome, Edge or Safari on a computer or phone.
      </p>
    </div>
  )
}
