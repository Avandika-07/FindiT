import { z } from 'zod'
import { todayIso } from '@/lib/format'
import type { ItemCreate, ItemType } from '@/lib/types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Rules for naming a new kind of item; the server applies the same ones. */
export function categoryNameError(name: string): string | null {
  if (name.length < 2 || name.length > 30) return 'Use 2 to 30 characters, for example: Power bank.'
  if (!/\p{L}/u.test(name)) return 'Use letters to name the kind of item.'
  return null
}

const base = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'Choose what kind of item it is.')
    .superRefine((v, ctx) => {
      const error = v ? categoryNameError(v) : null
      if (error) ctx.addIssue({ code: 'custom', message: error })
    }),
  title: z
    .string()
    .trim()
    .min(3, 'Give it a short name, at least 3 characters.')
    .max(80, 'Keep the name under 80 characters.'),
  description: z.string().max(1000, 'Keep the description under 1000 characters.'),
  color: z.string().max(30),
  brand: z.string().trim().max(40, 'Keep the brand under 40 characters.'),
  location_id: z.number().int().min(1, 'Choose the place.'),
  date_choice: z.string().min(1, 'Choose when it happened.'),
  event_date: z
    .string()
    .regex(DATE_RE, 'Pick a date.')
    .refine((v) => v <= todayIso(), "The date can't be in the future."),
  secret_question: z.string(),
  secret_answer: z.string(),
})

export const lostSchema = base

export const foundSchema = base.extend({
  secret_question: z
    .string()
    .trim()
    .min(5, 'Write a question of at least 5 characters.')
    .max(160, 'Keep the question under 160 characters.'),
  secret_answer: z
    .string()
    .trim()
    .min(1, 'Add the answer so we can check claims against it.')
    .max(80, 'Keep the answer under 80 characters.'),
})

export type ReportValues = z.input<typeof base>
export type ReportField = keyof ReportValues

export type StepId = 'what' | 'where' | 'photo' | 'secret' | 'review'

export interface StepDef {
  id: StepId
  label: string
  title: string
  fields: ReportField[]
}

export function stepsFor(type: ItemType): StepDef[] {
  const lost = type === 'LOST'
  const steps: StepDef[] = [
    {
      id: 'what',
      label: 'What',
      title: 'What is it?',
      fields: ['category', 'title', 'description', 'color', 'brand'],
    },
    {
      id: 'where',
      label: 'Where and when',
      title: 'Where and when?',
      fields: ['location_id', 'date_choice', 'event_date'],
    },
    { id: 'photo', label: 'Photo', title: lost ? 'Add a photo' : 'Add a photo of what you found', fields: [] },
  ]
  if (!lost) steps.push({ id: 'secret', label: 'Secret check', title: 'Secret check', fields: ['secret_question', 'secret_answer'] })
  steps.push({ id: 'review', label: 'Review', title: 'Review your tag', fields: [] })
  return steps
}

export const EMPTY_VALUES: ReportValues = {
  category: '',
  title: '',
  description: '',
  color: '',
  brand: '',
  location_id: 0,
  date_choice: '',
  event_date: '',
  secret_question: '',
  secret_answer: '',
}

export function toPayload(type: ItemType, v: ReportValues): ItemCreate {
  const common = {
    title: v.title.trim(),
    category: v.category.trim(),
    location_id: v.location_id,
    event_date: v.event_date,
    ...(v.description.trim() ? { description: v.description.trim() } : {}),
    ...(v.color ? { color: v.color } : {}),
    ...(v.brand.trim() ? { brand: v.brand.trim() } : {}),
  }
  if (type === 'FOUND') {
    return {
      type: 'FOUND',
      ...common,
      secret_question: v.secret_question.trim(),
      secret_answer: v.secret_answer.trim(),
    }
  }
  return { type: 'LOST', ...common }
}

/* ---------- sessionStorage persistence ---------- */

interface Saved {
  values: ReportValues
  step: number
}

const key = (type: ItemType) => `findit:report:${type.toLowerCase()}`

export function loadDraft(type: ItemType): Saved | null {
  try {
    const raw = sessionStorage.getItem(key(type))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Saved>
    if (!parsed || typeof parsed !== 'object' || !parsed.values) return null
    return {
      values: { ...EMPTY_VALUES, ...parsed.values },
      step: typeof parsed.step === 'number' ? parsed.step : 0,
    }
  } catch {
    return null
  }
}

export function saveDraft(type: ItemType, draft: Saved) {
  try {
    sessionStorage.setItem(key(type), JSON.stringify(draft))
  } catch {
    /* storage full or blocked: the draft just won't survive a refresh */
  }
}

export function clearDraft(type: ItemType) {
  try {
    sessionStorage.removeItem(key(type))
  } catch {
    /* ignore */
  }
}

export const SECRET_EXAMPLES = [
  'What sticker is on the back?',
  'What is the lock screen wallpaper?',
  'What is written inside?',
  'What colour is the keychain?',
]
