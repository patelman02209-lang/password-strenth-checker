import { motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import { cn } from './utils'

export type PasswordSuggestionListProps = {
  suggestions: string[]
  className?: string
  title?: string
}

export function PasswordSuggestionList({
  suggestions,
  className,
  title = 'Hardening suggestions',
}: PasswordSuggestionListProps) {
  if (!suggestions.length) return null
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <Lightbulb className="h-4 w-4 text-amber-400/90" aria-hidden />
        {title}
      </div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <motion.li
            key={`${s}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex gap-2 text-sm text-zinc-200"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span>{s}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
