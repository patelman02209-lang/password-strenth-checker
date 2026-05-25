import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './utils'

export type ToastVariant = 'success' | 'error' | 'info'

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const shells: Record<ToastVariant, { border: string; glow: string; icon: string }> = {
  success: {
    border: 'border-emerald-500/30',
    glow: 'shadow-[0_0_40px_-12px_rgba(16,185,129,0.45)]',
    icon: 'text-emerald-400',
  },
  error: {
    border: 'border-rose-500/35',
    glow: 'shadow-[0_0_40px_-12px_rgba(244,63,94,0.35)]',
    icon: 'text-rose-400',
  },
  info: {
    border: 'border-sky-500/30',
    glow: 'shadow-[0_0_40px_-12px_rgba(56,189,248,0.35)]',
    icon: 'text-sky-400',
  },
}

export type ToastFrameProps = {
  id: string
  title?: string
  message: string
  variant: ToastVariant
  onDismiss: (id: string) => void
}

/** Single toast surface (used by ``ToastProvider`` and for Storybook-style previews). */
export function ToastFrame({ id, title, message, variant, onDismiss }: ToastFrameProps) {
  const Icon = icons[variant]
  const s = shells[variant]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      className={cn(
        'pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border bg-zinc-950/90 px-4 py-3 text-sm text-zinc-100 backdrop-blur-xl',
        s.border,
        s.glow,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', s.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold text-white">{title}</p> : null}
        <p className={title ? 'mt-0.5 text-zinc-300' : 'text-zinc-200'}>{message}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-0 shrink-0 px-1 text-zinc-500 hover:text-white"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  )
}

export type ToastStackProps = {
  children: ReactNode
}

export function ToastStack({ children }: ToastStackProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-end gap-2 p-4 sm:p-6"
      aria-live="polite"
    >
      {children}
    </div>
  )
}
