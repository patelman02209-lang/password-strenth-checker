/* eslint-disable react-refresh/only-export-components -- hook paired with provider */
import { AnimatePresence } from 'framer-motion'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ToastFrame, ToastStack, type ToastVariant } from '../components/ui/Toast'

export type ToastItem = {
  id: string
  title?: string
  message: string
  variant: ToastVariant
}

type ToastContextValue = {
  pushToast: (t: Omit<ToastItem, 'id'> & { id?: string }) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const pushToast = useCallback((t: Omit<ToastItem, 'id'> & { id?: string }) => {
    const id = t.id ?? crypto.randomUUID()
    setItems((prev) => [...prev, { id, title: t.title, message: t.message, variant: t.variant }])
    window.setTimeout(() => dismiss(id), 6500)
  }, [dismiss])

  const value = useMemo(() => ({ pushToast, dismiss }), [pushToast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack>
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <ToastFrame key={t.id} {...t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </ToastStack>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export type { ToastVariant } from '../components/ui/Toast'
