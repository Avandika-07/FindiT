import { EyeOff } from 'lucide-react'
import { PhotoDrop } from '@/components/common/PhotoDrop'
import { useMeta } from '@/hooks/useMeta'
import type { ItemType } from '@/lib/types'

export function StepPhoto({
  type,
  photo,
  onPhoto,
}: {
  type: ItemType
  photo: File | null
  onPhoto: (file: File | null) => void
}) {
  const { maxUploadMb } = useMeta()
  const lost = type === 'LOST'
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">
        {lost
          ? 'Optional. A photo of the same model, or an old photo of yours, helps finders recognise it.'
          : 'Strongly encouraged. A clear photo is the fastest way for the owner to recognise their item.'}
      </p>
      <PhotoDrop id="item-photo" file={photo} onChange={onPhoto} maxMb={maxUploadMb} />
      {!lost && (
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Other students see a blurred version until a claim is approved, so the owner still has to prove it's theirs.
        </p>
      )}
    </div>
  )
}
