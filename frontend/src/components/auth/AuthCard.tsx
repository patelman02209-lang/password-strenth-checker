import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

const glow = {
  emerald: 'shadow-[0_0_80px_-20px_rgba(16,185,129,0.35)]',
  sky: 'shadow-[0_0_72px_-24px_rgba(56,189,248,0.38)]',
  violet: 'shadow-[0_0_72px_-20px_rgba(139,92,246,0.32)]',
} as const

export type AuthCardProps = {
  children: ReactNode
  className?: string
  /** Tint for the outer glow under the glass panel. */
  accent?: keyof typeof glow
}

export function AuthCard({ children, className, accent = 'emerald' }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'psc-glass w-full max-w-md rounded-2xl border border-white/10 p-8',
        glow[accent],
        className,
      )}
    >
      {children}
    </motion.div>
  )
}
