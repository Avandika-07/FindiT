import type { LucideProps } from 'lucide-react'
import { createElement } from 'react'
import { useCategoryIcon } from '@/hooks/useMeta'
import { iconFor } from '@/lib/catalog'

export function CategoryIcon({ category, ...props }: { category: string } & LucideProps) {
  const lookup = useCategoryIcon()
  return createElement(iconFor(category, lookup(category)), { 'aria-hidden': true, ...props })
}
