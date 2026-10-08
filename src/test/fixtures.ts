import { textHash } from '@/domain/ids'
import type { PlanContext } from '@/domain/planContext'
import type { Clip, Script } from '@/domain/types'
import { DEFAULT_SETTINGS } from '@/domain/types'

export function makeClip(id: string, durationSec: number, extra: Partial<Clip> = {}): Clip {
  return {
    id,
    projectId: 'p1',
    fileName: `${id}.mp4`,
    mime: 'video/mp4',
    sizeBytes: 1000,
    mediaKey: `media-${id}`,
    durationSec,
    width: 1080,
    height: 1920,
    rotation: 0,
    hasAudio: true,
    addedAt: 0,
    mustInclude: false,
    status: 'analyzed',
    ...extra,
  }
}

export function makeScript(lines: string[], withAudio = true): Script {
  return {
    title: 'My Day',
    lines: lines.map((text, i) => ({
      id: `l${i}`,
      text,
      purpose: i === 0 ? 'hook' : i === lines.length - 1 ? 'outro' : 'story',
      visualIntent: text,
      audio: withAudio
        ? { mediaKey: `vo-${i}`, durationSec: 2, words: [{ word: text, start: 0, end: 2 }], source: 'ai', textHash: textHash(text) }
        : undefined,
    })),
  }
}

export function makeCtx(clips: Clip[], script?: Script, extra: Partial<PlanContext> = {}): PlanContext {
  return {
    clips,
    script,
    voiceMode: 'ai',
    settings: DEFAULT_SETTINGS,
    title: 'My Day',
    musicTrackId: null,
    musicGainDb: -14,
    ...extra,
  }
}
