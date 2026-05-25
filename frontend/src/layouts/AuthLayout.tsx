import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import type { ReactNode } from 'react'
import { MeshBackground } from '../components/layout/MeshBackground'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--psc-bg)] text-zinc-100">
      <MeshBackground />
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-3 text-center"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_32px_-8px_rgba(16,185,129,0.5)]">
            <Shield className="h-6 w-6 text-emerald-400" aria-hidden />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-400/90">
              Command center
            </p>
            <p className="text-sm font-medium text-zinc-300">Password security operations</p>
          </div>
        </motion.div>
        {children}
      </div>
    </div>
  )
}
