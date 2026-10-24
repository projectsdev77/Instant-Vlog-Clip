import { useRouteError } from 'react-router'
import { RotateCw } from 'lucide-react'
import { LogoTile } from '@/components/Brand'

/** A newer version was deployed while this tab was open, so its code files are gone. */
export const isStaleBuild = (e: unknown) => /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String((e as Error)?.message ?? e))

/** Shown instead of React Router's developer error screen. Vlogs are saved as you go, so reloading is safe. */
export function AppError() {
  const error = useRouteError()
  const stale = isStaleBuild(error)
  if (!stale) console.error(error)
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoTile size={44} />
      <div className="space-y-2">
        <h1 className="title-2">{stale ? 'There’s a new version of the app' : 'Something went wrong'}</h1>
        <p className="mx-auto max-w-[40ch] text-[16px] text-muted">{stale ? 'Reload to get it. Your vlogs are saved, so nothing is lost.' : 'Reload the page to try again. Your vlogs are saved, so nothing is lost.'}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => location.reload()} className="flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-ink">
          <RotateCw className="size-4" strokeWidth={2.6} /> Reload
        </button>
        <a href="/" className="flex h-12 items-center rounded-full px-5 text-[15px] font-semibold text-muted hover:text-fg">
          Go home
        </a>
      </div>
    </div>
  )
}
