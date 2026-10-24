import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Music2, Upload, VolumeX } from 'lucide-react'
import { useVoiceList } from '@/ai/voices'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toast'
import { OWN_MUSIC, type Clip, type Project, type VoiceMode } from '@/domain/types'
import { stepPath } from '@/features/project/steps'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/format'
import { addOwnMusic, removeOwnMusic, setOwnMusicStart } from '@/pipeline/ownMusic'
import { TRACKS } from '@/render/musicTracks'
import { applyCase, STYLES, type TextStyle } from '@/render/styles'
import { currentEdit, useProject } from '@/store/projectStore'
import { changeVoice, setTitleShow, setVoiceMode } from './editActions'
import { Avatar, Fold, OptionCard, PickRow, PreviewButton, Row, Section, Segmented, Slider } from './ui'
import { usePreview } from './usePreview'

export type PanelId = 'scene' | 'look' | 'voice' | 'music' | 'style'

export function Thumb({ clip, className }: { clip?: Clip; className?: string }) {
  return <span className={cn('block aspect-[9/16] shrink-0 overflow-hidden bg-surface-2', className)}>{clip?.thumbnail && <img src={clip.thumbnail} alt="" className="size-full object-cover" />}</span>
}

const VOICE_MODES: { value: VoiceMode; label: string }[] = [
  { value: 'ai', label: 'AI voice' },
  { value: 'recorded', label: 'My own voice' },
  { value: 'none', label: 'No voiceover' },
]

/** What changes when the narration switches, in plain words. */
function switchEffects(from: VoiceMode, to: VoiceMode, takes: number): string[] {
  const kept = from === 'recorded' && takes ? [`Your ${takes} recorded take${takes === 1 ? ' is' : 's are'} kept. Switch back to My own voice to use ${takes === 1 ? 'it' : 'them'} again.`] : []
  if (to === 'ai') return ['An AI voice reads your lines; captions follow its voice.', 'Each scene re-fits to how long its line takes to say, so the timing can change.', ...kept]
  if (to === 'none') return ['No voice: your lines show as captions, timed to reading speed.', 'Scenes re-fit to that, so the timing can change.', ...kept]
  return [
    'You record over the video on the Record page, in one take or many.',
    'Captions come from what you say, so there are none until you record.',
    'The scene timing stays as it is now.',
    ...(takes ? [`Your ${takes} earlier take${takes === 1 ? ' is' : 's are'} still there.`] : []),
  ]
}

export function VoicePanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const voices = useVoiceList()
  const preview = usePreview()
  const mode = project.voice.mode
  const lines = project.script?.lines.filter((l) => l.text.trim()) ?? []
  const takes = project.voiceTrack?.takes.length ?? 0
  const sample = lines[0]?.text ?? 'So here’s my day.'

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  // A switch is explained first, then confirmed.
  const [asking, setAsking] = useState<VoiceMode | null>(null)
  const confirmSwitch = (m: VoiceMode) => {
    setAsking(null)
    void run(m, async () => {
      await setVoiceMode(m)
      if (m === 'recorded') navigate(stepPath(project.id, 'record'))
    })
  }

  return (
    <div>
      <Section>
        <Segmented
          label="Voiceover"
          options={VOICE_MODES.map((v) => ({ ...v, label: v.value === 'ai' && !lines.length ? 'AI voice' : v.label }))}
          value={asking ?? mode}
          disabled={!!busy}
          onChange={(m) => {
            if (m === 'ai' && !lines.length) return toast('Add lines in the Script step (or in a scene) for the AI voice to read.', 'info')
            setAsking(m === mode ? null : m)
          }}
        />
        {asking && (
          <div className="space-y-3 rounded-[18px] bg-surface-2 p-4" role="alertdialog" aria-label={`Switch to ${VOICE_MODES.find((v) => v.value === asking)?.label}`}>
            <p className="text-[15px] font-semibold">Switch to {VOICE_MODES.find((v) => v.value === asking)?.label.toLowerCase()}?</p>
            <ul className="list-disc space-y-1 pl-5 text-[14px] text-muted">
              {switchEffects(mode, asking, takes).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" onClick={() => confirmSwitch(asking)} className="h-10 rounded-full bg-white px-4 text-[14px] font-bold text-ink">
                Switch
              </button>
              <button type="button" onClick={() => setAsking(null)} className="h-10 rounded-full px-4 text-[14px] font-semibold text-muted hover:text-fg">
                Cancel
              </button>
            </div>
          </div>
        )}
        {busy && busy !== 'level' && (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Spinner className="size-3.5" /> Updating the voice…
          </p>
        )}
      </Section>

      {mode === 'ai' && (
        <Section>
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {voices.map((v) => {
              const selected = project.voice.voiceId === v.id
              return (
                <li key={v.id}>
                  <PickRow
                    selected={selected}
                    disabled={!!busy}
                    onClick={() => !selected && void run(v.id, () => changeVoice(v.id))}
                    leading={<Avatar letter={v.name[0]} on={selected} />}
                    title={
                      <>
                        {v.name} {v.accent && <span className="text-[12px] font-semibold text-faint">{v.accent}</span>}
                      </>
                    }
                    sub={v.description}
                    trailing={<PreviewButton label={v.name} playing={preview.playing === `voice:${v.id}`} loading={preview.loading === `voice:${v.id}`} onClick={() => void preview.voice(v.id, sample, project.settings.language)} />}
                  />
                </li>
              )
            })}
          </ul>
          <VoiceLevel project={project} onChange={(volumeDb) => updateProject((p) => ({ voice: { ...p.voice, volumeDb } }))} />
        </Section>
      )}

      {mode === 'recorded' && (
        <Section>
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-[14px] text-muted">
              {takes ? `Your own voice: ${takes} take${takes === 1 ? '' : 's'}. Re-record, move or trim them in the voice studio.` : 'Nothing recorded yet. Open the studio and talk over your vlog.'}
            </p>
            <Link to={stepPath(project.id, 'record')} className="flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-bold text-ink">
              Open voice studio
            </Link>
          </div>
          <VoiceLevel project={project} onChange={(volumeDb) => updateProject((p) => ({ voice: { ...p.voice, volumeDb } }))} />
        </Section>
      )}

      {mode === 'none' && (
        <Section>
          <p className="text-[14px] text-muted">Nothing is read aloud. Your lines stay on screen as captions, over the music.</p>
        </Section>
      )}
    </div>
  )
}

