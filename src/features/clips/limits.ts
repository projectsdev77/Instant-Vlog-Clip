export const LIMITS = {
  maxClips: 30,
  maxTotalSec: 10 * 60,
  maxTotalBytes: 4 * 1024 ** 3,
}

export const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
export const ACCEPT_ATTR = 'video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.m4v,.webm'

export function isAcceptedFile(f: File): boolean {
  return ACCEPTED_TYPES.includes(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name)
}
