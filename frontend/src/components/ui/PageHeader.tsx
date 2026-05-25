import type { ReactNode } from 'react'
import { cn } from './utils'

export type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-400/90">{eyebrow}</p>
        ) : null}
        <h2 className={cn('text-xl font-semibold text-white', eyebrow && 'mt-1')}>{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
