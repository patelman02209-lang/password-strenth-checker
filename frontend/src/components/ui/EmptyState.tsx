import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from './utils'

export type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon = <Inbox className="h-10 w-10 text-zinc-600" aria-hidden />,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const titleId = useId()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      role="region"
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/25 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{icon}</div>
      <h3 id={titleId} className="mt-4 text-base font-semibold text-white">
        {title}
      </h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-zinc-400">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </motion.div>
  )
}
