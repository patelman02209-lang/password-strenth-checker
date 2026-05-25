import { Loader2 } from 'lucide-react'

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--psc-bg)] px-6 text-zinc-300">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-400" aria-hidden />
      <p className="text-sm font-medium tracking-wide">{label}</p>
    </div>
  )
}
