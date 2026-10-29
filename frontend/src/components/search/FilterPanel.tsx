import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMeta } from '@/hooks/useMeta'
import { ITEM_STATUS_LABEL, todayIso } from '@/lib/format'
import { ITEM_STATUSES, type Category, type ItemFilters, type ItemStatus, type ItemType } from '@/lib/types'

const ANY = 'any'

export function FilterPanel({
  filters,
  onChange,
  idPrefix = 'f',
}: {
  filters: ItemFilters
  onChange: (patch: Partial<ItemFilters>) => void
  idPrefix?: string
}) {
  const { categories, zones } = useMeta()
  const today = todayIso()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span id={`${idPrefix}-type`} className="text-sm font-semibold text-ink">
          Type
        </span>
        <Segmented
          label="Type"
          value={filters.type ?? 'ALL'}
          onValueChange={(v) => onChange({ type: v === 'ALL' ? undefined : (v as ItemType) })}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'LOST', label: 'Lost' },
            { value: 'FOUND', label: 'Found' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Select
          value={filters.category ?? ANY}
          onValueChange={(v) => onChange({ category: v === ANY ? undefined : (v as Category) })}
        >
          <SelectTrigger id={`${idPrefix}-category`}>
            <SelectValue placeholder="Any category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any category</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-location`}>Place</Label>
        <Select
          value={filters.location_id ? String(filters.location_id) : ANY}
          onValueChange={(v) => onChange({ location_id: v === ANY ? undefined : Number(v) })}
        >
          <SelectTrigger id={`${idPrefix}-location`}>
            <SelectValue placeholder="Anywhere on campus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Anywhere on campus</SelectItem>
            {zones.map((z) => (
              <SelectGroup key={z.zone}>
                <SelectLabel>{z.zone}</SelectLabel>
                {z.locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <Select
          value={filters.status ?? ANY}
          onValueChange={(v) => onChange({ status: v === ANY ? undefined : (v as ItemStatus) })}
        >
          <SelectTrigger id={`${idPrefix}-status`}>
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any status</SelectItem>
            {ITEM_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ITEM_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink">Date</legend>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-from`} className="text-xs font-medium text-ink-soft">
              From
            </Label>
            <Input
              id={`${idPrefix}-from`}
              type="date"
              max={filters.date_to || today}
              value={filters.date_from ?? ''}
              onChange={(e) => onChange({ date_from: e.target.value || undefined })}
              className="px-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-to`} className="text-xs font-medium text-ink-soft">
              To
            </Label>
            <Input
              id={`${idPrefix}-to`}
              type="date"
              min={filters.date_from || undefined}
              max={today}
              value={filters.date_to ?? ''}
              onChange={(e) => onChange({ date_to: e.target.value || undefined })}
              className="px-2.5 text-sm"
            />
          </div>
        </div>
      </fieldset>
    </div>
  )
}
