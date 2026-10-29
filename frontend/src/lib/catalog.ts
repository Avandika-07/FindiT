import {
  Backpack,
  BookOpen,
  Calculator,
  Gem,
  Glasses,
  Headphones,
  IdCard,
  KeyRound,
  Laptop,
  Milk,
  Package,
  PlugZap,
  Shirt,
  Smartphone,
  Tag,
  Umbrella,
  Wallet,
  Watch,
  type LucideIcon,
} from 'lucide-react'
import { CATEGORIES, type BuiltInCategory, type MetaCategory, type MetaColor } from './types'

/** lucide icon names (kebab-case, as sent by GET /api/ext/meta) mapped to components. */
export const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  headphones: Headphones,
  wallet: Wallet,
  'id-card': IdCard,
  'key-round': KeyRound,
  backpack: Backpack,
  milk: Milk,
  laptop: Laptop,
  'plug-zap': PlugZap,
  watch: Watch,
  glasses: Glasses,
  calculator: Calculator,
  'book-open': BookOpen,
  umbrella: Umbrella,
  gem: Gem,
  shirt: Shirt,
  package: Package,
  tag: Tag,
}

const DEFAULT_ICON_NAME: Record<BuiltInCategory, string> = {
  Phone: 'smartphone',
  Earphones: 'headphones',
  Wallet: 'wallet',
  'ID card': 'id-card',
  Keys: 'key-round',
  Bag: 'backpack',
  Bottle: 'milk',
  Laptop: 'laptop',
  Charger: 'plug-zap',
  Watch: 'watch',
  Spectacles: 'glasses',
  Calculator: 'calculator',
  'Books and notes': 'book-open',
  Umbrella: 'umbrella',
  Jewellery: 'gem',
  Clothing: 'shirt',
  Other: 'package',
}

export const FALLBACK_CATEGORIES: MetaCategory[] = CATEGORIES.map((name) => ({
  name,
  icon: DEFAULT_ICON_NAME[name],
}))

export const FALLBACK_COLORS: MetaColor[] = [
  { name: 'Black', hex: '#1F2430' },
  { name: 'White', hex: '#FAFAFA' },
  { name: 'Grey', hex: '#9AA1B2' },
  { name: 'Silver', hex: '#C4CAD6' },
  { name: 'Blue', hex: '#2F5BEA' },
  { name: 'Navy', hex: '#1E2A5A' },
  { name: 'Red', hex: '#D7263D' },
  { name: 'Green', hex: '#1F9D55' },
  { name: 'Yellow', hex: '#F2C230' },
  { name: 'Orange', hex: '#F07F2D' },
  { name: 'Pink', hex: '#EC6FA6' },
  { name: 'Purple', hex: '#7B4FD8' },
  { name: 'Brown', hex: '#8A5A3B' },
  { name: 'Gold', hex: '#C9A227' },
]

export function iconFor(category: string, iconName?: string | null): LucideIcon {
  if (iconName && ICONS[iconName]) return ICONS[iconName]
  const fallback = DEFAULT_ICON_NAME[category as BuiltInCategory]
  return (fallback && ICONS[fallback]) || Tag
}

/** Relative luminance check so a check mark on a swatch stays visible. */
export function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = Number.parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 160
}
