import { Lock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { useHandover } from '@/hooks/useClaims'
import { ApiError, errorMessage } from '@/lib/api'
import { emptyCode, isCompleteCode } from '@/lib/otp'
import type { Claim } from '@/lib/types'
import { OtpInput } from './OtpInput'

export function HandoverForm({
  claimId,
  onDone,
  autoFocus,
}: {
  claimId: number
  onDone?: (claim: Claim) => void
  autoFocus?: boolean
}) {
  const [code, setCode] = useState(emptyCode())
  const [shake, setShake] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const handover = useHandover()
  const errorId = `handover-${claimId}-error`

  const submit = (value = code) => {
    if (!isCompleteCode(value)) {
      setError('Enter all 6 digits of the code.')
      setShake((s) => s + 1)
      return
    }
    setError(null)
    handover.mutate(
      { claimId, code: value },
      {
        onSuccess: (claim) => {
          toast.success('Handover confirmed', { description: `${claim.item.title} is back with its owner.` })
          setCode(emptyCode())
          onDone?.(claim)
        },
        onError: (err) => {
          // Too many wrong codes: the backend answers 429 (code "locked"); 423 kept for the original contract.
          if (err instanceof ApiError && (err.status === 429 || err.status === 423 || err.code === 'locked')) {
            setLocked(true)
          }
          setError(errorMessage(err))
          setShake((s) => s + 1)
        },
      },
    )
  }

  return (
    <form
      className="flex flex-col items-center gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v)
          if (error && !locked) setError(null)
        }}
        shakeKey={shake}
        invalid={!!error}
        disabled={locked || handover.isPending}
        autoFocus={autoFocus}
        describedBy={error ? errorId : undefined}
        label="Claimant's 6-digit handover code"
      />
      {error && (
        <div className="text-center">
          {locked ? (
            <p id={errorId} role="alert" className="flex items-center gap-2 text-sm font-semibold text-danger">
              <Lock className="size-4" aria-hidden="true" />
              {error}
            </p>
          ) : (
            <FieldError id={errorId}>{error}</FieldError>
          )}
        </div>
      )}
      <Button type="submit" size="lg" variant="success" loading={handover.isPending} disabled={locked} className="w-full sm:w-auto sm:min-w-56">
        Confirm handover
      </Button>
    </form>
  )
}
