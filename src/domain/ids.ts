export function uid(prefix = ''): string {
  const rand = crypto.getRandomValues(new Uint32Array(2))
  return prefix + Date.now().toString(36) + rand[0].toString(36) + rand[1].toString(36).slice(0, 4)
}

/** FNV-1a, enough to detect "this audio was made for different text". */
export function textHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
