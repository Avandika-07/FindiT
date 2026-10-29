import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { PhotoDrop } from '@/components/common/PhotoDrop'
import { Button } from '@/components/ui/button'
import { describedBy, Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'
import { Textarea } from '@/components/ui/textarea'
import { useCreateClaim } from '@/hooks/useClaims'
import { useMeta } from '@/hooks/useMeta'
import { ApiError, errorMessage } from '@/lib/api'
import type { Item } from '@/lib/types'

const schema = z.object({
  secret_answer: z
    .string()
    .trim()
    .min(1, 'Answer the question. Only the real owner should know this.')
    .max(80, 'Keep the answer under 80 characters.'),
  proof_text: z
    .string()
    .trim()
    .min(10, 'Describe it in a bit more detail (at least 10 characters).')
    .max(1000, 'Keep the description under 1000 characters.'),
})

type FormValues = z.infer<typeof schema>

export function ClaimSheet({ item, open, onOpenChange }: { item: Item; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { maxUploadMb } = useMeta()
  const [photo, setPhoto] = useState<File | null>(null)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const create = useCreateClaim(item.id)
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { secret_answer: '', proof_text: '' } })

  const proofLength = (useWatch({ control, name: 'proof_text' }) ?? '').trim().length

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    create.mutate(
      { ...values, photo },
      {
        onSuccess: ({ photoError }) => {
          toast.success('Claim sent')
          if (photoError) toast.error(`Your claim was sent, but the photo didn't upload: ${photoError}`)
          setDone(true)
        },
        onError: (err) => {
          if (err instanceof ApiError && Object.keys(err.fields).length) {
            for (const [field, message] of Object.entries(err.fields)) {
              if (field === 'secret_answer' || field === 'proof_text') setError(field, { message })
            }
            if (!err.fields.secret_answer && !err.fields.proof_text) setFormError(err.message)
          } else {
            setFormError(errorMessage(err))
          }
        },
      },
    )
  })

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next && done) {
      // Reset after the closing animation so the success view doesn't flash away.
      window.setTimeout(() => {
        setDone(false)
        setPhoto(null)
        reset()
      }, 250)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={done ? 'Claim sent' : 'Claim this item'}
      description={done ? undefined : item.title}
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--found)_14%,transparent)] text-found-text">
            <CircleCheck className="size-8" aria-hidden="true" />
          </span>
          <div className="max-w-sm">
            <p className="text-base text-ink">
              An admin or the finder will check your answer and description. This usually takes less than a day.
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              If it's approved you'll get a 6-digit handover code in My stuff. Show it at the desk to collect your
              item.
            </p>
          </div>
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/me?tab=claims" onClick={() => handleOpenChange(false)}>
                See my claims
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="claim-answer">{item.secret_question || 'What is something only the owner would know?'}</Label>
            <p id="claim-answer-hint" className="text-xs text-ink-soft">
              The finder set this question. Your exact answer is never shown to anyone.
            </p>
            <Input
              id="claim-answer"
              autoComplete="off"
              aria-invalid={!!errors.secret_answer}
              aria-describedby={errors.secret_answer ? 'claim-answer-error' : 'claim-answer-hint'}
              {...register('secret_answer')}
            />
            {errors.secret_answer?.message && (
              <FieldError id="claim-answer-error">{errors.secret_answer.message}</FieldError>
            )}
          </div>

          <Field
            id="claim-proof"
            label="Describe your item"
            hint="Marks, scratches, stickers, what's inside, where you last had it."
            error={errors.proof_text?.message}
            counter={{ value: proofLength, max: 1000 }}
          >
            <Textarea
              id="claim-proof"
              rows={4}
              aria-invalid={!!errors.proof_text}
              aria-describedby={describedBy('claim-proof', errors.proof_text?.message, true)}
              {...register('proof_text')}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="claim-photo">
              Photo of you with it, or a receipt
              <span className="ml-1.5 font-normal text-ink-soft">(optional)</span>
            </Label>
            <PhotoDrop
              id="claim-photo"
              file={photo}
              onChange={setPhoto}
              maxMb={maxUploadMb}
              compact
              label="Add a proof photo"
              hint="An old photo of the item helps the reviewer."
            />
          </div>

          <p className="flex items-start gap-2 rounded-control bg-wash p-3 text-sm text-ink">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden="true" />
            An admin will review your claim. Wrong answers are recorded.
          </p>

          {formError && <FieldError>{formError}</FieldError>}

          <Button type="submit" size="lg" loading={create.isPending} className="w-full">
            Claim this item
          </Button>
        </form>
      )}
    </ResponsiveDialog>
  )
}
