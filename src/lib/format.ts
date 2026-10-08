export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatBytes(b: number): string {
  if (b < 1024 ** 2) return `${Math.round(b / 1024)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(0)} MB`
  return `${(b / 1024 ** 3).toFixed(1)} GB`
}

export function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  const day = 86400000
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
  if (diff < day) return `${Math.floor(diff / 3600000)} h ago`
  if (diff < 2 * day) return 'Yesterday'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
