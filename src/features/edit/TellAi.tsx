import { useState } from 'react'
import { Send, Sparkles, Undo2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'

/** The AI's last answer: what it changed, or why it changed nothing (or a question back). */
export type AiReply = { text: string; changed: boolean }

type Props = {
  thinking: boolean
  onAsk: (text: string) => Promise<boolean>
  /** chips made from the user's own footage */
  suggestions: string[]
  reply?: AiReply
  /** shown while the AI's change is the version on screen */
  onUndo?: () => void
}

function AiInput({ thinking, onAsk, suggestions, reply, onUndo, autoFocus }: Props & { autoFocus?: boolean }) {
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
          placeholder={reply && !reply.changed ? 'Answer, or ask something else…' : 'Ask AI to change anything…'}
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
      {reply && !thinking && (
        <div data-testid="ai-reply" className="flex items-start gap-2.5 rounded-[16px] bg-surface-2 px-3.5 py-3 text-[14px] leading-snug" role="status">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-ember-300" strokeWidth={2.2} />
          <p className="min-w-0 flex-1">{reply.text}</p>
          {reply.changed && onUndo && (
            <button type="button" onClick={onUndo} className="-my-1 flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold text-ember-300 hover:bg-white/6">
              <Undo2 className="size-3.5" strokeWidth={2.6} /> Undo
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" disabled={thinking} onClick={() => void send(s)} className="h-8 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-white/85 transition hover:bg-[#262321] disabled:opacity-40">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

const HINT = 'Only what you ask for changes, and Undo takes it back.'

/** Desktop: a card under the preview. It sits in the page flow and never covers anything. */
export function AiCard(props: Props) {
  return (
    <div data-tour="tell-ai" className="rounded-[22px] bg-surface p-3.5">
      <AiInput {...props} />
      <p className="mt-3 text-[12px] text-white/45">{HINT}</p>
    </div>
  )
}

/** Phone: opened from the bottom bar. */
export function TellAiSheet({ open, onClose, ...props }: Props & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Ask AI" onClose={onClose}>
      <AiInput {...props} autoFocus />
      <p className="mt-4 text-[13px] font-medium text-faint">{HINT}</p>
    </Sheet>
  )
}
