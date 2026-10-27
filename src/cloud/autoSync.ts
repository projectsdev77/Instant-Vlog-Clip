// Keeps the signed-in user's account up to date: syncs everything after
// signing in, then saves the open vlog a few seconds after each change (and
// when the tab is hidden). Signed-out use is unchanged: this browser only.
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useProject } from '@/store/projectStore'
import type { CloudRow, Space } from './backend'
import { accountSpace, pushProject, syncAll } from './sync'

export type CloudStatus = 'off' | 'saving' | 'saved' | 'offline'

type CloudState = {
  /** signed-in user's id, or null */
  userId: string | null
  status: CloudStatus
  /** the account's vlogs (Home), null until loaded */
  rows: CloudRow[] | null
  space: Space | null
}

export const useCloud = create<CloudState>(() => ({ userId: null, status: 'off', rows: null, space: null }))

/** Wait after the last change before saving to the account. */
const SAVE_AFTER_MS = 4000
/** Try again this long after a failed save. */
const RETRY_MS = 30_000

let timer: ReturnType<typeof setTimeout> | undefined

async function saveOpen() {
  const id = useProject.getState().project?.id
  if (!id || !useCloud.getState().userId) return
  useCloud.setState({ status: 'saving' })
  try {
    await pushProject(id)
    useCloud.setState({ status: 'saved' })
  } catch (e) {
    console.warn('Saving to the account failed; trying again soon', e)
    useCloud.setState({ status: 'offline' })
    schedule(RETRY_MS)
  }
}

function schedule(ms = SAVE_AFTER_MS) {
  clearTimeout(timer)
  timer = setTimeout(() => void saveOpen(), ms)
}

/** Reloads the account's list and space (Home, Account page). */
export async function refreshAccount(): Promise<void> {
  if (!useCloud.getState().userId) return
  try {
    const rows = await syncAll()
    useCloud.setState({ rows, status: 'saved' })
    useCloud.setState({ space: await accountSpace() })
  } catch (e) {
    console.warn('Couldn’t reach the account', e)
    useCloud.setState({ status: 'offline' })
  }
}

let started = false
/** Called once when the app starts. */
export function startCloudSync() {
  if (started || !supabase) return
  started = true
  const onUser = (id: string | null) => {
    if (id === useCloud.getState().userId) return
    useCloud.setState({ userId: id, rows: null, space: null, status: id ? 'saved' : 'off' })
    if (id) void refreshAccount()
  }
  void supabase.auth.getSession().then(({ data }) => onUser(data.session?.user.id ?? null))
  supabase.auth.onAuthStateChange((_e, s) => onUser(s?.user.id ?? null))

  // Each change to the open vlog: save it a moment later.
  useProject.subscribe((s, prev) => {
    if (!s.project || !useCloud.getState().userId) return
    if (s.project.id !== prev.project?.id || s.project.updatedAt === prev.project?.updatedAt) return
    schedule()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer)
      void saveOpen()
    }
  })
}
