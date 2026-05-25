import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { Badge } from './Badge'
import { cn } from './utils'

export type SecurityScoreCardProps = {
  score: number
  strengthLabel: string
  isCommon?: boolean
  className?: string
}

export function SecurityScoreCard({ score, strengthLabel, isCommon, className }: SecurityScoreCardProps) {
  const labelKey = strengthLabel.trim().toLowerCase()
  let badgeVariant: 'danger' | 'warning' | 'success' = 'success'
  if (isCommon || labelKey === 'very_weak' || labelKey === 'weak') badgeVariant = 'danger'
  else if (labelKey === 'moderate') badgeVariant = 'warning'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-black/40 to-cyan-500/10 p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <Shield className="h-5 w-5 text-emerald-400" aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Security score</p>
            <p className="text-2xl font-bold tabular-nums text-white">{Math.round(score)}</p>
          </div>
        </div>
        <Badge variant={badgeVariant} className="max-w-[10rem] truncate normal-case tracking-normal">
          {strengthLabel.replace(/_/g, ' ')}
        </Badge>
      </div>
      {isCommon ? (
        <p className="mt-3 text-xs text-amber-200/90">Flagged as a high-frequency password in the local corpus.</p>
      ) : null}
    </motion.div>
  )
}
