import { Ban, BookOpen, Gauge, KeyRound, Lock, ShieldAlert, Timer } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button, Card, PageHeader, PasswordInput } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { cn } from '../ui/utils'

type HashDemoEducation = {
  summary: string
  one_way: string
  salt: string
  work_factor: string
  never_plaintext?: string
  comparison: { aspect: string; bcrypt: string; argon2id: string }[]
  assessment_prompts: string[]
}

type HashDemoResponse = {
  bcrypt: string
  argon2id: string
  bcrypt_hash_time_ms: number
  argon2_hash_time_ms: number
  bcrypt_metadata: {
    cost?: number | null
    variant?: string
    output_char_length: number
  }
  argon2_metadata: {
    variant?: string
    memory_kib?: number
    iterations?: number
    parallelism?: number
    output_char_length: number
  }
  education: HashDemoEducation
  notes: string
}

const NEVER_PLAINTEXT_FALLBACK =
  'Passwords must never be stored in plaintext: anyone with database access could read and reuse every ' +
  'credential immediately. Slow salted hashes let you verify logins without keeping the original secret.'

function EduCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: ReactNode
  title: string
  accent: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet'
  children: ReactNode
}) {
  const ring =
    accent === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-950/15'
      : accent === 'sky'
        ? 'border-sky-500/20 bg-sky-950/15'
        : accent === 'amber'
          ? 'border-amber-500/25 bg-amber-950/15'
          : accent === 'rose'
            ? 'border-rose-500/20 bg-rose-950/15'
            : 'border-violet-500/20 bg-violet-950/15'
  const iconColor =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'sky'
        ? 'text-sky-300'
        : accent === 'amber'
          ? 'text-amber-200'
          : accent === 'rose'
            ? 'text-rose-300'
            : 'text-violet-300'

  return (
    <Card variant="outline" padding="md" className={cn('border text-sm leading-relaxed text-zinc-300', ring)}>
      <div className="flex gap-3">
        <span className={cn('mt-0.5 shrink-0', iconColor)}>{icon}</span>
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{title}</h3>
          <div className="mt-2 space-y-2 text-[13px] leading-relaxed">{children}</div>
        </div>
      </div>
    </Card>
  )
}

