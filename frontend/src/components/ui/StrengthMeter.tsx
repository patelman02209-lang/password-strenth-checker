import { motion, useReducedMotion } from 'framer-motion'
import { cn } from './utils'

const LABELS: Record<string, string> = {
  very_weak: 'Very weak',
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
  very_strong: 'Very strong',
  empty: 'Empty',
}

export type StrengthMeterProps = {
  score: number
  label: string
  className?: string
  caption?: string
}

export function StrengthMeter({ score, label, className, caption }: StrengthMeterProps) {
  const reduceMotion = useReducedMotion()
  const pct = Math.max(0, Math.min(100, score))
  const hue =
    pct < 35 ? 'from-rose-500 to-orange-400' : pct < 55 ? 'from-amber-400 to-yellow-300' : 'from-emerald-400 to-teal-300'
  const labelText = LABELS[label] ?? label
  return (
    <div
      className={cn('space-y-2', className)}
      role="group"
      aria-label={`Password strength: ${labelText}, complexity ${Math.round(pct)} of 100`}
    >
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-medium uppercase tracking-wide text-zinc-500">Strength</span>
        <span className="font-medium text-zinc-100">{labelText}</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-zinc-800/90 ring-1 ring-white/5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`Complexity score ${Math.round(pct)} out of 100`}
      >
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', hue)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={
            reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 120, damping: 18 }
          }
        />
      </div>
      <p className="text-right text-xs text-zinc-500">
        {caption ?? `${pct} / 100 complexity`}
      </p>
    </div>
  )
}
