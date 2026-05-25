import { motion } from 'framer-motion'
import { cn } from './utils'

export type EntropyGaugeProps = {
  bits: number
  /** Upper bound for the gauge scale (visual only). */
  maxBits?: number
  className?: string
}

export function EntropyGauge({ bits, maxBits = 128, className }: EntropyGaugeProps) {
  const safe = Number.isFinite(bits) ? bits : 0
  const pct = Math.max(0, Math.min(100, (safe / maxBits) * 100))
  const stroke =
    pct < 30 ? '#f87171' : pct < 55 ? '#fbbf24' : pct < 75 ? '#34d399' : '#2dd4bf'

  const r = 36
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(63,63,70,0.6)" strokeWidth="10" />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: `${dash} ${c}` }}
            transition={{ type: 'spring', stiffness: 80, damping: 16 }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-bold tabular-nums text-white">
            {Number.isFinite(bits) ? (Number.isInteger(bits) ? bits : bits.toFixed(1)) : '—'}
          </span>
          <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">bits</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Shannon-style upper bound</p>
        <p className="mt-1 text-sm text-zinc-300">
          Higher entropy widens the search space for naive brute-force models. Real attacks use dictionaries and
          leaked corpora.
        </p>
      </div>
    </div>
  )
}
