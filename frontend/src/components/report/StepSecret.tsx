import { Lock } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { describedBy, Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SECRET_EXAMPLES, type ReportValues } from './schema'

export function StepSecret() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<ReportValues>()

  return (
    <div className="flex flex-col gap-7">
      <p className="flex items-start gap-3 rounded-panel border border-line bg-surface shadow-card p-4 text-ink">
        <Lock className="mt-0.5 size-5 shrink-0 text-found-text" aria-hidden="true" />
        <span>
          Only the real owner will know this. We never show the answer.
          <span className="mt-1 block text-sm text-ink-soft">
            Anyone who claims the item must answer your question. Pick a detail you can see but that isn't obvious from a
            photo.
          </span>
        </span>
      </p>

      <div className="flex flex-col gap-3">
        <Field
          id="secret-question"
          label="Your question"
          error={errors.secret_question?.message}
          hint="Tap an example to use it, then change it if you like."
        >
          <Input
            id="secret-question"
            maxLength={160}
            autoComplete="off"
            aria-invalid={!!errors.secret_question}
            aria-describedby={describedBy('secret-question', errors.secret_question?.message, true)}
            {...register('secret_question')}
          />
        </Field>
        <ul className="flex flex-wrap gap-2" aria-label="Example questions">
          {SECRET_EXAMPLES.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => setValue('secret_question', q, { shouldValidate: true, shouldDirty: true })}
                className="inline-flex min-h-11 items-center rounded-full border border-dashed border-line-strong bg-surface px-4 text-sm text-ink transition-colors hover:border-cobalt hover:text-cobalt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Field
        id="secret-answer"
        label="The answer"
        hint="Small typos in a claimant's answer are tolerated."
        error={errors.secret_answer?.message}
      >
        <Input
          id="secret-answer"
          maxLength={80}
          autoComplete="off"
          aria-invalid={!!errors.secret_answer}
          aria-describedby={describedBy('secret-answer', errors.secret_answer?.message, true)}
          {...register('secret_answer')}
        />
      </Field>
    </div>
  )
}
