import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from './utils'

export type SidebarItem = {
  id: string
  label: string
  icon?: ReactNode
  badge?: ReactNode
}

export type SidebarProps = {
  title?: string
  items: SidebarItem[]
  activeId: string
  onSelect: (id: string) => void
  className?: string
  /** Collapse to icons only on wide screens. */
  collapsed?: boolean
}

export function Sidebar({ title, items, activeId, onSelect, className, collapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex w-full flex-col gap-1 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-md md:w-56',
        collapsed && 'md:w-[4.5rem]',
        className,
      )}
      aria-label="Section navigation"
    >
      {title ? (
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      ) : null}
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = it.id === activeId
          return (
            <motion.button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                active
                  ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
                collapsed && 'md:justify-center md:px-0',
              )}
            >
              {it.icon ? <span className="shrink-0 text-zinc-500">{it.icon}</span> : null}
              <span className={cn('min-w-0 flex-1 truncate font-medium', collapsed && 'md:sr-only')}>
                {it.label}
              </span>
              {it.badge && !collapsed ? <span className="shrink-0">{it.badge}</span> : null}
            </motion.button>
          )
        })}
      </nav>
    </aside>
  )
}
