import { motion } from 'framer-motion'
import { Timer } from 'lucide-react'
import { cn } from './utils'

export type CrackEstimate = {
  human?: string
  seconds?: number
  model?: string
}

export type CrackTimeCardProps = {
  estimate: CrackEstimate | unknown
  className?: string
}

function asEstimate(x: unknown): CrackEstimate {
  if (x && typeof x === 'object' && 'human' in x) {
    const o = x as Record<string, unknown>
    return {
      human: typeof o.human === 'string' ? o.human : undefined,
      seconds: typeof o.seconds === 'number' ? o.seconds : undefined,
      model: typeof o.model === 'string' ? o.model : undefined,
    }
  }
  return {}
}

export function CrackTimeCard({ estimate, className }: CrackTimeCardProps) {
  const e = asEstimate(estimate)
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 rounded-xl border border-white/10 bg-black/40 p-4 ring-1 ring-white/5',
        className,
      )}
    >
      <Timer className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400/90" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Crack horizon (model)</p>
        <p className="mt-1 font-mono text-sm text-cyan-100">{e.human ?? '—'}</p>
        {e.model ? <p className="mt-1 text-[11px] text-zinc-500">Model: {e.model}</p> : null}
      </div>
    </motion.div>
  )
}
