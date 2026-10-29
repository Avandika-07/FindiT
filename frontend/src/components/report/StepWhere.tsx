import * as RadioGroup from '@radix-ui/react-radio-group'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { ErrorState } from '@/components/common/States'
import { Chip, chipClass, ChipGroup } from '@/components/ui/chip-group'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useMeta } from '@/hooks/useMeta'
import { todayIso, yesterdayIso } from '@/lib/format'
import type { ItemType } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { ReportValues } from './schema'

export function StepWhere({ type }: { type: ItemType }) {
  const { zones, isLoading, zonesError, refetch } = useMeta()
  const {
    control,
    setValue,
    register,
    formState: { errors },
  } = useFormContext<ReportValues>()
  const dateChoice = useWatch({ control, name: 'date_choice' })
  const [filter, setFilter] = useState('')
  const lost = type === 'LOST'
  const q = filter.trim().toLowerCase()

  const visibleZones = zones
    .map((z) => ({
      zone: z.zone,
      locations: z.zone.toLowerCase().includes(q) ? z.locations : z.locations.filter((l) => l.name.toLowerCase().includes(q)),
    }))
    .filter((z) => z.locations.length > 0)

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">{lost ? 'Where did you lose it?' : 'Where did you find it?'}</legend>
        <p className="mb-3 text-sm text-ink-soft">
          {lost ? "Your best guess is fine. Nearby places still count towards a match." : 'Pick the closest place.'}
        </p>
        <div className="relative mb-4 max-w-sm">
          <Label htmlFor="place-filter" className="sr-only">
            Filter places
          </Label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
          <Input
            id="place-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter places, like library or canteen"
            className="pl-10"
            autoComplete="off"
          />
        </div>

        {zonesError ? (
          <ErrorState compact title="Campus places didn't load" error={zonesError} onRetry={refetch} />
        ) : isLoading ? (
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-full" style={{ width: `${80 + ((i * 37) % 70)}px` }} />
            ))}
          </div>
        ) : (
          <Controller
            control={control}
            name="location_id"
            render={({ field }) => (
              <RadioGroup.Root
                ref={field.ref}
                value={field.value ? String(field.value) : ''}
                onValueChange={(v) => field.onChange(Number(v))}
                aria-label="Place"
                aria-invalid={!!errors.location_id}
                aria-describedby={errors.location_id ? 'location-error' : undefined}
                className="flex flex-col gap-5"
              >
                {visibleZones.length === 0 && (
                  <p className="text-sm text-ink-soft">No places match '{filter}'. Try a shorter word.</p>
                )}
                {visibleZones.map((z) => (
                  <div key={z.zone} role="group" aria-labelledby={`zone-${z.zone}`}>
                    <h3 id={`zone-${z.zone}`} className="mb-2 text-sm font-medium text-ink-soft">
                      {z.zone}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {z.locations.map((l) => (
                        <Chip key={l.id} value={String(l.id)}>
                          {l.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </RadioGroup.Root>
            )}
          />
        )}
        {errors.location_id?.message && (
          <div className="mt-3">
            <FieldError id="location-error">{errors.location_id.message}</FieldError>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">{lost ? 'When did you lose it?' : 'When did you find it?'}</legend>
        <Controller
          control={control}
          name="date_choice"
          render={({ field }) => (
            <ChipGroup
              ref={field.ref}
              value={field.value}
              aria-label="Date"
              aria-describedby={errors.date_choice || errors.event_date ? 'date-error' : undefined}
              onValueChange={(v) => {
                field.onChange(v)
                if (v === 'today') setValue('event_date', todayIso(), { shouldValidate: true })
                else if (v === 'yesterday') setValue('event_date', yesterdayIso(), { shouldValidate: true })
                else setValue('event_date', '', { shouldValidate: false })
              }}
            >
              <Chip value="today">Today</Chip>
              <Chip value="yesterday">Yesterday</Chip>
              <Chip value="pick">Pick a date</Chip>
            </ChipGroup>
          )}
        />
        {dateChoice === 'pick' && (
          <div className="mt-4 flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="event-date">Date</Label>
            <input
              id="event-date"
              type="date"
              max={todayIso()}
              aria-invalid={!!errors.event_date}
              className={cn(chipClass, 'rounded-control px-3.5 text-base')}
              {...register('event_date')}
            />
          </div>
        )}
        {(errors.date_choice?.message || errors.event_date?.message) && (
          <div className="mt-3">
            <FieldError id="date-error">{errors.date_choice?.message ?? errors.event_date?.message}</FieldError>
          </div>
        )}
      </fieldset>
    </div>
  )
}
