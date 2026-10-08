import type { Clip } from '@/domain/types'
import { captionAt, shotAt, TRANSITION_SEC, type Timeline, type TimelineShot } from '@/domain/timeline'
import type { TextStyle } from './styles'

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export type FrameSource = CanvasImageSource & { width?: number; height?: number }

/** Supplies the source image for a shot at a time inside its clip (seconds). */
export type FrameProvider = (ts: TimelineShot, srcTime: number) => FrameSource | null

function sourceSize(src: FrameSource): [number, number] {
  if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight]
  return [Number(src.width) || 0, Number(src.height) || 0]
}

/** Gentle exposure correction so cuts between clips don't jump. */
function exposureFilter(clip: Clip): string {
  const b = clip.signals?.brightness
  if (!b?.length) return 'none'
  const avg = b.reduce((a, x) => a + x, 0) / b.length
  const factor = Math.max(0.85, Math.min(1.3, 0.48 / Math.max(0.05, avg)))
  return Math.abs(factor - 1) < 0.04 ? 'none' : `brightness(${factor.toFixed(2)})`
}

/** Draws `src` covering the canvas, cropped around the shot's focus point. */
function drawCover(ctx: Ctx2D, src: FrameSource, W: number, H: number, focusX: number, focusY: number, zoom: number, clip: Clip) {
  const [sw, sh] = sourceSize(src)
  if (!sw || !sh) return
  const scale = Math.max(W / sw, H / sh) * zoom
  const dw = sw * scale
  const dh = sh * scale
  // keep the focus point as centered as the frame edges allow
  const dx = Math.min(0, Math.max(W - dw, W / 2 - focusX * dw))
  const dy = Math.min(0, Math.max(H - dh, H / 2 - focusY * dh))
  const filter = exposureFilter(clip)
  if (filter !== 'none' && 'filter' in ctx) ctx.filter = filter
  ctx.drawImage(src, dx, dy, dw, dh)
  if ('filter' in ctx) ctx.filter = 'none'
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)

/** Returns true when the main shot's image was available. */
export function drawFrame(ctx: Ctx2D, W: number, H: number, t: number, tl: Timeline, frame: FrameProvider, style: TextStyle): boolean {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const ts = shotAt(tl, t)
  let drewMain = false
  if (ts) {
    const local = t - ts.start
    const drawShot = (s: TimelineShot, srcTime: number) => {
      const img = frame(s, Math.min(srcTime, s.clip.durationSec - 0.02))
      if (img) drawCover(ctx, img, W, H, s.shot.crop.focusX, s.shot.crop.focusY, s.shot.crop.zoom, s.clip)
      if (img && s === ts) drewMain = true
    }
    const tr = ts.shot.transitionIn
    const inTransition = local < TRANSITION_SEC && ts.prev && tr !== 'cut'
    if (inTransition && ts.prev) {
      const p = ease(local / TRANSITION_SEC)
      const prevSrc = ts.prev.shot.out + local
      if (tr === 'crossfade') {
        drawShot(ts.prev, prevSrc)
        ctx.globalAlpha = p
        drawShot(ts, ts.shot.in + local)
        ctx.globalAlpha = 1
      } else if (tr === 'dip') {
        if (p < 0.5) drawShot(ts.prev, prevSrc)
        else drawShot(ts, ts.shot.in + local)
        ctx.fillStyle = `rgba(0,0,0,${1 - Math.abs(p - 0.5) * 2})`
        ctx.fillRect(0, 0, W, H)
      } else {
        // whip: slide the new shot in from the right
        ctx.save()
        ctx.translate(-W * p, 0)
        drawShot(ts.prev, prevSrc)
        ctx.translate(W, 0)
        drawShot(ts, ts.shot.in + local)
        ctx.restore()
      }
    } else {
      drawShot(ts, ts.shot.in + local)
    }
  }
  drawOverlays(ctx, W, H, t, tl, style)
  return drewMain
}

function setFont(ctx: Ctx2D, style: TextStyle, px: number, weight = style.weight) {
  ctx.font = `${weight} ${Math.round(px)}px ${style.font}`
}

function wrap(ctx: Ctx2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

function strokedText(ctx: Ctx2D, text: string, x: number, y: number, style: TextStyle, color: string, px: number) {
  if (style.stroke !== 'rgba(0,0,0,0)') {
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, px * 0.14)
    ctx.strokeStyle = style.stroke
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

export function drawOverlays(ctx: Ctx2D, W: number, H: number, t: number, tl: Timeline, style: TextStyle) {
  const unit = Math.min(W, H)
  const vertical = H > W

  // Title: big, top of frame, fades in and out.
  if (tl.title.text && t < tl.title.until) {
    const fadeIn = Math.min(1, t / 0.25)
    const fadeOut = Math.min(1, (tl.title.until - t) / 0.35)
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut))
    const px = unit * 0.1
    setFont(ctx, style, px)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const text = style.uppercaseTitle ? tl.title.text.toUpperCase() : tl.title.text
    const lines = wrap(ctx, text, W * 0.86)
    const top = H * (vertical ? 0.15 : 0.16)
    lines.forEach((line, i) => strokedText(ctx, line, W / 2, top + i * px * 1.1, style, style.titleColor, px))
    ctx.globalAlpha = 1
  }

  // Extra on-screen label for the scene, if any.
  const scene = tl.scenes.find((s) => t >= s.start && t < s.end)
  if (scene?.onScreenText) {
    const px = unit * 0.05
    setFont(ctx, style, px, 700)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    strokedText(ctx, scene.onScreenText, W / 2, H * (vertical ? 0.3 : 0.3), style, '#fff', px)
  }

  // Captions: lower third, current word highlighted. Kept above the area social apps cover.
  const chunk = captionAt(tl, t)
  if (chunk) {
    const px = unit * (vertical ? 0.072 : 0.06)
    setFont(ctx, style, px)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const words = chunk.words.map((w) => (style.uppercaseCaptions ? w.word.toUpperCase() : w.word))
    const space = ctx.measureText(' ').width
    const widths = words.map((w) => ctx.measureText(w).width)
    // wrap words onto rows that fit
    const maxW = W * 0.84
    const rows: number[][] = [[]]
    let rowW = 0
    words.forEach((_, i) => {
      const add = (rows[rows.length - 1].length ? space : 0) + widths[i]
      if (rowW + add > maxW && rows[rows.length - 1].length) {
        rows.push([i])
        rowW = widths[i]
      } else {
        rows[rows.length - 1].push(i)
        rowW += add
      }
    })
    const baseY = H * (vertical ? 0.7 : 0.8)
    const lineH = px * 1.25
    rows.forEach((row, r) => {
      const total = row.reduce((a, i, k) => a + widths[i] + (k ? space : 0), 0)
      let x = (W - total) / 2
      const y = baseY + (r - (rows.length - 1) / 2) * lineH
      if (style.box) {
        ctx.fillStyle = style.box
        const padX = px * 0.35
        const padY = px * 0.18
        roundRect(ctx, x - padX, y - px / 2 - padY, total + padX * 2, px + padY * 2, px * 0.25)
      }
      for (const i of row) {
        const w = chunk.words[i]
        const active = t >= w.start && t < w.end + 0.05
        strokedText(ctx, words[i], x, y, style, active ? style.highlightColor : style.captionColor, px)
        x += widths[i] + space
      }
    })
  }
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}
