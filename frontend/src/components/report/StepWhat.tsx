import * as RadioGroup from '@radix-ui/react-radio-group'
import { Check, CircleHelp, Plus } from 'lucide-react'
import { createElement, useState, type KeyboardEvent } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { describedBy, Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useMeta } from '@/hooks/useMeta'
import { iconFor, isLightHex } from '@/lib/catalog'
import type { ItemType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { categoryNameError, type ReportValues } from './schema'

const TILE =
  'group flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-1.5 py-3 text-center text-xs font-semibold text-ink transition-colors hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt data-[state=checked]:border-cobalt data-[state=checked]:bg-[color-mix(in_srgb,var(--cobalt)_9%,var(--surface))] sm:text-sm'

export function StepWhat({ type }: { type: ItemType }) {
  const { categories, colors } = useMeta()
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<ReportValues>()
  const description = useWatch({ control, name: 'description' }) ?? ''
  const category = useWatch({ control, name: 'category' }) ?? ''
  const lost = type === 'LOST'

  // A kind of item that isn't in the list yet. It becomes a category when the report is sent.
  const newCategory = category && !categories.some((c) => c.name === category) ? category : null
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const closeAdd = () => {
    setAdding(false)
    setNewName('')
    setAddError(null)
  }

  const addCategory = () => {
    let name = newName.split(/\s+/).filter(Boolean).join(' ')
    const error = categoryNameError(name)
    if (error) {
      setAddError(error)
      return
    }
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (existing) name = existing.name
    else if (name === name.toLowerCase()) name = name[0].toUpperCase() + name.slice(1)
    setValue('category', name, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    closeAdd()
  }

  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter would otherwise submit the whole step.
    if (e.key === 'Enter') {
      e.preventDefault()
      addCategory()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeAdd()
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">Category</legend>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <RadioGroup.Root
              ref={field.ref}
              value={field.value}
              onValueChange={field.onChange}
              aria-invalid={!!errors.category}
              aria-describedby={errors.category ? 'category-error' : undefined}
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
            >
              {categories.map((c) => (
                <RadioGroup.Item key={c.name} value={c.name} className={TILE}>
                  {createElement(iconFor(c.name, c.icon), {
                    className: 'size-7 text-ink-soft group-data-[state=checked]:text-cobalt',
                    strokeWidth: 1.75,
                    'aria-hidden': true,
                  })}
                  <span className="leading-tight">{c.name}</span>
                </RadioGroup.Item>
              ))}
              {newCategory && (
                <RadioGroup.Item value={newCategory} className={TILE}>
                  {createElement(iconFor(newCategory), {
                    className: 'size-7 text-ink-soft group-data-[state=checked]:text-cobalt',
                    strokeWidth: 1.75,
                    'aria-hidden': true,
                  })}
                  <span className="leading-tight [overflow-wrap:anywhere]">{newCategory}</span>
                  <span className="rounded-full bg-cobalt px-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-on-cobalt">
                    New
                  </span>
                </RadioGroup.Item>
              )}
            </RadioGroup.Root>
          )}
        />
        {errors.category?.message && (
          <div className="mt-2">
            <FieldError id="category-error">{errors.category.message}</FieldError>
          </div>
        )}

        {adding ? (
          <div className="mt-4 rounded-control border border-dashed border-line-strong p-4">
            <Field
              id="new-category"
              label="What kind of item is it?"
              hint="It's added to the list for everyone once you send this report."
              error={addError ?? undefined}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="new-category"
                  autoFocus
                  maxLength={30}
                  autoComplete="off"
                  placeholder="For example: Power bank, Helmet, Pen drive"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    if (addError) setAddError(null)
                  }}
                  onKeyDown={onAddKey}
                  aria-invalid={!!addError}
                  aria-describedby={describedBy('new-category', addError ?? undefined, true)}
                  className="sm:flex-1"
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={addCategory} className="flex-1 sm:flex-none">
                    Add
                  </Button>
                  <Button type="button" variant="secondary" onClick={closeAdd} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                </div>
              </div>
            </Field>
          </div>
        ) : (
          <Button type="button" variant="link" className="mt-3" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Not in the list? Add a new kind of item
          </Button>
        )}
      </fieldset>

      <Field
        id="title"
        label="Name it in a few words"
        hint={lost ? 'For example: Black boAt earphones in a blue case' : 'For example: Blue water bottle with stickers'}
        error={errors.title?.message}
      >
        <Input
          id="title"
          maxLength={80}
          autoComplete="off"
          aria-invalid={!!errors.title}
          aria-describedby={describedBy('title', errors.title?.message, true)}
          {...register('title')}
        />
      </Field>

      <Field
        id="description"
        label="Description"
        optional
        hint="Marks, stickers, what's inside. Details make matches stronger."
        error={errors.description?.message}
        counter={{ value: description.length, max: 1000 }}
      >
        <Textarea
          id="description"
          rows={3}
          aria-invalid={!!errors.description}
          aria-describedby={describedBy('description', errors.description?.message, true)}
          {...register('description')}
        />
      </Field>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">
          Colour <span className="font-normal text-ink-soft">(optional)</span>
        </legend>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <RadioGroup.Root
              ref={field.ref}
              value={field.value || 'none'}
              onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
              className="flex flex-wrap gap-x-2 gap-y-3"
            >
              <Swatch value="none" label="Not sure" />
              {colors.map((c) => (
                <Swatch key={c.name} value={c.name} label={c.name} hex={c.hex} />
              ))}
            </RadioGroup.Root>
          )}
        />
      </fieldset>

      <Field id="brand" label="Brand" optional error={errors.brand?.message}>
        <Input
          id="brand"
          maxLength={40}
          autoComplete="off"
          placeholder="For example: boAt, Casio, Milton"
          aria-invalid={!!errors.brand}
          aria-describedby={describedBy('brand', errors.brand?.message)}
          {...register('brand')}
        />
      </Field>
    </div>
  )
}

function Swatch({ value, label, hex }: { value: string; label: string; hex?: string }) {
  const light = hex ? isLightHex(hex) : true
  return (
    <RadioGroup.Item
      value={value}
      aria-label={label}
      className="group flex w-[4.25rem] flex-col items-center gap-1.5 rounded-control py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
    >
      <span
        className={cn(
          'grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow group-data-[state=checked]:ring-[3px] group-data-[state=checked]:ring-cobalt',
          hex ? 'border border-[rgb(0_0_0/0.14)]' : 'border-2 border-dashed border-line-strong',
        )}
        style={hex ? { backgroundColor: hex } : undefined}
      >
        {hex ? (
          <Check
            className={cn('size-5 opacity-0 group-data-[state=checked]:opacity-100', light ? 'text-[#141B3A]' : 'text-white')}
            strokeWidth={3}
            aria-hidden="true"
          />
        ) : (
          <CircleHelp className="size-5 text-ink-soft" aria-hidden="true" />
        )}
      </span>
      <span className="text-xs text-ink-soft group-data-[state=checked]:font-semibold group-data-[state=checked]:text-ink">
        {label}
      </span>
    </RadioGroup.Item>
  )
}
