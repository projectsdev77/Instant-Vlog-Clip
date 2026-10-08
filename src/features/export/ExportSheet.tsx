import type { Timeline } from '@/domain/timeline'
import type { Project } from '@/domain/types'
import { Sheet } from '@/components/ui/Sheet'

export function ExportSheet({ onClose }: { project: Project; timeline: Timeline; onClose: () => void }) {
  return (
    <Sheet open title="Export" onClose={onClose}>
      <p className="text-sm text-muted">Coming next.</p>
    </Sheet>
  )
}
