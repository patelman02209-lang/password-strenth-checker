import { motion } from 'framer-motion'
import { Copy, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from './Badge'
import { Button } from './Button'
import { SiteAvatar } from './SiteAvatar'
import { cn } from './utils'

function strengthBadgeVariant(label: string | null | undefined): 'danger' | 'warning' | 'success' | 'info' {
  const k = (label ?? '').trim().toLowerCase()
  if (k === 'very_weak' || k === 'weak') return 'danger'
  if (k === 'moderate') return 'warning'
  if (k === 'strong' || k === 'very_strong') return 'success'
  return 'info'
}

export type CredentialCardProps = {
  title: string
  websiteUrl?: string | null
  username?: string | null
  notes?: string | null
  strengthLabel?: string | null
  lastCheckedAt?: string | null
  passwordReuseWarning?: boolean
  passwordReuseGroupSize?: number
  passwordStale?: boolean
  passwordRotationMaxAgeDays?: number
  isBreached?: boolean
  revealedPassword?: string | null
  /** Shown when the password is visible (e.g. auto-hide countdown). */
  revealHint?: string | null
  onReveal: () => void
  onHide: () => void
  onCopyPassword?: () => void | Promise<void>
  onViewDetails?: () => void
  onEdit: () => void
  onDelete: () => void
  onCheckStrength: () => void
  /** Larger avatar for detail layout. */
  avatarSize?: 'md' | 'lg'
  /** Shown below the action row (e.g. strength analysis JSON). */
  footer?: ReactNode
  className?: string
}

export function CredentialCard({
  title,
  websiteUrl,
  username,
  notes,
  strengthLabel,
  lastCheckedAt,
  passwordReuseWarning = false,
  passwordReuseGroupSize,
  passwordStale = false,
  passwordRotationMaxAgeDays,
  isBreached = false,
  revealedPassword,
  revealHint,
  onReveal,
  onHide,
  onCopyPassword,
  onViewDetails,
  onEdit,
  onDelete,
  onCheckStrength,
  avatarSize = 'md',
  footer,
  className,
}: CredentialCardProps) {
  const masked = revealedPassword == null
  const badgeVariant = strengthBadgeVariant(strengthLabel)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-white/10 bg-black/45 p-4 text-sm shadow-inner shadow-black/30 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex gap-3">
        <SiteAvatar
          title={title}
          websiteUrl={websiteUrl}
          className={avatarSize === 'lg' ? 'h-14 w-14 text-sm' : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-white">{title}</p>
              {websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                >
                  {websiteUrl}
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </a>
              ) : null}
              <p className="text-xs text-zinc-400">{username || '—'}</p>
              {notes ? (
                <p className="mt-1 max-h-20 overflow-y-auto text-xs leading-relaxed text-zinc-300">{notes}</p>
              ) : null}
            </div>
            <div className="text-right text-xs text-zinc-500">
              {strengthLabel ? (
                <p className="flex flex-wrap items-center justify-end gap-1">
                  <span className="hidden sm:inline">Strength</span>
                  <Badge variant={badgeVariant} className="normal-case tracking-normal">
                    {strengthLabel.replace(/_/g, ' ')}
                  </Badge>
                </p>
              ) : (
                <Badge variant="default" className="normal-case tracking-normal">
                  Not analyzed
                </Badge>
              )}
              {lastCheckedAt ? (
                <p className="mt-1 max-w-[11rem] text-right leading-snug">
                  Last checked:{' '}
                  {new Date(lastCheckedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              ) : null}
            </div>
          </div>

          {passwordReuseWarning || passwordStale || isBreached ? (
            <ul className="mt-2 space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-950/15 px-3 py-2 text-[11px] text-amber-100/95" role="list">
              {passwordReuseWarning ? (
                <li>
                  <span className="font-semibold text-amber-200">Reuse:</span> same password as {passwordReuseGroupSize ?? 2}{' '}
                  entries — use a unique secret for this site.
                </li>
              ) : null}
              {passwordStale ? (
                <li>
                  <span className="font-semibold text-amber-200">Rotation:</span> password older than recommended{' '}
                  {passwordRotationMaxAgeDays ?? 180} days — schedule an update.
                </li>
              ) : null}
              {isBreached ? (
                <li>
                  <span className="font-semibold text-rose-200">Breach signal:</span> last analysis matched breach corpora —
                  rotate if still in use.
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Secret</span>
            {masked ? (
              <>
                <span className="font-mono text-xs text-zinc-500">••••••••</span>
                <Button type="button" variant="ghost" size="sm" className="text-sky-300 hover:text-sky-100" onClick={onReveal}>
                  Reveal
                </Button>
              </>
            ) : (
              <>
                <code className="max-w-[min(100%,28rem)] truncate rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] text-emerald-200">
                  {revealedPassword}
                </code>
                <Button type="button" variant="ghost" size="sm" onClick={onHide}>
                  Hide
                </Button>
                {revealHint ? <span className="text-[11px] text-amber-200/90">{revealHint}</span> : null}
              </>
            )}
            {onCopyPassword ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden />}
                onClick={() => void onCopyPassword()}
              >
                Copy
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={onCheckStrength}>
              Re-check
            </Button>
            {onViewDetails ? (
              <Button type="button" variant="secondary" size="sm" onClick={onViewDetails}>
                View
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>
      {footer ? <div className="mt-3 border-t border-white/5 pt-3">{footer}</div> : null}
    </motion.li>
  )
}
