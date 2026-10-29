import { ImageOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatEventDate, ITEM_TYPE_LABEL, mediaUrl } from '@/lib/format'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CategoryIcon } from './CategoryIcon'
import { Highlight } from './Highlight'
import { StatusStamp } from './StatusStamp'

/** The subset of an Item a tag needs; the report wizard builds one for its live preview. */
export type TagData = Pick<
  Item,
  'type' | 'title' | 'category' | 'color' | 'brand' | 'event_date' | 'status' | 'photo_url' | 'photo_blurred'
> & {
  id?: number
  description?: string
  location: { name: string } | null
}

interface ItemTagProps {
  item: TagData
  /** Render as a plain block (no link), e.g. the wizard preview. */
  static?: boolean
  href?: string
  highlight?: string[]
  why?: ReactNode
  showDescription?: boolean
  showColour?: boolean
  compact?: boolean
  thunk?: boolean
  /** Extra content on the right of the header (e.g. a match dial). */
  aside?: ReactNode
  className?: string
}

export function ItemTag({
  item,
  static: isStatic,
  href,
  highlight,
  why,
  showDescription,
  showColour,
  compact,
  thunk,
  aside,
  className,
}: ItemTagProps) {
  const lost = item.type === 'LOST'
  const photo = mediaUrl(item.photo_url)
  const title = item.title.trim() || 'Untitled item'
  const to = href ?? (item.id ? `/items/${item.id}` : undefined)

  const body = (
    <>
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', lost ? 'bg-lost' : 'bg-found')} />
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-[17px] size-[15px] -translate-y-1/2 rounded-full bg-paper shadow-[inset_0_1px_2px_rgb(0_0_0/0.18),0_0_0_2px_var(--line-strong)]"
      />
      <div className={cn('flex min-w-0 flex-1 flex-col pr-4 pl-11', compact ? 'gap-2.5 py-3.5' : 'gap-3 py-4')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold',
                lost ? 'text-lost-text' : 'text-found-text',
              )}
            >
              <CategoryIcon category={item.category} className="size-4" />
              <span>
                {ITEM_TYPE_LABEL[item.type]}
                <span className="sr-only"> item,</span>
              </span>
              <span className="font-medium text-ink-soft">{item.category}</span>
            </p>
            <h3
              className={cn(
                'mt-1 line-clamp-2 font-display leading-snug font-bold text-ink',
                compact ? 'text-base' : 'text-lg',
              )}
            >
              <Highlight text={title} terms={highlight} />
            </h3>
          </div>
          <StatusStamp status={item.status} size="sm" thunk={thunk} className="mt-0.5" />
        </div>

        {showDescription && item.description && (
          <p className="line-clamp-2 text-sm text-ink-soft">
            <Highlight text={item.description} terms={highlight} />
          </p>
        )}

        <div className="flex items-end justify-between gap-3">
          <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1.5">
            <Fact label="Place" value={item.location?.name ?? 'Not chosen yet'} muted={!item.location} />
            <Fact label={lost ? 'Lost on' : 'Found on'} value={formatEventDate(item.event_date)} />
            {showColour && item.color && <Fact label="Colour" value={item.color} />}
          </dl>
          {aside ? (
            <div className="shrink-0">{aside}</div>
          ) : (
            photo && !compact && <Thumb src={photo} blurred={item.photo_blurred} />
          )}
        </div>

        {why && <div className="-mt-0.5 border-t border-dashed border-line pt-2.5">{why}</div>}
      </div>
    </>
  )

  const shell = cn(
    'group relative flex overflow-hidden rounded-tag border border-line bg-surface text-left shadow-tag',
    lost ? 'tag-tint-lost' : 'tag-tint-found',
    className,
  )

  if (isStatic || !to) {
    return <article className={shell}>{body}</article>
  }
  return (
    <Link
      to={to}
      className={cn(
        shell,
        'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-tag-hover focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-cobalt motion-reduce:hover:translate-y-0',
      )}
    >
      {body}
    </Link>
  )
}

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className={cn('truncate text-sm font-semibold', muted ? 'text-ink-soft' : 'text-ink')}>{value}</dd>
    </div>
  )
}

function Thumb({ src, blurred }: { src: string; blurred: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-control border border-line bg-wash">
      {failed ? (
        <ImageOff className="absolute inset-0 m-auto size-5 text-ink-soft" aria-hidden="true" />
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
      {blurred && <span className="sr-only">Photo is blurred to protect the owner</span>}
    </div>
  )
}
