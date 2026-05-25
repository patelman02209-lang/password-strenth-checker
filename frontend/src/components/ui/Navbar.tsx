import type { ReactNode } from 'react'
import { cn } from './utils'

export type NavbarProps = {
  left?: ReactNode
  center?: ReactNode
  right?: ReactNode
  bottom?: ReactNode
  className?: string
}

export function Navbar({ left, center, right, bottom, className }: NavbarProps) {
  return (
    <header className={cn('border-b border-white/10 bg-zinc-950/50 backdrop-blur-xl', className)}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">{left}</div>
        {center ? <div className="order-last w-full flex-none sm:order-none sm:w-auto">{center}</div> : null}
        <div className="flex shrink-0 items-center gap-2">{right}</div>
      </div>
      {bottom ? (
        <div className="mx-auto w-full max-w-6xl border-t border-white/5 px-4 py-3">{bottom}</div>
      ) : null}
    </header>
  )
}
