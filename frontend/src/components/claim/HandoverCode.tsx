import { MapPin } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Claim } from '@/lib/types'

/** The claimant's handover pass: big code, QR, pickup place. */
export function HandoverCode({ claim }: { claim: Claim }) {
  const code = claim.handover_code ?? ''
  const first = code.slice(0, 3)
  const second = code.slice(3)

  return (
    <section
      aria-label="Handover pass"
      className="qr-stage relative overflow-hidden rounded-[28px] shadow-[0_24px_50px_-22px_rgb(59_91_255/0.6)]"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-found" />
      <div className="flex flex-col items-center gap-6 px-6 py-7 sm:flex-row sm:items-center sm:gap-10 sm:pl-10">
        <div className="flex-1 text-center sm:text-left">
          <p className="text-sm font-semibold text-white">Handover pass</p>
          <p
            className="mt-2 font-display text-5xl leading-none font-extrabold tracking-[0.06em] text-white tabular-nums sm:text-6xl"
            aria-label={`Handover code ${code.split('').join(' ')}`}
          >
            <span aria-hidden="true">
              {first}
              <span className="inline-block w-3 sm:w-4" />
              {second}
            </span>
          </p>
          <p className="mt-3 text-base font-semibold text-white">Show this at the desk</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white sm:justify-start">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span>
              Pickup place: <span className="font-bold">{claim.item.location.name}</span>
            </span>
          </p>
        </div>
        <div className="relative">
          <span className="qr-glow" aria-hidden="true" />
          <div className="relative rounded-[20px] bg-white p-3.5 shadow-[0_16px_40px_-12px_rgb(20_27_58/0.45)]">
            <QRCodeSVG
              value={`FINDIT:${claim.id}:${code}`}
              size={132}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#141B3A"
              title={`QR code for handover code ${code}`}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
