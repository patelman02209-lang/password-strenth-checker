import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { cn } from './utils'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const widths = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()
    }, 10)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          key="psc-modal-root"
          className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            key="psc-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              'relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl sm:rounded-2xl',
              widths[size],
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-white">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-zinc-500 hover:text-white"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-4">{children}</div>
            {footer ? <div className="border-t border-white/10 pt-4">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
