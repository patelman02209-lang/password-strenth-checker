import { motion, type HTMLMotionProps } from 'framer-motion'
import { type ReactNode } from 'react'
import { cn } from './utils'

const variants = {
  glass: cn(
    'psc-glass rounded-2xl border border-white/10',
    'shadow-[0_0_80px_-40px_rgba(16,185,129,0.45)]',
  ),
  solid: 'rounded-2xl border border-white/10 bg-zinc-900/80',
  outline: 'rounded-2xl border border-white/15 bg-transparent',
} as const

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const

export type CardProps = {
  variant?: keyof typeof variants
  padding?: keyof typeof paddings
  className?: string
  children: ReactNode
  /** When set, root is a Framer Motion section for enter/exit animations. */
  motionProps?: Omit<HTMLMotionProps<'section'>, 'children'>
}

export function Card({ variant = 'glass', padding = 'lg', className, children, motionProps }: CardProps) {
  if (motionProps) {
    const { className: motionClassName, ...motionRest } = motionProps
    const classes = cn(variants[variant], paddings[padding], className, motionClassName)
    return (
      <motion.section className={classes} {...motionRest}>
        {children}
      </motion.section>
    )
  }
  const classes = cn(variants[variant], paddings[padding], className)
  return <section className={classes}>{children}</section>
}