function TimingBar({ label, ms, tone, maxMs }: { label: string; ms: number; tone: 'emerald' | 'sky'; maxMs: number }) {
  const pct = maxMs > 0 ? Math.min(100, Math.max(6, (ms / maxMs) * 100)) : 6
  const bar =
    tone === 'emerald'
      ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
      : 'bg-gradient-to-r from-sky-700 to-sky-400'
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className={cn('font-mono text-sm tabular-nums', tone === 'emerald' ? 'text-emerald-300' : 'text-sky-300')}>
          {ms} ms
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10" role="presentation">
        <div className={cn('h-full rounded-full transition-[width] duration-500', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function HashingDemoPanel() {
  const { accessToken } = useAuth()
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` }
  const [pwd, setPwd] = useState('')
  const [out, setOut] = useState<HashDemoResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    setErr(null)
    setBusy(true)
    try {
      const res = await api<HashDemoResponse>('/hash-demo', {
        method: 'POST',
        headers,
        json: { password: pwd },
      })
      setOut(res)
      setPwd('')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const edu = out?.education
  const maxMs = out ? Math.max(out.bcrypt_hash_time_ms, out.argon2_hash_time_ms, 0.01) : 0
  const slower =
    out && out.bcrypt_hash_time_ms >= out.argon2_hash_time_ms
      ? ('bcrypt' as const)
      : out
        ? ('argon2id' as const)
        : null

  return (
    <Card
      variant="glass"
      padding="none"
      motionProps={{
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.2 },
      }}
    >
      <div className="space-y-8 p-6">
        <PageHeader
          title="Hashing demonstration"
          description="Compare bcrypt and Argon2id in one request: wall-clock hashing time, encoded outputs, and how salt and work factor protect passwords at rest."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card variant="outline" padding="md" className="border-violet-500/25 bg-violet-950/20">
            <div className="flex gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
              <div className="text-sm leading-relaxed text-violet-100/90">
                <p className="font-semibold text-white">Learning demonstration only</p>
                <p className="mt-1 text-violet-100/85">
                  This page is for coursework and security awareness. Use only sample passwords you are comfortable
                  sending over HTTPS; do not submit real production secrets here.
                </p>
              </div>
            </div>
          </Card>
          <Card variant="outline" padding="md" className="border-emerald-500/20 bg-emerald-950/15">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
              <div className="text-sm leading-relaxed text-emerald-100/90">
                <p className="font-semibold text-white">Your password is not saved</p>
                <p className="mt-1 text-emerald-100/85">
                  The server hashes the value in memory for this single request. It does not store your plaintext or
                  the generated hash strings in the database — audit logs record algorithm names and millisecond timings
                  only.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card variant="outline" padding="md" className="border-white/10">
          <h2 className="text-sm font-semibold text-white">Run the lab</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Enter a sample password, then generate both hashes. The field clears after a successful run so the secret
            does not linger on screen.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <PasswordInput
              className="min-w-0 flex-1"
              label="Sample password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="off"
              hint="Not stored — sent once to compute bcrypt and Argon2id for this demo."
            />
            <Button
              type="button"
              className="shrink-0"
              disabled={busy || !pwd.trim()}
              onClick={() => void run()}
            >
              {busy ? 'Hashing…' : 'Generate bcrypt & Argon2 hashes'}
            </Button>
          </div>
          {err ? <p className="mt-3 text-sm text-rose-400">{err}</p> : null}
        </Card>

        {out && (
          <div className="space-y-6">
            <Card variant="outline" padding="md" className="border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <Timer className="h-4 w-4 text-amber-300" aria-hidden />
                <h2 className="text-sm font-semibold text-white">Hashing time comparison</h2>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Wall-clock time to derive one hash on the server (CPU and, for Argon2, memory bandwidth). Longer times
                slow offline guessing if hashes leak — tune for your target login latency.
              </p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <TimingBar label="bcrypt" ms={out.bcrypt_hash_time_ms} tone="emerald" maxMs={maxMs} />
                <TimingBar label="Argon2id" ms={out.argon2_hash_time_ms} tone="sky" maxMs={maxMs} />
              </div>
              {slower ? (
                <p className="mt-4 text-xs text-zinc-400">
                  For this run, <span className="font-medium text-zinc-200">{slower}</span> took longer (
                  {slower === 'bcrypt' ? out.bcrypt_hash_time_ms : out.argon2_hash_time_ms} ms vs{' '}
                  {slower === 'bcrypt' ? out.argon2_hash_time_ms : out.bcrypt_hash_time_ms} ms). Relative speed varies
                  with machine load and parameters — compare trends, not single measurements.
                </p>
              ) : null}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card variant="outline" padding="md" className="border-emerald-500/15">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-emerald-100">bcrypt output</h3>
                  <p className="font-mono text-[11px] text-zinc-500">
                    {out.bcrypt_metadata.cost != null ? (
                      <>
                        cost={out.bcrypt_metadata.cost}
                        {out.bcrypt_metadata.variant ? ` · ${out.bcrypt_metadata.variant}` : ''}
                      </>
                    ) : null}
                  </p>
                </div>
                <pre className="mt-2 max-h-44 overflow-auto rounded-lg bg-black/70 p-3 text-[11px] leading-relaxed text-emerald-100">
                  {out.bcrypt}
                </pre>
                <p className="mt-2 text-[10px] text-zinc-500">
                  Length {out.bcrypt_metadata.output_char_length} chars — includes cost, salt, and hash bytes.
                </p>
              </Card>
              <Card variant="outline" padding="md" className="border-sky-500/15">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-sky-100">Argon2id output</h3>
                  <p className="font-mono text-[11px] text-zinc-500">
                    {out.argon2_metadata.memory_kib != null ? (
                      <>
                        m={out.argon2_metadata.memory_kib} KiB, t={out.argon2_metadata.iterations ?? '—'}, p=
                        {out.argon2_metadata.parallelism ?? '—'}
                      </>
                    ) : null}
                  </p>
                </div>
                <pre className="mt-2 max-h-44 overflow-auto rounded-lg bg-black/70 p-3 text-[11px] leading-relaxed text-sky-100">
                  {out.argon2id}
                </pre>
                <p className="mt-2 text-[10px] text-zinc-500">
                  Length {out.argon2_metadata.output_char_length} chars — PHC string encodes parameters and salt.
                </p>
              </Card>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-white">Educational cards</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {edu
              ? 'Expanded copy from the latest successful run is shown below.'
              : 'Run the lab once to pull detailed explanations from the API alongside your timings.'}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <EduCard
              icon={<Ban className="h-5 w-5" aria-hidden />}
              title="Why passwords must never be stored in plaintext"
              accent="rose"
            >
              <p>
                {edu?.never_plaintext ?? NEVER_PLAINTEXT_FALLBACK}
              </p>
            </EduCard>
            <EduCard icon={<KeyRound className="h-5 w-5" aria-hidden />} title="Salt" accent="sky">
              <p>{edu?.salt ?? 'A salt is random per-password data mixed into the hash so identical passwords produce different stored values, defeating rainbow tables and forcing per-hash attacks.'}</p>
            </EduCard>
            <EduCard icon={<Gauge className="h-5 w-5" aria-hidden />} title="Work factor (adaptive cost)" accent="amber">
              <p>
                {edu?.work_factor ??
                  'Adaptive algorithms expose tuning knobs (bcrypt cost, Argon2 memory/time/parallelism) so verification stays slow enough to frustrate offline cracking.'}
              </p>
            </EduCard>
            <EduCard icon={<Lock className="h-5 w-5" aria-hidden />} title="One-way hashing vs encryption" accent="emerald">
              <p>
                {edu?.one_way ??
                  'Password hashes should be one-way: the verifier checks a guess by re-hashing, but the stored string must not be reversible to the password without guessing.'}
              </p>
            </EduCard>
          </div>
        </div>

        {edu ? (
          <EduCard icon={<BookOpen className="h-5 w-5" aria-hidden />} title="What this demo is showing" accent="violet">
            <p>{edu.summary}</p>
          </EduCard>
        ) : null}

        {edu && edu.comparison.length > 0 ? (
          <Card variant="outline" padding="md" className="border-white/10">
            <h2 className="text-sm font-semibold text-white">bcrypt vs Argon2id</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[28rem] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-white/10 bg-black/50 text-zinc-400">
                    <th className="p-2.5 font-medium">Aspect</th>
                    <th className="p-2.5 font-medium text-emerald-200/90">bcrypt</th>
                    <th className="p-2.5 font-medium text-sky-200/90">Argon2id</th>
                  </tr>
                </thead>
                <tbody>
                  {edu.comparison.map((row) => (
                    <tr key={row.aspect} className="border-b border-white/5 align-top text-zinc-300">
                      <td className="p-2.5 text-zinc-400">{row.aspect}</td>
                      <td className="p-2.5">{row.bcrypt}</td>
                      <td className="p-2.5">{row.argon2id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {edu && edu.assessment_prompts.length > 0 ? (
          <Card variant="outline" padding="md" className="border-white/10">
            <h2 className="text-sm font-semibold text-white">Suggested questions for your write-up</h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-[13px] text-zinc-300">
              {edu.assessment_prompts.map((q) => (
                <li key={q} className="leading-relaxed">
                  {q}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        {out ? (
          <p className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-zinc-500">{out.notes}</p>
        ) : null}
      </div>
    </Card>
  )
}
