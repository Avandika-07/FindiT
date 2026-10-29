import { Search, X } from 'lucide-react'
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useSuggestions } from '@/hooks/useSearch'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  defaultValue?: string
  size?: 'sm' | 'md' | 'lg'
  placeholder?: string
  autoFocus?: boolean
  /** Called with the final query. Defaults to navigating to /search?q=. */
  onSearch?: (q: string) => void
  className?: string
  label?: string
}

export function SearchBar({
  defaultValue = '',
  size = 'md',
  placeholder = 'Search for earphones, wallet, ID card…',
  autoFocus,
  onSearch,
  className,
  label = 'Search lost and found items',
}: SearchBarProps) {
  const navigate = useNavigate()
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const { data } = useSuggestions(text)

  const lastWord = text.split(/\s+/).pop() ?? ''
  const suggestions =
    open && lastWord.length >= 2
      ? (data?.suggestions ?? []).filter((s) => s.toLowerCase() !== lastWord.toLowerCase()).slice(0, 8)
      : []
  const expanded = suggestions.length > 0

  const submit = (value: string) => {
    const q = value.trim()
    setOpen(false)
    setActive(-1)
    if (onSearch) onSearch(q)
    else navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  const applySuggestion = (s: string) => {
    const words = text.split(/\s+/)
    words[words.length - 1] = s
    const next = words.join(' ')
    setText(next)
    submit(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && expanded) {
      e.preventDefault()
      setActive((a) => (a + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && expanded) {
      e.preventDefault()
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1))
    } else if (e.key === 'Enter' && expanded && active >= 0) {
      e.preventDefault()
      applySuggestion(suggestions[active])
    } else if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
      }
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(text)
  }

  const heights = { sm: 'h-10', md: 'h-12', lg: 'h-14 sm:h-16' }[size]

  return (
    <form role="search" onSubmit={onSubmit} className={cn('relative w-full', className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-control border border-line-strong bg-surface pl-3.5 transition-colors focus-within:border-cobalt focus-within:outline-2 focus-within:outline-cobalt',
          size === 'lg' && 'rounded-panel pl-5',
          heights,
        )}
      >
        <Search className={cn('shrink-0 text-ink-soft', size === 'lg' ? 'size-5' : 'size-[18px]')} aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-soft/80 [&::-webkit-search-cancel-button]:hidden',
            size === 'lg' ? 'text-lg' : 'text-base',
          )}
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText('')
              inputRef.current?.focus()
            }}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-wash hover:text-ink focus-visible:outline-2 focus-visible:outline-cobalt"
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        {size === 'lg' ? (
          <Button type="submit" size="lg" className="mr-1.5 h-11 sm:mr-2 sm:h-12">
            Search
          </Button>
        ) : (
          <span className="w-1.5" />
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        className={cn(
          'absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-panel border border-line bg-surface p-1.5 shadow-xl',
          !expanded && 'hidden',
        )}
      >
        {suggestions.map((s, i) => (
          <li
            key={s}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applySuggestion(s)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-base text-ink',
              i === active && 'bg-wash',
            )}
          >
            <Search className="size-4 text-ink-soft" aria-hidden="true" />
            <span>
              <span className="font-semibold">{s.slice(0, lastWord.length)}</span>
              {s.slice(lastWord.length)}
            </span>
          </li>
        ))}
      </ul>
    </form>
  )
}
