import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react'
import { cn } from './utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftSlot, rightSlot, className, id: idProp, ...rest },
  ref,
) {
  const gen = useId()
  const id = idProp ?? gen
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          'mt-1 flex items-stretch overflow-hidden rounded-xl border bg-black/35 transition',
          error ? 'border-rose-500/50 ring-1 ring-rose-500/25' : 'border-white/10 focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20',
          label ? '' : 'mt-0',
        )}
      >
        {leftSlot ? (
          <span className="flex items-center border-r border-white/10 bg-black/30 px-3 text-zinc-500">
            {leftSlot}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            'min-h-[2.75rem] w-full flex-1 border-0 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600',
            className,
          )}
          {...rest}
        />
        {rightSlot ? (
          <span className="flex items-center border-l border-white/10 bg-black/30 px-2">{rightSlot}</span>
        ) : null}
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})
