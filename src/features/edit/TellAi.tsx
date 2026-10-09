import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'

export const AI_SUGGESTIONS = ['Open with the sunset', 'Make it punchier', 'Slow it down', 'Louder music']

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
        className="flex h-[52px] items-center gap-2 rounded-full bg-surface-2 pr-1 pl-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/.08)] focus-within:shadow-[inset_0_0_0_1.5px_#ff5a1f,0_0_0_4px_rgb(255_90_31/.18)]"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <Sparkles className="size-[18px] shrink-0 text-ember-300" strokeWidth={2.2} />
        <input
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell the AI: “open with the sunset”"
          aria-label="Tell the AI what to change"
          disabled={thinking}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/40 focus-visible:shadow-none"
        />
        <button type="submit" disabled={thinking || !text.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-ember transition hover:bg-accent-hover disabled:bg-white/12 disabled:text-white/40 disabled:shadow-none">
          {thinking ? <Spinner className="border-white/30 border-t-white" /> : <Send className="size-[18px]" strokeWidth={2.4} />}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {AI_SUGGESTIONS.map((s) => (
          <button key={s} type="button" disabled={thinking} onClick={() => void send(s)} className="h-9 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-white/85 transition hover:bg-[#262321] disabled:opacity-40">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Desktop: sticky at the bottom of the panel column. */
export function TellAiBar(props: Props) {
  return (
    <div className="sticky bottom-4 z-10 mt-6 rounded-[var(--radius-panel)] bg-[rgb(20_19_19/.92)] p-3 shadow-lift backdrop-blur-[16px]">
      <AiInput {...props} />
    </div>
  )
}

/** Phone: opened from the bottom bar. */
export function TellAiSheet({ open, onClose, ...props }: Props & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Tell the AI" onClose={onClose}>
      <AiInput {...props} autoFocus />
      <p className="mt-4 text-[13px] font-medium text-faint">Each change is a new version. Undo takes you back.</p>
    </Sheet>
  )
}
