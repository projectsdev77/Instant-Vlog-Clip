import { toast } from '@/components/ui/Toast'
import { TEMPLATES } from '@/domain/templates'
import { DEFAULT_LOOK, type Clip, type EditPlan, type FilterId, type Look, type Project } from '@/domain/types'
import { cn } from '@/lib/cn'
import { lookCss } from '@/render/compositor'
import { applyTemplate, setFades, setLook } from './editActions'
import { Fold, OptionCard, Row, Section, Segmented, Slider } from './ui'

export const FILTER_OPTIONS: { id: FilterId; label: string }[] = [
  { id: 'none', label: 'Original' },
  { id: 'warm', label: 'Warm' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'film', label: 'Film' },
  { id: 'teal', label: 'Teal & orange' },
  { id: 'fade', label: 'Faded' },
  { id: 'cool', label: 'Cool' },
  { id: 'mono', label: 'B&W' },
]

/** Approximate tint for thumbnails (the video adds blend-mode tints on top of the CSS filter). */
const TINT: Partial<Record<FilterId, string>> = { warm: 'rgba(255,155,69,.18)', film: 'rgba(60,45,30,.22)', teal: 'rgba(0,163,180,.16)', fade: 'rgba(90,85,80,.28)', cool: 'rgba(74,141,255,.15)' }

const run = (p: Promise<unknown>) => void p.catch((e: Error) => toast(e.message, 'error'))

const ADJUST: { key: 'brightness' | 'contrast' | 'saturation' | 'warmth' | 'vignette' | 'grain'; label: string; min: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -1 },
  { key: 'contrast', label: 'Contrast', min: -1 },
  { key: 'saturation', label: 'Saturation', min: -1 },
  { key: 'warmth', label: 'Warmth', min: -1 },
  { key: 'vignette', label: 'Vignette', min: 0 },
  { key: 'grain', label: 'Grain', min: 0 },
]

/** "Colour as shot · Fill (crop) · fade in, fade out" */
function fineTuneSummary(look: Look, fades: { in: boolean; out: boolean }): string {
  const changed = ADJUST.some((a) => Math.abs(look[a.key]) > 0.001)
  const edges = [fades.in && 'fade in', fades.out && 'fade out', look.letterbox && 'letterbox'].filter(Boolean).join(', ')
  return [changed ? 'Colour adjusted' : 'Colour as shot', look.fit === 'blur' ? 'Fit, blurred edges' : 'Fill (crop)', edges].filter(Boolean).join(' · ')
}

/**
 * Template, filter and fine-tuning for the whole vlog. Thumbnails show the
 * current scene with each look applied.
 */
export function LookPanel({ project, plan, clips, sceneClip }: { project: Project; plan: EditPlan; clips: Clip[]; sceneClip?: Clip }) {
  const look = plan.look ?? DEFAULT_LOOK
  const fades = plan.fades ?? { in: false, out: false }
  const sample = sceneClip?.thumbnail ?? clips.find((c) => c.thumbnail)?.thumbnail
  const current = plan.templateId ?? (project.settings.template !== 'auto' ? project.settings.template : undefined)
  return (
    <div>
      <Section title="Template" helper="Sets cuts, camera moves and colour for the whole vlog. Your footage stays the same.">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <OptionCard selected={current === t.id} onClick={() => run(applyTemplate(t.id))} label={`${t.name} template`}>
                <span className="relative block h-[76px] overflow-hidden bg-surface">
                  {sample && <img src={sample} alt="" className="size-full object-cover" style={{ filter: lookCss(t.look) }} />}
                  {TINT[t.look.filter] && <span className="absolute inset-0" style={{ background: TINT[t.look.filter], mixBlendMode: 'soft-light' }} />}
                  {t.look.vignette > 0 && <span className="absolute inset-0 bg-[radial-gradient(circle,transparent_45%,rgba(0,0,0,.55))]" />}
                </span>
                <span className="block px-3 pt-2.5 pb-3">
                  <span className="block text-[14px] font-bold">{t.name}</span>
                  <span className="block truncate text-[12px] text-muted">{t.description}</span>
                </span>
              </OptionCard>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Filter">
        <ul className="-mx-1 flex gap-2.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
          {FILTER_OPTIONS.map((f) => {
            const selected = look.filter === f.id
            const l: Look = { ...DEFAULT_LOOK, filter: f.id }
            return (
              <li key={f.id} className="shrink-0">
                <button type="button" aria-pressed={selected} onClick={() => run(setLook({ filter: f.id, intensity: f.id === look.filter ? look.intensity : 0.8 }))} className="w-[60px] text-center">
                  <span className={cn('relative block h-20 overflow-hidden rounded-[12px] bg-surface-2', selected && 'shadow-[0_0_0_2px_#ff5a1f]')}>
                    {sample && <img src={sample} alt="" className="size-full object-cover" style={{ filter: lookCss(l) }} />}
                    {TINT[f.id] && <span className="absolute inset-0" style={{ background: TINT[f.id], mixBlendMode: 'soft-light' }} />}
                  </span>
                  <span className={cn('mt-1.5 block truncate text-[12px]', selected ? 'font-bold text-fg' : 'font-medium text-muted')}>{f.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {look.filter !== 'none' && <Slider label="Strength" value={Math.round(look.intensity * 100)} min={0} max={100} step={5} onChange={(v) => run(setLook({ intensity: v / 100 }, true))} />}
      </Section>

      <Fold title="Fine-tune" summary={fineTuneSummary(look, fades)}>
        <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
          {ADJUST.map((a) => (
            <Slider key={a.key} label={a.label} value={Math.round(look[a.key] * (a.min < 0 ? 50 : 100))} min={a.min < 0 ? -50 : 0} max={a.min < 0 ? 50 : 100} onChange={(v) => run(setLook({ [a.key]: v / (a.min < 0 ? 50 : 100) }, true))} />
          ))}
        </div>
        <Row label="Frame">
          <Segmented
            label="Frame"
            options={[
              { value: 'fill', label: 'Fill (crop)' },
              { value: 'blur', label: 'Fit, blurred edges' },
            ]}
            value={look.fit}
            onChange={(fit) => run(setLook({ fit }))}
          />
        </Row>
        <Row label="Edges">
          <div className="flex flex-wrap gap-2">
            <Check on={fades.in} onClick={() => run(setFades({ ...fades, in: !fades.in }))}>
              Fade in
            </Check>
            <Check on={fades.out} onClick={() => run(setFades({ ...fades, out: !fades.out }))}>
              Fade out
            </Check>
            <Check on={!!look.letterbox} onClick={() => run(setLook({ letterbox: !look.letterbox }))}>
              Letterbox
            </Check>
          </div>
        </Row>
      </Fold>
    </div>
  )
}

/** A checkbox chip. */
function Check({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className={cn('flex h-10 items-center gap-2 rounded-full px-4 text-[14px] transition', on ? 'bg-white font-bold text-ink' : 'bg-surface-2 font-medium text-white/72 hover:text-fg')}>
      <span className={cn('grid size-4 place-items-center rounded-[5px] text-[11px]', on ? 'bg-accent text-white' : 'shadow-[inset_0_0_0_1.5px_rgb(255_255_255/.4)]')} aria-hidden>
        {on && '✓'}
      </span>
      {children}
    </button>
  )
}
