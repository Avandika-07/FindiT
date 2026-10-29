import { Fragment, useMemo } from 'react'

function escape(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Wraps every case-insensitive occurrence of the given terms in a <mark>. */
export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  const parts = useMemo(() => {
    const clean = [...new Set((terms ?? []).map((t) => t.trim()).filter((t) => t.length > 1))]
    if (!clean.length) return [text]
    clean.sort((a, b) => b.length - a.length)
    const re = new RegExp(`(${clean.map(escape).join('|')})`, 'gi')
    return text.split(re)
  }, [text, terms])

  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded-[4px] bg-[color-mix(in_srgb,var(--signal)_40%,transparent)] px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
