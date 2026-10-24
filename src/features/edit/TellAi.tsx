import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'

/** "Shorter, 20s" sets the length on the device; the others go to the AI. */
export const AI_SUGGESTIONS = ['Open with the sunset', 'Make it punchier', 'Shorter, 20s']

type Props = { thinking: boolean; onAsk: (text: string) => Promise<boolean> }

function AiInput({ thinking, onAsk, autoFocus }: Props & { autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const send = async (t: string) => {
    if (!t.trim() || thinking) return
    if (await onAsk(t.trim())) setText('')
  }
  return (
    <div className="space-y-3">
      <form
        className="flex h-12 items-center gap-2 rounded-full bg-surface-2 pr-1 pl-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/.08)] focus-within:shadow-[inset_0_0_0_1.5px_#ff5a1f,0_0_0_4px_rgb(255_90_31/.18)]"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <Sparkles className="size-[17px] shrink-0 text-ember-300" strokeWidth={2.2} />
        <input
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask AI to change anything…"
          aria-label="Tell the AI what to change"
          disabled={thinking}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/40 focus-visible:shadow-none"
        />
        {thinking ? (
          <span className="flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-muted" role="status">
            <Spinner className="size-3.5" /> Working on it…
          </span>
        ) : (
          <button type="submit" disabled={!text.trim()} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-ember transition hover:bg-accent-hover disabled:bg-white/12 disabled:text-white/40 disabled:shadow-none">
            <Send className="size-[17px]" strokeWidth={2.4} />
          </button>
        )}
      </form>
      <div className="flex flex-wrap gap-2">
        {AI_SUGGESTIONS.map((s) => (
          <button key={s} type="button" disabled={thinking} onClick={() => void send(s)} className="h-8 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-white/85 transition hover:bg-[#262321] disabled:opacity-40">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Desktop: a card under the preview. It sits in the page flow and never covers anything. */
export function AiCard(props: Props) {
  return (
    <div data-tour="tell-ai" className="rounded-[22px] bg-surface p-3.5">
      <AiInput {...props} />
      <p className="mt-3 text-[12px] text-white/45">Every change saves a new version. Undo takes you back.</p>
    </div>
  )
}

/** Phone: opened from the bottom bar. */
export function TellAiSheet({ open, onClose, ...props }: Props & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Ask AI" onClose={onClose}>
      <AiInput {...props} autoFocus />
      <p className="mt-4 text-[13px] font-medium text-faint">Every change saves a new version. Undo takes you back.</p>
    </Sheet>
  )
}
