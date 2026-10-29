import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Container, PageHeader } from '@/components/layout/PageHeader'
import {
  clearDraft,
  EMPTY_VALUES,
  foundSchema,
  loadDraft,
  lostSchema,
  saveDraft,
  stepsFor,
  toPayload,
  type ReportField,
  type ReportValues,
  type StepId,
} from '@/components/report/schema'
import { StepIndicator } from '@/components/report/StepIndicator'
import { StepPhoto } from '@/components/report/StepPhoto'
import { StepReview } from '@/components/report/StepReview'
import { StepSecret } from '@/components/report/StepSecret'
import { StepWhat } from '@/components/report/StepWhat'
import { StepWhere } from '@/components/report/StepWhere'
import { TagPreview } from '@/components/report/TagPreview'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { api, ApiError, errorMessage } from '@/lib/api'
import type { ItemType } from '@/lib/types'
import { useQueryClient } from '@tanstack/react-query'

export default function ReportPage({ type }: { type: ItemType }) {
  const lost = type === 'LOST'
  useDocumentTitle(lost ? 'Report a lost item' : 'Report a found item')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const steps = stepsFor(type)
  const [draft] = useState(() => loadDraft(type))
  const [step, setStep] = useState(() => Math.min(draft?.step ?? 0, steps.length - 1))
  const [photo, setPhoto] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const methods = useForm<ReportValues>({
    resolver: zodResolver(lost ? lostSchema : foundSchema),
    defaultValues: draft?.values ?? EMPTY_VALUES,
    mode: 'onTouched',
  })
  const { trigger, getValues, setError, subscribe } = methods

  // Keep the draft in sessionStorage so a refresh doesn't lose progress.
  useEffect(() => {
    saveDraft(type, { values: getValues(), step })
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => saveDraft(type, { values: { ...EMPTY_VALUES, ...values }, step }),
    })
  }, [subscribe, getValues, type, step])

  // Move focus to the step heading when the step changes (not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const current = steps[step]
  const isLast = step === steps.length - 1

  const goTo = (id: StepId) => {
    const index = steps.findIndex((s) => s.id === id)
    if (index >= 0) setStep(index)
  }

  const next = async () => {
    setFormError(null)
    if (current.fields.length) {
      const ok = await trigger(current.fields, { shouldFocus: true })
      if (!ok) return
    }
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const submit = async () => {
    setFormError(null)
    const ok = await trigger()
    if (!ok) {
      const errs = methods.formState.errors
      const bad = steps.find((s) => s.fields.some((f) => errs[f]))
      if (bad) goTo(bad.id)
      return
    }
    setSubmitting(true)
    try {
      const item = await api.createItem(toPayload(type, getValues()))
      let photoError: string | null = null
      if (photo) {
        try {
          await api.uploadItemPhoto(item.id, photo)
        } catch (err) {
          photoError = errorMessage(err)
        }
      }
      clearDraft(type)
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['me', 'items'] })
      // A new kind of item becomes a category on the server; refresh the list.
      void queryClient.invalidateQueries({ queryKey: ['meta'] })
      toast.success('Item reported')
      if (photoError) toast.error(`Your item was reported, but the photo didn't upload: ${photoError}`)
      navigate(`/report/done/${item.id}`, { replace: true })
    } catch (err) {
      setSubmitting(false)
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        const known = Object.keys(EMPTY_VALUES) as ReportField[]
        let firstStep: StepId | null = null
        for (const [field, message] of Object.entries(err.fields)) {
          if (known.includes(field as ReportField)) {
            setError(field as ReportField, { message })
            const owner = steps.find((s) => s.fields.includes(field as ReportField))
            if (owner && !firstStep) firstStep = owner.id
          }
        }
        setFormError(err.message)
        if (firstStep) goTo(firstStep)
      } else {
        setFormError(errorMessage(err))
      }
    }
  }

  return (
    <Container>
      <PageHeader
        title={lost ? 'Report a lost item' : 'Report a found item'}
        description={
          lost
            ? "Describe it once. We'll compare it with every found item and tell you when something matches."
            : 'Thank you for handing it in. A few details help us get it back to its owner.'
        }
      />
      <StepIndicator steps={steps} current={step} onJump={setStep} />

      <FormProvider {...methods}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (isLast) void submit()
              else void next()
            }}
            className="min-w-0"
          >
            <h2 ref={headingRef} tabIndex={-1} className="mb-6 font-display text-xl font-bold text-ink outline-none sm:text-2xl">
              {current.title}
            </h2>

            {current.id === 'what' && <StepWhat type={type} />}
            {current.id === 'where' && <StepWhere type={type} />}
            {current.id === 'photo' && <StepPhoto type={type} photo={photo} onPhoto={setPhoto} />}
            {current.id === 'secret' && <StepSecret />}
            {current.id === 'review' && (
              <StepReview type={type} values={getValues()} photo={photo} onEdit={goTo} />
            )}

            {formError && (
              <div className="mt-6">
                <FieldError>{formError}</FieldError>
              </div>
            )}

            <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
              {step > 0 ? (
                <Button type="button" variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                  <ArrowLeft aria-hidden="true" />
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="lg" loading={submitting} className="min-w-36">
                {isLast ? 'Report item' : current.id === 'photo' && !photo ? (lost ? 'Skip photo' : 'Continue without photo') : 'Next'}
              </Button>
            </div>
          </form>

          {current.id !== 'review' && (
            <aside aria-label="Tag preview" className="lg:sticky lg:top-24 lg:self-start">
              <TagPreview type={type} photo={photo} />
            </aside>
          )}
        </div>
      </FormProvider>
    </Container>
  )
}
