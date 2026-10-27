import { useRef, useState } from 'react'
import { FolderInput } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { useProject } from '@/store/projectStore'
import { ACCEPT_ATTR } from './limits'
import { relinkClips } from './relink'

/** Shown while a draft from the account is missing some of its clip videos on this device. */
export function MissingClipsBanner({ className }: { className?: string }) {
  const clips = useProject((s) => s.clips)
  const missing = clips.filter((c) => c.status === 'missing')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  if (!missing.length) return null

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const { matched, unmatched } = await relinkClips([...files])
      const left = useProject.getState().clips.filter((c) => c.status === 'missing').length
      if (matched) toast(left ? `Added ${matched}. ${left} still to add.` : 'All your clips are back.', 'success')
      if (unmatched.length) toast(`${unmatched.join(', ')} ${unmatched.length === 1 ? 'isn’t' : 'aren’t'} one of this vlog’s clips.`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[inset_0_0_0_1.5px_rgb(255_90_31/.45)]', className)}>
      <div className="min-w-0 flex-1 text-[14px]">
        <p className="font-semibold">
          {missing.length === 1 ? '1 clip isn’t on this device' : `${missing.length} clips aren’t on this device`}
        </p>
        <p className="text-muted">Your original clips stay on the device you added them on. Add {missing.length === 1 ? 'it' : 'them'} again to keep editing here: {missing.slice(0, 3).map((c) => c.fileName).join(', ')}{missing.length > 3 ? '…' : ''}</p>
      </div>
      <input ref={input} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => void add(e.target.files).then(() => (e.target.value = ''))} />
      <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner /> : <FolderInput className="size-4" strokeWidth={2.4} />} Add clips
      </Button>
    </div>
  )
}
