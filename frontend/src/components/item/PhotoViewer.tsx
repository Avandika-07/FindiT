import { EyeOff, ImageOff, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import { CategoryIcon } from '@/components/tag/CategoryIcon'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { mediaUrl } from '@/lib/format'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PhotoViewer({ item, className }: { item: Item; className?: string }) {
  const src = mediaUrl(item.photo_url)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const lost = item.type === 'LOST'

  if (!src || failed) {
    return (
      <div
        className={cn(
          'relative grid aspect-[4/3] place-items-center overflow-hidden rounded-panel border border-line bg-wash',
          className,
        )}
      >
        <div className="flex flex-col items-center gap-3 text-ink-soft">
          <span
            className={cn(
              'grid size-20 place-items-center rounded-full bg-surface',
              lost ? 'text-lost-text' : 'text-found-text',
            )}
          >
            <CategoryIcon category={item.category} className="size-9" strokeWidth={1.75} />
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            {failed && <ImageOff className="size-4" aria-hidden="true" />}
            {failed ? "The photo couldn't load" : 'No photo added'}
          </span>
        </div>
      </div>
    )
  }

  const alt = `Photo of ${item.title}${item.photo_blurred ? ', blurred' : ''}`

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-panel border border-line bg-wash">
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className={cn('size-full object-cover', item.photo_blurred && 'scale-105')}
        />
        {!item.photo_blurred && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute right-3 bottom-3 inline-flex h-11 items-center gap-2 rounded-control bg-[rgb(10_14_30/0.65)] px-3.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-[rgb(10_14_30/0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Maximize2 className="size-4" aria-hidden="true" />
            View full size
          </button>
        )}
      </div>
      {item.photo_blurred && (
        <figcaption className="flex items-center gap-2 text-sm text-ink-soft">
          <EyeOff className="size-4 shrink-0" aria-hidden="true" />
          Photo is blurred to protect the owner
        </figcaption>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-3 sm:p-4">
          <DialogTitle className="sr-only">{item.title}</DialogTitle>
          <DialogDescription className="sr-only">Full size photo</DialogDescription>
          <img src={src} alt={alt} className="max-h-[80dvh] w-full rounded-control object-contain" />
        </DialogContent>
      </Dialog>
    </figure>
  )
}