function VoiceLevel({ project, onChange }: { project: Project; onChange: (db: number) => void }) {
  return <Slider label="Voice level" value={project.voice.volumeDb} min={-12} max={6} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={onChange} />
}

export function MusicPanel({ project }: { project: Project }) {
  const { updateProject } = useProject()
  const preview = usePreview()
  const options = [...TRACKS.map((t) => ({ id: t.id as string | null, name: t.name, description: t.description })), { id: null, name: 'No music', description: 'Voice and clip sound only' }]
  return (
    <div>
      <Section>
        <ul className="grid gap-2.5 lg:grid-cols-2">
          {options.map((t) => {
            const selected = project.musicTrackId === t.id
            return (
              <li key={t.id ?? 'none'}>
                <PickRow
                  selected={selected}
                  onClick={() => updateProject({ musicTrackId: t.id })}
                  leading={
                    t.id ? (
                      <PreviewButton label={t.name} playing={preview.playing === `music:${t.id}`} loading={preview.loading === `music:${t.id}`} onClick={() => void preview.music(t.id!)} />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10">
                        <VolumeX className="size-4" strokeWidth={2.4} />
                      </span>
                    )
                  }
                  title={t.name}
                  sub={t.description}
                />
              </li>
            )
          })}
        </ul>
        {project.musicTrackId && <Slider label="Music level" value={project.musicGainDb} min={-30} max={-4} format={(v) => `${v} dB`} onChange={(musicGainDb) => updateProject({ musicGainDb })} />}
        {project.musicTrackId && <p className="text-[13px] text-white/55">It gets quieter by itself whenever someone talks.</p>}
      </Section>
      <OwnMusic project={project} />
    </div>
  )
}

