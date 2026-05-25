import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ReactNode } from 'react'
import { cn } from './utils'

const variants = {
  primary:
    'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 focus-visible:ring-emerald-400/60 shadow-[0_0_24px_-8px_rgba(16,185,129,0.5)]',
  secondary:
    'border border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10 focus-visible:ring-white/25',
  danger:
    'bg-rose-600/90 text-white hover:bg-rose-500 focus-visible:ring-rose-400/50 shadow-[0_0_20px_-8px_rgba(244,63,94,0.45)]',
  ghost: 'text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:ring-white/20',
} as const

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-base gap-2 rounded-xl',
} as const

export type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading,
    disabled,
    leftIcon,
    rightIcon,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const busy = loading || disabled
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={busy}
      aria-busy={loading ? true : undefined}
      whileTap={busy ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'inline-flex min-h-[2.75rem] touch-manipulation items-center justify-center font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
          aria-hidden
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </motion.button>
  )
})
