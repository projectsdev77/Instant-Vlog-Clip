import { useNavigate } from 'react-router'
import { DEFAULT_LIMITS } from '@shared/plans.ts'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useUpgradeSheet } from '@/features/auth/auth'

/** Shown when a signed-in Free user hits a daily limit. */
export function UpgradeSheet() {
  const { open, reason, hide } = useUpgradeSheet()
  const navigate = useNavigate()
  return (
    <Sheet open={open} title="You’ve hit today’s limit" onClose={hide}>
      <p className="text-[16px] text-muted">{reason}</p>
      <p className="mt-3 text-[15px] text-muted">
        Pro makes {DEFAULT_LIMITS.pro.generationsPerDay} vlogs and {DEFAULT_LIMITS.pro.revisionsPerDay} AI edits a day. Your work so far is saved.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          variant="ember"
          block
          onClick={() => {
            hide()
            navigate('/pricing')
          }}
        >
          See Pro
        </Button>
        <Button variant="outline" block onClick={hide}>
          Not now
        </Button>
      </div>
    </Sheet>
  )
}
