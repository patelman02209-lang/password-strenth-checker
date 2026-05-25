import { Loader2 } from 'lucide-react'

export function InlineLoader({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" aria-hidden />
      {label ? <span>{label}</span> : null}
    </span>
  )
}
