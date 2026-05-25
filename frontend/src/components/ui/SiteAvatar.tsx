import { cn } from './utils'

export type SiteAvatarProps = {
  title: string
  websiteUrl?: string | null
  className?: string
}

function initials(title: string, websiteUrl?: string | null): string {
  try {
    if (websiteUrl) {
      const host = new URL(websiteUrl).hostname.replace(/^www\./, '')
      const parts = host.split('.').filter(Boolean)
      const core = parts[0] || host
      if (core.length >= 2) return core.slice(0, 2).toUpperCase()
      if (core.length === 1) return (core + (parts[1]?.[0] ?? '·')).slice(0, 2).toUpperCase()
    }
  } catch {
    /* ignore */
  }
  const t = title.trim()
  if (t.length >= 2) return t.slice(0, 2).toUpperCase()
  if (t.length === 1) return `${t}·`.toUpperCase()
  return '??'
}

export function SiteAvatar({ title, websiteUrl, className }: SiteAvatarProps) {
  const text = initials(title, websiteUrl)
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-emerald-500/25 via-zinc-900/80 to-cyan-500/20 text-[11px] font-bold tracking-tight text-emerald-50 shadow-inner shadow-black/40',
        className,
      )}
      aria-hidden
    >
      {text}
    </div>
  )
}
