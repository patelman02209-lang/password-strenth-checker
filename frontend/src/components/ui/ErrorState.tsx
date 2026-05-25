import { motion } from 'framer-motion'
import { AlertTriangle, ShieldOff, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './utils'

const icons = {
  error: AlertTriangle,
  offline: WifiOff,
  forbidden: ShieldOff,
} as const

export type ErrorStateProps = {
  title: string
  message: string
  action?: ReactNode
  variant?: keyof typeof icons
  className?: string
}

export function ErrorState({ title, message, action, variant = 'error', className }: ErrorStateProps) {
  const Icon = icons[variant]
  const shell =
    variant === 'forbidden'
      ? 'border-amber-500/25 bg-amber-950/20'
      : variant === 'offline'
        ? 'border-zinc-600/40 bg-zinc-950/50'
        : 'border-rose-500/25 bg-rose-950/20'
  const ink = variant === 'forbidden' ? 'text-amber-400' : variant === 'offline' ? 'text-zinc-400' : 'text-rose-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border p-6 backdrop-blur-md', shell, className)}
      role="alert"
    >
      <div className="flex gap-3">
        <Icon className={cn('h-6 w-6 shrink-0', ink)} aria-hidden />
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{message}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </motion.div>
  )
}
