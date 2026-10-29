import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { describedBy, Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useDecideClaim } from '@/hooks/useClaims'
import { ApiError, errorMessage } from '@/lib/api'
import type { Claim } from '@/lib/types'

/** Approve / reject with a required note (3–500 characters). */
export function DecisionForm({ claimId, onDone }: { claimId: number; onDone?: (claim: Claim) => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | undefined>()
  const decide = useDecideClaim()
  const id = `note-${claimId}`
  const pending = decide.isPending ? decide.variables?.decision : null

  const submit = (decision: 'verify' | 'reject') => {
    const trimmed = note.trim()
    if (trimmed.length < 3) {
      setError('Add a short note (at least 3 characters) so the claimant knows why.')
      return
    }
    if (trimmed.length > 500) {
      setError('Keep the note under 500 characters.')
      return
    }
    setError(undefined)
    decide.mutate(
      { claimId, decision, note: trimmed },
      {
        onSuccess: (claim) => {
          toast.success(decision === 'verify' ? 'Claim approved' : 'Claim rejected', {
            description:
              decision === 'verify'
                ? `${claim.claimant.display_name} now has a handover code.`
                : `${claim.claimant.display_name} will see your note.`,
          })
          setNote('')
          onDone?.(claim)
        },
        onError: (err) => {
          setError(err instanceof ApiError && err.fields.note ? err.fields.note : errorMessage(err))
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Field
        id={id}
        label="Note for the claimant"
        hint="Required. Say what convinced you, or what was missing."
        error={error}
        counter={{ value: note.trim().length, max: 500 }}
      >
        <Textarea
          id={id}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy(id, error, true)}
          placeholder="For example: Described the sticker and the scratch on the case."
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="success"
          onClick={() => submit('verify')}
          loading={pending === 'verify'}
          disabled={decide.isPending}
          className="sm:flex-1"
        >
          <Check aria-hidden="true" />
          Approve claim
        </Button>
        <Button
          type="button"
          variant="outlineDanger"
          onClick={() => submit('reject')}
          loading={pending === 'reject'}
          disabled={decide.isPending}
          className="sm:flex-1"
        >
          <X aria-hidden="true" />
          Reject claim
        </Button>
      </div>
    </div>
  )
}
