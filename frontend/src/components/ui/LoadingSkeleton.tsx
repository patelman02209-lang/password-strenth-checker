import { cn } from './utils'

export type LoadingSkeletonProps = {
  lines?: number
  className?: string
}

export function LoadingSkeleton({ lines = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded-full bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800"
          style={{ width: `${68 + ((i * 17) % 24)}%` }}
        />
      ))}
    </div>
  )
}
