import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Input } from './Input'
import { cn } from './utils'

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  hint?: string
  error?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, label, hint, error, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      ref={ref}
      label={label}
      hint={hint}
      error={error}
      type={visible ? 'text' : 'password'}
      autoComplete={rest.autoComplete ?? 'current-password'}
      className={cn('font-mono tracking-wide', className)}
      rightSlot={
        <button
          type="button"
          className="flex h-full min-h-[2.75rem] items-center px-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
      {...rest}
    />
  )
})
