import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Container } from '@/components/layout/PageHeader'
import { TagMark } from '@/components/layout/Wordmark'
import { Button } from '@/components/ui/button'
import { describedBy, Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { api, ApiError, errorMessage } from '@/lib/api'
import { env } from '@/lib/env'
import type { DemoUser } from '@/lib/types'

const schema = z.object({
  roll_no: z.string().trim().min(1, 'Enter your roll number.'),
  password: z.string().min(1, 'Enter your password.'),
})
type Values = z.infer<typeof schema>

function safeNext(raw: string | null): string {
  // Only allow in-app paths so the next param can't send people off-site.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) return '/'
  return raw
}

export default function LoginPage() {
  useDocumentTitle('Log in')
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const { login, isLoggedIn } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [demoPending, setDemoPending] = useState<string | null>(null)

  const demo = useQuery({ queryKey: ['demo-users'], queryFn: api.demoUsers, retry: false, staleTime: Infinity })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { roll_no: '', password: '' } })

  if (isLoggedIn && !isSubmitting && !demoPending) return <Navigate to={next} replace />

  const finish = (name: string) => {
    toast.success(`Welcome back, ${name}`)
    navigate(next, { replace: true })
  }

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && Object.keys(err.fields).length) {
      if (err.fields.roll_no) setError('roll_no', { message: err.fields.roll_no })
      if (err.fields.password) setError('password', { message: err.fields.password })
      if (!err.fields.roll_no && !err.fields.password) setFormError(err.message)
    } else {
      setFormError(errorMessage(err))
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await login(values.roll_no.trim(), values.password)
      finish(user.display_name)
    } catch (err) {
      handleError(err)
    }
  })

  const loginAs = async (u: DemoUser) => {
    setFormError(null)
    setDemoPending(u.roll_no)
    try {
      const user = await login(u.roll_no, u.password)
      finish(user.display_name)
    } catch (err) {
      handleError(err)
      setDemoPending(null)
    }
  }

  return (
    <Container className="max-w-[440px]">
      <div className="flex flex-col items-center text-center">
        <TagMark className="size-12 text-ink" />
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink">Log in to {env.appName}</h1>
        <p className="mt-2 text-ink-soft">Use your college roll number to report and claim items.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5 rounded-panel border border-line bg-surface shadow-card p-5 sm:p-6">
        <Field id="roll_no" label="Roll number" hint="Admins can use their email address." error={errors.roll_no?.message}>
          <Input
            id="roll_no"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="21CS001"
            aria-invalid={!!errors.roll_no}
            aria-describedby={describedBy('roll_no', errors.roll_no?.message, true)}
            {...register('roll_no')}
          />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={describedBy('password', errors.password?.message)}
              className="pr-12"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute top-0 right-0 grid size-11 place-items-center rounded-control text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-cobalt"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </Field>
        {formError && <FieldError>{formError}</FieldError>}
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Log in
        </Button>
      </form>

      {demo.isSuccess && demo.data.length > 0 && (
        <section aria-labelledby="demo-title" className="mt-8">
          <h2 id="demo-title" className="text-sm font-semibold text-ink">
            Log in as a demo user
          </h2>
          <p className="mt-1 text-xs text-ink-soft">Shown because the server is in debug mode.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {demo.data.map((u) => (
              <li key={u.roll_no}>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-14 w-full justify-start py-2.5 text-left whitespace-normal"
                  loading={demoPending === u.roll_no}
                  disabled={!!demoPending}
                  onClick={() => void loginAs(u)}
                >
                  {demoPending !== u.roll_no && <UserRound aria-hidden="true" className="text-ink-soft" />}
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">Log in as {u.display_name}</span>
                    <span className="mt-0.5 block text-xs font-normal [overflow-wrap:anywhere] text-ink-soft">
                      {u.label}, {u.roll_no}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  )
}
