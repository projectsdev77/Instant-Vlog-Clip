import { useEffect, useMemo, useState } from 'react'
import { buildTimeline, type Timeline } from '@/domain/timeline'
import type { Clip, EditPlan, Project } from '@/domain/types'
import { renderMix } from '@/render/mix'

/** Timeline for the current edit, plus its soundtrack (re-mixed when anything audible changes). */
export function useEditorData(project: Project | null, plan: EditPlan | undefined, clips: Clip[]) {
  const timeline = useMemo<Timeline | null>(() => {
    if (!project || !plan) return null
    const byId = new Map(clips.map((c) => [c.id, c]))
    return buildTimeline({ ...plan, title: { ...plan.title, text: project.title } }, byId, project.script, project.voice.mode)
  }, [project, plan, clips])

  const [mix, setMix] = useState<{ key: string; buf: AudioBuffer } | null>(null)
  const mixKey = timeline && project ? JSON.stringify([timeline.shots.map((s) => [s.clip.id, s.shot.in, s.shot.out, s.shot.clipAudio, s.start]), timeline.voice, project.musicTrackId, project.musicGainDb, project.voice.volumeDb]) : ''

  useEffect(() => {
    if (!timeline || !project || !mixKey) return
    let cancelled = false
    const id = setTimeout(() => {
      renderMix(timeline, project)
        .then((buf) => !cancelled && setMix({ key: mixKey, buf }))
        .catch((e) => console.warn('Mix failed', e))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
    // mixKey captures everything audible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixKey])

  return { timeline, mix: mix?.key === mixKey ? mix.buf : null, staleMix: mix?.buf ?? null }
}
