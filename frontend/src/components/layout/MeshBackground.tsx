import { motion } from 'framer-motion'
import { useContext } from 'react'
import { ThemeContext } from '../../context/ThemeContext'

/** Full-viewport cyber mesh + softly drifting neon gradients (dark command center). */
export function MeshBackground() {
  const ctx = useContext(ThemeContext)
  const theme = ctx?.theme ?? 'dark'
  const dim = theme === 'light' ? 'opacity-50' : 'opacity-100'
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${dim}`} aria-hidden>
      <motion.div
        className="absolute -left-1/4 top-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-[120px]"
        animate={{ x: [0, 24, 0], y: [0, -18, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-1/4 top-1/3 h-[26rem] w-[26rem] rounded-full bg-cyan-500/12 blur-[110px]"
        animate={{ x: [0, -20, 0], y: [0, 14, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[22rem] w-[36rem] rounded-full bg-violet-600/10 blur-[100px]"
        animate={{ x: [0, -12, 0], y: [0, -22, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
        animate={{ backgroundPosition: ['0px 0px', '48px 48px', '0px 0px'] }}
        transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}
