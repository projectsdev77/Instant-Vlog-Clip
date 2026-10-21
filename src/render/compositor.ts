import type { Clip, Look } from '@/domain/types'
import { captionAt, FADE_IN_SEC, FADE_OUT_SEC, shotAt, transitionSec, type Timeline, type TimelineShot } from '@/domain/timeline'
import { shotLength, sourceTime } from '@/domain/shots'
import { applyCase, type TextStyle } from './styles'

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export type FrameSource = CanvasImageSource & { width?: number; height?: number }

/** Supplies the source image for a shot at a time inside its clip (seconds). */
export type FrameProvider = (ts: TimelineShot, srcTime: number) => FrameSource | null

function sourceSize(src: FrameSource): [number, number] {
  if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight]
  return [Number(src.width) || 0, Number(src.height) || 0]
}

const supportsFilter = (ctx: Ctx2D) => 'filter' in ctx

/** Gentle exposure correction so cuts between clips don't jump. */
function exposure(clip: Clip): number {
  const b = clip.signals?.brightness
  if (!b?.length) return 1
  const avg = b.reduce((a, x) => a + x, 0) / b.length
  const factor = Math.max(0.85, Math.min(1.3, 0.48 / Math.max(0.05, avg)))
  return Math.abs(factor - 1) < 0.04 ? 1 : factor
}

/** CSS filter part of a look (browsers without canvas filters get the overlay part only). */
function lookFilter(look: Look, clip: Clip): string {
  return lookCss(look, exposure(clip))
}

