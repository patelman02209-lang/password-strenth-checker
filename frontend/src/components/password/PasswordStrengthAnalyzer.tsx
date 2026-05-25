import { AnimatePresence, motion } from 'framer-motion'
import axios from 'axios'
import { BookOpen, ChevronDown, ShieldAlert, Skull, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, startTransition, type ReactNode } from 'react'
import { api } from '../../lib/api'
import {
  Badge,
  Button,
  Card,
  CrackTimeCard,
  EmptyState,
  EntropyGauge,
  ErrorState,
  LoadingSkeleton,
  PasswordInput,
  PasswordSuggestionList,
  SecurityScoreCard,
  StrengthMeter,
} from '../ui'

const MAX_PASSWORD_LEN = 4096
const DEBOUNCE_MS = 520

export type PasswordAnalyzeResult = {
  entropy_bits: number
  complexity_score: number
  strength_label: string
  is_common: boolean
  patterns: string[]
  suggestions: string[]
  charset_size: number
  crack_estimate: unknown
  is_breached: boolean
  breach_count: number
  breach_source?: string
  hibp_ok?: boolean
  hibp_error?: string | null
  local_breach_checked?: boolean
}

function patternBadgeVariant(p: string): 'danger' | 'warning' | 'info' | 'default' {
  const s = p.toLowerCase()
  if (s.includes('common') || s.includes('dictionary') || s.includes('breach')) return 'danger'
  if (s.includes('keyboard') || s.includes('sequential') || s.includes('repeat') || s.includes('date')) return 'warning'
  if (s.includes('length') || s.includes('charset')) return 'info'
  return 'default'
}

function formatPatternLabel(p: string): string {
  return p.replace(/_/g, ' ')
}

type Props = {
  headers: Record<string, string>
  /** Optional callback when user wants the dedicated HIBP tab. */
  onOpenHibpTab?: () => void
  /** When ``nonce`` changes, password field is set (e.g. from generator “Analyze”). */
  importRequest?: { password: string; nonce: number } | null
  onImportConsumed?: () => void
}

