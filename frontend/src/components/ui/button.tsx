import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt disabled:pointer-events-none disabled:opacity-55 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-cobalt text-on-cobalt shadow-[0_4px_14px_-6px_color-mix(in_srgb,var(--cobalt)_70%,transparent)] hover:bg-cobalt-hover hover:shadow-[0_8px_26px_-6px_color-mix(in_srgb,var(--cobalt)_75%,transparent)]',
        secondary: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-wash',
        ghost: 'text-ink hover:bg-wash',
        quiet: 'text-ink-soft hover:bg-wash hover:text-ink',
        danger:
          'bg-danger text-white hover:bg-[color-mix(in_srgb,var(--danger)_86%,black)] hover:shadow-[0_8px_22px_-8px_color-mix(in_srgb,var(--danger)_70%,transparent)] dark:text-paper',
        success:
          'bg-success-fill text-on-success hover:bg-[color-mix(in_srgb,var(--success-fill)_86%,black)] hover:shadow-[0_8px_22px_-8px_color-mix(in_srgb,var(--success)_70%,transparent)]',
        outlineDanger: 'border border-line bg-surface text-danger hover:border-danger hover:bg-wash',
        link: 'h-auto px-0 text-cobalt underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm [&_svg]:size-4',
        md: 'h-11 px-4 text-sm [&_svg]:size-[18px]',
        lg: 'h-12 px-5 text-base [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
        iconSm: 'size-9 [&_svg]:size-[18px]',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
