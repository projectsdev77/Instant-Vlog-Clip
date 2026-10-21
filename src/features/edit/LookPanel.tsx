import { Check } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { TEMPLATES, type EditTemplate } from '@/domain/templates'
import { DEFAULT_LOOK, type Clip, type EditPlan, type FilterId, type Look, type Project } from '@/domain/types'
import { cn } from '@/lib/cn'
import { lookCss } from '@/render/compositor'
import { applyTemplate, setFades, setLook } from './editActions'

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

export function LookPanel({ project, plan, clips }: { project: Project; plan: EditPlan; clips: Clip[] }) {
  const look = plan.look ?? DEFAULT_LOOK
  const fades = plan.fades ?? { in: false, out: false }
  const sample = clips.find((c) => c.thumbnail)?.thumbnail
  const current = plan.templateId ?? (project.settings.template !== 'auto' ? project.settings.template : undefined)
  return (
    <div className="space-y-7">
      <section className="space-y-2.5">
        <h3 className="text-[15px] font-semibold">Template</h3>
        <p className="text-[13px] font-medium text-faint">Restyles transitions, camera moves, speed, color and captions. Your footage stays.</p>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <TemplateCard t={t} image={sample} selected={current === t.id} onClick={() => run(applyTemplate(t.id))} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2.5">
        <h3 className="text-[15px] font-semibold">Filter</h3>
        <ul className="flex gap-2.5 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((f) => {
            const selected = look.filter === f.id
            const l: Look = { ...DEFAULT_LOOK, filter: f.id }
            return (
              <li key={f.id} className="shrink-0">
                <button type="button" aria-pressed={selected} onClick={() => run(setLook({ filter: f.id, intensity: f.id === look.filter ? look.intensity : 0.8 }))} className="w-[76px] text-center">
                  <span className={cn('relative block aspect-[3/4] overflow-hidden rounded-[var(--radius-thumb)] bg-surface-2', selected && 'shadow-[0_0_0_2px_#ff5a1f]')}>
                    {sample && <img src={sample} alt="" className="size-full object-cover" style={{ filter: lookCss(l) }} />}
                    {TINT[f.id] && <span className="absolute inset-0" style={{ background: TINT[f.id], mixBlendMode: 'soft-light' }} />}
                  </span>
                  <span className={cn('mt-1.5 block truncate text-[12px] font-semibold', selected ? 'text-fg' : 'text-muted')}>{f.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {look.filter !== 'none' && <Adjust label="Strength" value={look.intensity} min={0} max={1} onChange={(v) => run(setLook({ intensity: v }, true))} />}
      </section>

      <section className="space-y-2">
        <h3 className="text-[15px] font-semibold">Adjust</h3>
        <Adjust label="Brightness" value={look.brightness} onChange={(v) => run(setLook({ brightness: v }, true))} />
        <Adjust label="Contrast" value={look.contrast} onChange={(v) => run(setLook({ contrast: v }, true))} />
        <Adjust label="Saturation" value={look.saturation} onChange={(v) => run(setLook({ saturation: v }, true))} />
        <Adjust label="Warmth" value={look.warmth} onChange={(v) => run(setLook({ warmth: v }, true))} />
        <Adjust label="Vignette" value={look.vignette} min={0} max={1} onChange={(v) => run(setLook({ vignette: v }, true))} />
        <Adjust label="Grain" value={look.grain} min={0} max={1} onChange={(v) => run(setLook({ grain: v }, true))} />
      </section>

      <section className="space-y-2.5">
        <h3 className="text-[15px] font-semibold">Frame</h3>
        <div className="flex flex-wrap gap-2">
          <Pill on={look.fit === 'fill'} onClick={() => run(setLook({ fit: 'fill' }))}>
            Fill (crop to fit)
          </Pill>
          <Pill on={look.fit === 'blur'} onClick={() => run(setLook({ fit: 'blur' }))}>
            Whole clip, blurred background
          </Pill>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Pill on={fades.in} onClick={() => run(setFades({ ...fades, in: !fades.in }))}>
            Fade in
          </Pill>
          <Pill on={fades.out} onClick={() => run(setFades({ ...fades, out: !fades.out }))}>
            Fade out
          </Pill>
          <Pill on={!!look.letterbox} onClick={() => run(setLook({ letterbox: !look.letterbox }))}>
            Letterbox bars
          </Pill>
        </div>
      </section>
    </div>
  )
}

function TemplateCard({ t, image, selected, onClick }: { t: EditTemplate; image?: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn('w-full overflow-hidden rounded-[var(--radius-card)] bg-surface text-left transition', selected ? 'shadow-[inset_0_0_0_1.5px_#ff5a1f,0_0_0_1.5px_#ff5a1f]' : 'hover:bg-[#1a1918]')}>
      <span className="relative block h-[72px] overflow-hidden bg-surface-2">
        {image && <img src={image} alt="" className="size-full object-cover" style={{ filter: lookCss(t.look) }} />}
        {TINT[t.look.filter] && <span className="absolute inset-0" style={{ background: TINT[t.look.filter], mixBlendMode: 'soft-light' }} />}
        {t.look.vignette > 0 && <span className="absolute inset-0 bg-[radial-gradient(circle,transparent_45%,rgba(0,0,0,.55))]" />}
      </span>
      <span className="flex items-center gap-2 p-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{t.name}</span>
          <span className="block truncate text-[12px] text-muted">{t.description}</span>
        </span>
        {selected && <Check className="size-4 shrink-0 text-accent" strokeWidth={3} />}
      </span>
    </button>
  )
}

function Adjust({ label, value, min = -1, max = 1, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-1.5 text-[14px]">
      <span className="w-24 shrink-0 font-semibold">{label}</span>
      <input type="range" min={min * 100} max={max * 100} step={5} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} onDoubleClick={() => onChange(min < 0 ? 0 : value)} className="h-9 flex-1" aria-label={label} />
      <span className="tabular w-10 text-right text-[13px] text-muted">{Math.round(value * 100)}</span>
    </label>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('h-10 rounded-full px-4 text-[14px] font-semibold transition', on ? 'bg-white text-ink' : 'bg-surface text-muted hover:text-fg')}>
      {children}
    </button>
  )
}