export function PasswordStrengthAnalyzer({ headers, onOpenHibpTab, importRequest, onImportConsumed }: Props) {
  const [password, setPassword] = useState('')
  const [data, setData] = useState<PasswordAnalyzeResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!importRequest?.password) return
    startTransition(() => {
      setPassword(importRequest.password)
    })
    onImportConsumed?.()
  }, [importRequest?.nonce, importRequest?.password, onImportConsumed])

  const runAnalyze = useCallback(
    async (pwd: string, signal: AbortSignal) => {
      setErr(null)
      setLoading(true)
      try {
        const res = await api<PasswordAnalyzeResult>('/analyze', {
          method: 'POST',
          headers,
          json: { password: pwd },
          signal,
        })
        if (!signal.aborted) setData(res)
      } catch (e) {
        if (axios.isAxiosError(e) && (e.code === 'ERR_CANCELED' || (e as Error).name === 'CanceledError')) return
        if (signal.aborted) return
        setData(null)
        setErr((e as Error).message)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [headers],
  )

  useEffect(() => {
    const trimmed = password.trim()
    if (!trimmed) {
      abortRef.current?.abort()
      startTransition(() => {
        setData(null)
        setErr(null)
        setLoading(false)
      })
      return
    }
    if (password.length > MAX_PASSWORD_LEN) {
      startTransition(() => {
        setErr(`Password exceeds maximum length (${MAX_PASSWORD_LEN} characters).`)
        setData(null)
      })
      return
    }

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const t = window.setTimeout(() => {
      void runAnalyze(password, ac.signal)
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [password, runAnalyze])

  async function analyzeNow() {
    const trimmed = password.trim()
    if (!trimmed) {
      setErr('Enter a password to analyze.')
      return
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    await runAnalyze(password, ac.signal)
  }

  const patterns = data?.patterns ?? []
  const hasPayload = Boolean(password.trim())

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-4">
        <Card variant="outline" padding="md" className="border-amber-500/25 bg-amber-950/15">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <div className="min-w-0 text-sm leading-relaxed text-amber-100/90">
              <p className="font-semibold text-amber-50">Analysis privacy</p>
              <p className="mt-1 text-amber-100/85">
                Your password is evaluated <strong className="text-white">in memory only</strong> for this check. It is{' '}
                <strong className="text-white">not stored</strong> as plaintext: the API persists anonymized metrics
                only (scores, labels, pattern names, breach flags) for coursework auditing—never the secret itself.
              </p>
            </div>
          </div>
        </Card>

        <div>
          <PasswordInput
            label="Password under test"
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\r?\n/g, ''))}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-sm"
            placeholder="Type or paste a candidate password…"
            hint="Live analysis runs after a short pause. The visibility toggle only changes local display."
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              {password.length} / {MAX_PASSWORD_LEN} characters
            </span>
            <span className="text-zinc-600">Live analysis after you pause typing (~{DEBOUNCE_MS / 1000}s).</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void analyzeNow()} loading={loading}>
            Analyze now
          </Button>
          {onOpenHibpTab ? (
            <Button type="button" variant="secondary" onClick={onOpenHibpTab}>
              Deep breach tools
            </Button>
          ) : null}
        </div>

        {err ? <ErrorState title="Analysis failed" message={err} /> : null}

        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Learn more</p>
          <EducationalPanel
            title="Entropy vs. guessability"
            icon={<Sparkles className="h-4 w-4 text-cyan-400" aria-hidden />}
          >
            Entropy bits approximate the size of a naive brute-force search space given an alphabet model. Real attackers
            use dictionaries, rules, and leaked corpora—so a high score is necessary but not sufficient for safety.
          </EducationalPanel>
          <EducationalPanel
            title="HIBP in this workspace"
            icon={<Skull className="h-4 w-4 text-rose-400" aria-hidden />}
          >
            The Have I Been Pwned k-anonymity range API sends only a SHA-1 prefix over TLS; the server never sees your
            full hash in the request body. A positive match means the exact password appeared in public breach dumps—
            treat it as compromised.
          </EducationalPanel>
          <EducationalPanel
            title="Crack time estimates"
            icon={<BookOpen className="h-4 w-4 text-violet-400" aria-hidden />}
          >
            Crack horizons are simplified offline models (guesses per second × entropy). Nation-states, GPU farms, and
            reused passwords break these assumptions—use them for relative comparison, not guarantees.
          </EducationalPanel>
        </div>
      </div>

      <div className="relative min-h-[12rem] space-y-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.12] via-black/50 to-sky-500/10 p-4 md:p-5">
        <AnimatePresence mode="wait">
          {!hasPayload ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <EmptyState
                title="Signal idle"
                description="Enter a password to stream entropy, complexity scoring, pattern heuristics, HIBP range results, and modeled crack horizons."
              />
            </motion.div>
          ) : loading && !data ? (
            <motion.div
              key="skel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 p-2"
            >
              <LoadingSkeleton lines={5} />
              <p className="text-center text-xs text-zinc-500">Running analyzer pipeline…</p>
            </motion.div>
          ) : data ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <SecurityScoreCard
                  score={data.complexity_score}
                  strengthLabel={data.strength_label}
                  isCommon={data.is_common}
                  className="sm:col-span-2"
                />
                <StrengthMeter
                  score={data.complexity_score}
                  label={data.strength_label}
                  caption={`${Math.round(data.complexity_score)} / 100 complexity · ${data.strength_label.replace(/_/g, ' ')}`}
                />
                <EntropyGauge bits={data.entropy_bits} />
              </div>

              <ComplexityStrip score={data.complexity_score} label={data.strength_label} />

              <Card variant="outline" padding="md" className="border-white/10 bg-black/35">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Heuristic model</p>
                <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">Charset size</dt>
                    <dd className="font-mono text-sm text-white">{data.charset_size}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Entropy (bits)</dt>
                    <dd className="font-mono text-sm text-emerald-200">{data.entropy_bits.toFixed(1)}</dd>
                  </div>
                </dl>
              </Card>

              <PatternSection patterns={patterns} isCommon={data.is_common} />

              <HibpResultCard data={data} />

              <CrackTimeCard estimate={data.crack_estimate} />

              <PasswordSuggestionList suggestions={data.suggestions} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {loading && data ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-zinc-950/40 backdrop-blur-[2px]"
            aria-busy="true"
            aria-label="Refreshing analysis"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EducationalPanel({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <details className="group rounded-xl border border-white/10 bg-black/25 open:border-emerald-500/25 open:bg-emerald-950/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-200 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40">
          {icon}
        </span>
        {title}
        <ChevronDown
          className="ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-white/5 px-3 py-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </details>
  )
}

function ComplexityStrip({ score, label }: { score: number; label: string }) {
  const stages = ['very_weak', 'weak', 'moderate', 'strong', 'very_strong'] as const
  const order = stages.indexOf(label as (typeof stages)[number])
  const activeIdx = order >= 0 ? order : Math.min(stages.length - 1, Math.max(0, Math.floor(score / 20)))
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Strength scale</p>
      <div className="mt-2 flex gap-1">
        {stages.map((s, i) => {
          const done = i <= activeIdx
          const hue = i < 2 ? 'bg-rose-500/80' : i === 2 ? 'bg-amber-400/90' : 'bg-emerald-400/90'
          return (
            <motion.div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${done ? hue : 'bg-zinc-800'}`}
              initial={false}
              animate={{ scaleY: done ? [1, 1.25, 1] : 1 }}
              transition={{ duration: 0.35 }}
              title={s.replace(/_/g, ' ')}
            />
          )
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">
        Score {Math.round(score)}/100 · {label.replace(/_/g, ' ')}
      </p>
    </div>
  )
}

function PatternSection({ patterns, isCommon }: { patterns: string[]; isCommon: boolean }) {
  return (
    <Card variant="outline" padding="md" className="border-white/10 bg-black/35">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Pattern & structure warnings</p>
        {isCommon ? (
          <Badge variant="danger" className="normal-case tracking-normal">
            Common / dictionary list
          </Badge>
        ) : null}
      </div>
      {patterns.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Detected patterns">
          {patterns.map((p) => (
            <li key={p}>
              <Badge variant={patternBadgeVariant(p)} className="normal-case tracking-normal">
                {formatPatternLabel(p)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-emerald-200/90">No structural patterns flagged by the heuristic engine.</p>
      )}
      {isCommon ? (
        <p className="mt-3 text-sm text-rose-200/90">
          This password appears in a local high-frequency corpus—attackers try these first. Prefer a unique phrase or
          generated secret.
        </p>
      ) : null}
    </Card>
  )
}

function HibpResultCard({ data }: { data: PasswordAnalyzeResult }) {
  const breached = data.is_breached
  const count = data.breach_count ?? 0
  const source = data.breach_source ?? 'unknown'
  const hibpOk = data.hibp_ok
  const hibpErr = data.hibp_error

  let tone: 'danger' | 'success' | 'warning' = 'success'
  let title = 'Breach corpora'
  let body: ReactNode

  if (breached) {
    tone = 'danger'
    title = 'Exposed in breach data'
    body = (
      <>
        This exact password matched public breach material (count ≥ <strong className="text-white">{count}</strong>
        ). Source: <span className="font-mono text-zinc-200">{source}</span>. Assume it is known to attackers—rotate it
        everywhere it was reused.
      </>
    )
  } else if (hibpOk) {
    body = (
      <>
        No k-anonymity range match in Have I Been Pwned for this password, and offline checks did not flag it. Source:{' '}
        <span className="font-mono text-zinc-200">{source}</span>. This does not prove secrecy—only that it was not in
        the consulted dumps.
      </>
    )
  } else {
    tone = 'warning'
    title = 'Breach check incomplete'
    body = (
      <>
        HIBP could not be reached or returned an error
        {hibpErr ? (
          <>
            : <span className="font-mono text-zinc-300">{hibpErr}</span>
          </>
        ) : null}
        . {data.local_breach_checked ? 'A local fallback list was consulted.' : ''} Treat exposure as unknown until you
        can re-check.
      </>
    )
  }

  const border =
    tone === 'danger'
      ? 'border-rose-500/35 bg-rose-950/25'
      : tone === 'warning'
        ? 'border-amber-500/35 bg-amber-950/20'
        : 'border-emerald-500/30 bg-emerald-950/15'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${border}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{body}</p>
    </motion.div>
  )
}
