import type { ReactNode } from 'react'
import { cn } from './utils'

const styles = {
  default: 'border-white/15 bg-white/10 text-zinc-200',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  warning: 'border-amber-500/35 bg-amber-500/10 text-amber-100',
  danger: 'border-rose-500/35 bg-rose-500/10 text-rose-100',
  info: 'border-sky-500/35 bg-sky-500/10 text-sky-100',
  role: 'border-violet-500/30 bg-violet-500/10 text-violet-100',
} as const

export type BadgeProps = {
  children: ReactNode
  variant?: keyof typeof styles
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