/** A look as a CSS filter string; also used for thumbnails in the editor. */
export function lookCss(look: Look, exposureFactor = 1): string {
  const i = look.intensity
  let bright = exposureFactor * (1 + look.brightness * 0.35)
  let contrast = 1 + look.contrast * 0.45
  let sat = 1 + look.saturation * 0.8
  let sepia = 0
  let hue = 0
  switch (look.filter) {
    case 'vivid':
      sat *= 1 + 0.35 * i
      contrast *= 1 + 0.08 * i
      break
    case 'warm':
      sepia = 0.12 * i
      sat *= 1 + 0.1 * i
      break
    case 'film':
      contrast *= 1 + 0.1 * i
      sat *= 1 - 0.18 * i
      sepia = 0.1 * i
      break
    case 'teal':
      contrast *= 1 + 0.1 * i
      sat *= 1 + 0.05 * i
      break
    case 'fade':
      contrast *= 1 - 0.15 * i
      sat *= 1 - 0.2 * i
      bright *= 1 + 0.04 * i
      break
    case 'mono':
      sat = 0
      contrast *= 1 + 0.12 * i
      break
    case 'cool':
      hue = -8 * i
      sat *= 1 + 0.05 * i
      break
  }
  const parts: string[] = []
  if (Math.abs(bright - 1) > 0.01) parts.push(`brightness(${bright.toFixed(3)})`)
  if (Math.abs(contrast - 1) > 0.01) parts.push(`contrast(${contrast.toFixed(3)})`)
  if (Math.abs(sat - 1) > 0.01) parts.push(`saturate(${Math.max(0, sat).toFixed(3)})`)
  if (sepia > 0.005) parts.push(`sepia(${sepia.toFixed(3)})`)
  if (Math.abs(hue) > 0.1) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`)
  return parts.join(' ') || 'none'
}

/** Tints, vignette and grain drawn on top with blend modes (work in every browser). */
function lookOverlays(ctx: Ctx2D, W: number, H: number, look: Look, t: number) {
  const i = look.intensity
  const tint = (op: GlobalCompositeOperation, color: string, alpha: number) => {
    if (alpha <= 0.003) return
    ctx.save()
    ctx.globalCompositeOperation = op
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }
  const filterless = !supportsFilter(ctx)
  if (look.filter === 'warm') tint('soft-light', '#ff9b45', 0.32 * i)
  if (look.filter === 'film') {
    tint('screen', '#1c1712', 0.5 * i)
    tint('soft-light', '#ffb36b', 0.18 * i)
  }
  if (look.filter === 'teal') {
    tint('soft-light', '#00a3b4', 0.3 * i)
    tint('overlay', '#ff8a3d', 0.08 * i)
  }
  if (look.filter === 'fade') {
    tint('screen', '#3a3632', 0.45 * i)
    tint('soft-light', '#ffd2b0', 0.12 * i)
  }
  if (look.filter === 'cool') tint('soft-light', '#4a8dff', 0.25 * i)
  if (look.filter === 'mono' && filterless) tint('saturation', '#808080', i)
  if (look.saturation < 0 && filterless) tint('saturation', '#808080', -look.saturation * 0.8)
  if (look.warmth > 0) tint('soft-light', '#ff9b45', look.warmth * 0.4)
  if (look.warmth < 0) tint('soft-light', '#4a8dff', -look.warmth * 0.4)
  if (look.vignette > 0.01) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${(0.75 * look.vignette).toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  if (look.grain > 0.01) {
    const n = noise()
    if (n) {
      ctx.save()
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = Math.min(1, look.grain * 0.5)
      const ox = Math.floor((Math.sin(t * 91.7) * 0.5 + 0.5) * 128)
      const oy = Math.floor((Math.cos(t * 57.3) * 0.5 + 0.5) * 128)
      const pattern = ctx.createPattern(n, 'repeat')
      if (pattern) {
        ctx.translate(-ox, -oy)
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, W + 128, H + 128)
      }
      ctx.restore()
    }
  }
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  return null
}

let noiseCanvas: OffscreenCanvas | HTMLCanvasElement | null | undefined
function noise() {
  if (noiseCanvas !== undefined) return noiseCanvas
  noiseCanvas = makeCanvas(128, 128)
  const c = noiseCanvas?.getContext('2d') as Ctx2D | null
  if (!c || !noiseCanvas) return (noiseCanvas = null)
  const img = c.createImageData(128, 128)
  let seed = 7
  for (let p = 0; p < img.data.length; p += 4) {
    seed = (seed * 16807) % 2147483647
    const v = 128 + ((seed % 160) - 80)
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v
    img.data[p + 3] = 255
  }
  c.putImageData(img, 0, 0)
  return noiseCanvas
}

let blurCanvas: OffscreenCanvas | HTMLCanvasElement | null = null
/** Draws `src` blurred and darkened over the whole frame (downscale-upscale blur works everywhere). */
function drawBlurredBackground(ctx: Ctx2D, src: FrameSource, W: number, H: number, sw: number, sh: number) {
  const bw = 24
  const bh = Math.max(8, Math.round((bw * H) / W))
  if (!blurCanvas || blurCanvas.width !== bw || blurCanvas.height !== bh) blurCanvas = makeCanvas(bw, bh)
  const b = blurCanvas?.getContext('2d') as Ctx2D | null
  if (!b || !blurCanvas) return
  const scale = Math.max(bw / sw, bh / sh)
  b.drawImage(src, (bw - sw * scale) / 2, (bh - sh * scale) / 2, sw * scale, sh * scale)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(blurCanvas, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
const easeOut = (x: number) => 1 - (1 - x) ** 3

/** Camera move for a shot `local` seconds in: scale, offset (fraction of frame) and rotation. */
function motionAt(motion: string | undefined, local: number, len: number) {
  const u = len > 0 ? Math.max(0, Math.min(1, local / len)) : 0
  switch (motion) {
    case 'zoomIn':
      return { s: 1 + 0.14 * ease(u), x: 0, y: 0, r: 0 }
    case 'zoomOut':
      return { s: 1.14 - 0.14 * ease(u), x: 0, y: 0, r: 0 }
    case 'panLeft':
      return { s: 1.14, x: 0.05 - 0.1 * ease(u), y: 0, r: 0 }
    case 'panRight':
      return { s: 1.14, x: -0.05 + 0.1 * ease(u), y: 0, r: 0 }
    case 'punch': {
      // snap in fast, settle a little, hold
      const hit = local < 0.12 ? easeOut(local / 0.12) * 0.2 : 0.2 - 0.08 * easeOut(Math.min(1, (local - 0.12) / 0.4))
      return { s: 1 + hit, x: 0, y: 0, r: 0 }
    }
    case 'shake': {
      const k = Math.max(0, 1 - local / 0.45)
      return { s: 1.06, x: Math.sin(local * 63) * 0.018 * k, y: Math.cos(local * 47) * 0.014 * k, r: Math.sin(local * 39) * 0.012 * k }
    }
    default:
      return { s: 1, x: 0, y: 0, r: 0 }
  }
}

type DrawOpts = { alpha?: number; scale?: number; dx?: number; dy?: number; blur?: number }

/** Draws a shot's frame with its crop, fit, camera move and color filter. */
function drawShotFrame(ctx: Ctx2D, src: FrameSource, W: number, H: number, ts: TimelineShot, local: number, look: Look, o: DrawOpts = {}) {
  const [sw, sh] = sourceSize(src)
  if (!sw || !sh) return
  const { shot, clip } = ts
  const m = motionAt(shot.motion, local, shotLength(shot))
  const fit = shot.fit ?? look.fit
  const mismatch = Math.abs(sw / sh - W / H) / (W / H) > 0.12
  ctx.save()
  ctx.globalAlpha = o.alpha ?? 1
  ctx.translate(W / 2 + (m.x + (o.dx ?? 0)) * W, H / 2 + (m.y + (o.dy ?? 0)) * H)
  if (m.r) ctx.rotate(m.r)
  const k = m.s * (o.scale ?? 1)
  ctx.scale(k, k)
  ctx.translate(-W / 2, -H / 2)
  const filters: string[] = []
  const f = lookFilter(look, clip)
  if (f !== 'none') filters.push(f)
  if (o.blur && o.blur > 0.3) filters.push(`blur(${o.blur.toFixed(1)}px)`)
  if (fit === 'blur' && mismatch) {
    drawBlurredBackground(ctx, src, W, H, sw, sh)
    if (filters.length && supportsFilter(ctx)) ctx.filter = filters.join(' ')
    const scale = Math.min(W / sw, H / sh) * shot.crop.zoom
    ctx.drawImage(src, (W - sw * scale) / 2, (H - sh * scale) / 2, sw * scale, sh * scale)
  } else {
    if (filters.length && supportsFilter(ctx)) ctx.filter = filters.join(' ')
    const scale = Math.max(W / sw, H / sh) * shot.crop.zoom
    const dw = sw * scale
    const dh = sh * scale
    // keep the focus point as centered as the frame edges allow
    const dx = Math.min(0, Math.max(W - dw, W / 2 - shot.crop.focusX * dw))
    const dy = Math.min(0, Math.max(H - dh, H / 2 - shot.crop.focusY * dh))
    ctx.drawImage(src, dx, dy, dw, dh)
  }
  ctx.restore()
}

/** Returns true when the main shot's image was available. */
export function drawFrame(ctx: Ctx2D, W: number, H: number, t: number, tl: Timeline, frame: FrameProvider, style: TextStyle): boolean {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const ts = shotAt(tl, t)
  let drewMain = false
  const look = tl.look
  if (ts) {
    const local = t - ts.start
    const draw = (s: TimelineShot, shotLocal: number, o?: DrawOpts) => {
      const img = frame(s, Math.max(0, Math.min(sourceTime(s.shot, shotLocal), s.clip.durationSec - 0.02)))
      if (img) drawShotFrame(ctx, img, W, H, s, shotLocal, look, o)
      if (img && s === ts) drewMain = true
    }
    const tr = ts.shot.transitionIn
    const dur = transitionSec(tr)
    const prev = ts.prev
    if (prev && dur > 0 && local < dur) {
      const p = ease(local / dur)
      const prevLocal = shotLength(prev.shot) + local
      const blurPx = W * 0.02
      switch (tr) {
        case 'crossfade':
          draw(prev, prevLocal)
          draw(ts, local, { alpha: p })
          break
        case 'dip':
          if (p < 0.5) draw(prev, prevLocal)
          else draw(ts, local)
          ctx.fillStyle = `rgba(0,0,0,${1 - Math.abs(p - 0.5) * 2})`
          ctx.fillRect(0, 0, W, H)
          break
        case 'whip':
          // fast horizontal pan with motion blur
          draw(prev, prevLocal, { dx: -p, blur: Math.sin(p * Math.PI) * blurPx * 1.5 })
          draw(ts, local, { dx: 1 - p, blur: Math.sin(p * Math.PI) * blurPx * 1.5 })
          break
        case 'slide':
          draw(prev, prevLocal, { dy: -p })
          draw(ts, local, { dy: 1 - p })
          break
        case 'zoom':
          // push into the old shot, land on the new one
          draw(prev, prevLocal, { scale: 1 + 0.6 * p, blur: p * blurPx })
          draw(ts, local, { alpha: Math.min(1, p * 1.6), scale: 1.3 - 0.3 * p, blur: (1 - p) * blurPx })
          break
        case 'flash':
          if (p < 0.5) draw(prev, prevLocal)
          else draw(ts, local)
          break
        case 'blur':
          draw(prev, prevLocal, { blur: Math.sin(p * Math.PI) * blurPx * 1.4 })
          draw(ts, local, { alpha: p, blur: Math.sin(p * Math.PI) * blurPx * 1.4 })
          break
        default:
          draw(ts, local)
      }
    } else {
      draw(ts, local)
    }
    lookOverlays(ctx, W, H, look, t)
    if (look.letterbox) {
      // ~2.39:1 bars on wide video; slimmer bars on tall video so the subject keeps the frame
      const bar = W >= H ? Math.max(0, (H - W / 2.39) / 2) : H * 0.09
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, bar)
      ctx.fillRect(0, H - bar, W, bar)
    }
    if (prev && tr === 'flash' && local < dur) {
      const a = 1 - Math.abs(local / dur - 0.5) * 2
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a) ** 0.7})`
      ctx.fillRect(0, 0, W, H)
    }
  }
  drawOverlays(ctx, W, H, t, tl, style)
  // fade from / to black
  let black = 0
  if (tl.fades.in && t < FADE_IN_SEC) black = 1 - t / FADE_IN_SEC
  if (tl.fades.out && t > tl.duration - FADE_OUT_SEC) black = Math.max(black, (t - (tl.duration - FADE_OUT_SEC)) / FADE_OUT_SEC)
  if (black > 0.001) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, black).toFixed(3)})`
    ctx.fillRect(0, 0, W, H)
  }
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

/** Text with the preset's legibility treatment (outline glow) but no box. */
function legibleText(ctx: Ctx2D, text: string, x: number, y: number, style: TextStyle, color: string, px: number) {
  const o = style.outline
  if (o) {
    ctx.save()
    ctx.shadowColor = o.color
    ctx.shadowBlur = px * (o.blur / 48)
    ctx.shadowOffsetY = px * 0.04
    ctx.lineJoin = 'round'
    ctx.strokeStyle = o.color
    ctx.lineWidth = px * (o.strength === 'heavy' ? 0.16 : o.strength === 'normal' ? 0.1 : 0)
    if (ctx.lineWidth > 0) ctx.strokeText(text, x, y)
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
    ctx.restore()
    return
  }
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

function boxBehind(ctx: Ctx2D, style: TextStyle, x: number, centerY: number, width: number, px: number) {
  if (!style.box) return
  const padX = px * 0.42
  const padY = px * 0.12
  ctx.fillStyle = style.box
  roundRect(ctx, x - padX, centerY - px * 0.62 - padY, width + padX * 2, px * 1.24 + padY * 2, px * 0.35)
}

export function drawOverlays(ctx: Ctx2D, W: number, H: number, t: number, tl: Timeline, style: TextStyle) {
  const unit = Math.min(W, H)
  const vertical = H > W
  const textOnBox = style.box ? style.captionColor : '#ffffff'

  // Title: big, top of frame (centred at 15%), fades in and out.
  if (tl.title.text && t < tl.title.until) {
    const fadeIn = Math.min(1, t / 0.25)
    const fadeOut = Math.min(1, (tl.title.until - t) / 0.35)
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut))
    const px = W * 0.1
    setFont(ctx, style, px)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const lines = wrap(ctx, applyCase(tl.title.text, style.titleCase), W * 0.84).slice(0, 3)
    const lineH = px * 1.08
    const top = H * 0.15 - ((lines.length - 1) * lineH) / 2
    lines.forEach((line, i) => {
      const w = ctx.measureText(line).width
      const x = (W - w) / 2
      const y = top + i * lineH
      boxBehind(ctx, style, x, y, w, px)
      legibleText(ctx, line, x, y, style, textOnBox, px)
    })
    ctx.globalAlpha = 1
  }

  // Extra on-screen label for the scene, if any.
  const scene = tl.scenes.find((s) => t >= s.start && t < s.end)
  if (scene?.onScreenText) {
    const px = unit * 0.05
    setFont(ctx, style, px, 700)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const w = ctx.measureText(scene.onScreenText).width
    boxBehind(ctx, style, (W - w) / 2, H * 0.3, w, px)
    legibleText(ctx, scene.onScreenText, (W - w) / 2, H * 0.3, style, textOnBox, px)
  }

  // Captions: centred at 70%, current word highlighted, inside 84% of the width.
  const chunk = captionAt(tl, t)
  if (chunk) {
    const px = W * (vertical ? 0.072 : 0.045)
    setFont(ctx, style, px)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const words = chunk.words.map((w) => applyCase(w.word, style.captionCase))
    const space = ctx.measureText(' ').width
    const widths = words.map((w) => ctx.measureText(w).width)
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
    const lineH = px * (style.box ? 1.5 : 1.25)
    rows.forEach((row, r) => {
      const total = row.reduce((a, i, k) => a + widths[i] + (k ? space : 0), 0)
      let x = (W - total) / 2
      const y = baseY + (r - (rows.length - 1) / 2) * lineH
      boxBehind(ctx, style, x, y, total, px)
      for (const i of row) {
        const w = chunk.words[i]
        const active = t >= w.start && t < w.end + 0.05
        legibleText(ctx, words[i], x, y, style, active ? style.highlightColor : textOnBox, px)
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