/** The user's own song: rights first, then upload; choose where the song starts. */
function OwnMusic({ project }: { project: Project }) {
  const { updateProject } = useProject()
  const own = project.ownMusic
  const selected = project.musicTrackId === OWN_MUSIC && !!own
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [start, setStart] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      await addOwnMusic(file)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const shownStart = start ?? own?.startSec ?? 0
  const commitStart = () => {
    if (start !== null) void setOwnMusicStart(start)
    setStart(null)
  }

  return (
    <Fold title="Use your own song" summary={own ? `${own.name}${selected ? ' · playing' : ''}` : 'Or export without music and add a trending sound in TikTok, Instagram or YouTube.'} defaultOpen={selected}>
      <input ref={input} type="file" accept="audio/*" hidden onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      {own ? (
        <>
          <PickRow
            selected={selected}
            onClick={() => updateProject({ musicTrackId: OWN_MUSIC })}
            leading={
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', selected ? 'bg-accent text-white' : 'bg-white/10')}>
                <Music2 className="size-4" strokeWidth={2.4} />
              </span>
            }
            title={own.name}
            sub={`${formatDuration(own.durationSec)} · your upload`}
          />
          {selected && own.durationSec > 4 && (
            <Row label="Start the song at">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={Math.floor(own.durationSec - 3)}
                  step={1}
                  value={shownStart}
                  aria-label="Start the song at"
                  onChange={(e) => setStart(Number(e.target.value))}
                  onPointerUp={commitStart}
                  onKeyUp={commitStart}
                  onBlur={commitStart}
                  className="h-9 min-w-0 flex-1 accent-[#ff5a1f]"
                />
                <span className="tabular w-11 text-right text-[13px] text-muted">{formatDuration(shownStart)}</span>
              </div>
            </Row>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="quiet" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Spinner /> : <Upload className="size-4" strokeWidth={2.4} />} Use another song
            </Button>
            <Button size="sm" variant="text" disabled={busy} onClick={() => void removeOwnMusic()}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-3 text-[14px]">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 size-4 accent-[#ff5a1f]" />
            <span>
              I made this song or have the rights to use it
              <span className="block text-[13px] text-muted">Apps can mute or claim videos with copyrighted songs.</span>
            </span>
          </label>
          <Button size="sm" variant="quiet" disabled={!rights || busy} onClick={() => input.current?.click()}>
            {busy ? <Spinner /> : <Upload className="size-4" strokeWidth={2.4} />} Choose a song
          </Button>
        </>
      )}
    </Fold>
  )
}

const TITLE_SHOW: { value: string; label: string }[] = [
  { value: '0', label: 'Off' },
  { value: '3', label: 'First 3 s' },
  { value: 'always', label: 'Whole video' },
]

export function StylePanel({ project, clips, sceneClip }: { project: Project; clips: Clip[]; sceneClip?: Clip }) {
  const { updateProject } = useProject()
  const sample = sceneClip?.thumbnail ?? clips.find((c) => c.thumbnail)?.thumbnail
  const show = currentEdit(project)?.title.showUntilSec ?? 3
  const showValue = show === 0 ? '0' : show === 'always' ? 'always' : '3'
  return (
    <div>
      <Section title="Title">
        <input
          id="vlog-title"
          aria-label="Title"
          value={project.title}
          maxLength={40}
          disabled={show === 0}
          onChange={(e) => updateProject({ title: e.target.value })}
          placeholder="Name your vlog"
          className="block h-[52px] w-full rounded-[16px] bg-surface-2 px-4 text-[16px] outline-none placeholder:text-white/40 focus:shadow-[inset_0_0_0_1.5px_#ff5a1f] disabled:opacity-50"
        />
        <Row label="Show title">
          <Segmented label="Show the title" options={TITLE_SHOW} value={showValue} onChange={(v) => void setTitleShow(v === 'always' ? 'always' : Number(v)).catch((e: Error) => toast(e.message, 'error'))} />
        </Row>
      </Section>
      <Section title="Caption style" helper="Each word lights up as it’s spoken.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {STYLES.map((s) => (
            <PresetCard key={s.id} style={s} selected={project.styleId === s.id} image={sample} onClick={() => updateProject({ styleId: s.id })} />
          ))}
        </div>
      </Section>
    </div>
  )
}

function PresetCard({ style, selected, image, onClick }: { style: TextStyle; selected: boolean; image?: string; onClick: () => void }) {
  const o = style.outline
  const textShadow = o ? (o.strength === 'heavy' ? '0 0 2px #000,0 0 3px #000,0 2px 6px rgba(0,0,0,.95)' : o.strength === 'normal' ? '0 0 2px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.85)' : '0 1px 8px rgba(0,0,0,.45)') : 'none'
  const words = ['so', 'here’s', 'a', 'sunny'].map((w) => applyCase(w, style.captionCase))
  return (
    <OptionCard selected={selected} onClick={onClick} label={`${style.name} captions`}>
      <span className="relative grid h-[92px] place-items-center overflow-hidden bg-[linear-gradient(170deg,#f4dcae_0%,#d9a55e_28%,#6f7d3c_62%,#1c2414_100%)]">
        {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover opacity-80" />}
        {style.captions !== false && (
          <span className="relative rounded-[.35em] px-[.42em] py-[.12em] text-[15px]" style={{ fontWeight: style.weight, color: style.box ? style.captionColor : '#fff', background: style.box ?? undefined, textShadow }}>
            {words.slice(0, 3).join(' ')} <span style={{ color: style.highlightColor }}>{words[3]}</span>
          </span>
        )}
      </span>
      <span className="block px-3 pt-2.5 pb-3">
        <span className="block text-[14px] font-bold">{style.name}</span>
        <span className="block truncate text-[12px] text-muted">{style.description}</span>
      </span>
    </OptionCard>
  )
}
