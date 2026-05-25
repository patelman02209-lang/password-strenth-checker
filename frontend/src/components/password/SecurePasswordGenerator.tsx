import { AnimatePresence, motion } from 'framer-motion'
import { Copy, FlaskConical, KeyRound, Layers, Save, Shuffle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Button, Card, CrackTimeCard, EntropyGauge, ErrorState, Input, SecurityScoreCard, StrengthMeter } from '../ui'

export type GenerateOption = {
  password: string
  analysis: {
    entropy_bits: number
    complexity_score: number
    strength_label: string
    is_common: boolean
    patterns: string[]
    suggestions: string[]
    charset_size: number
  }
  crack_estimate: unknown
  constraint_suggestions: string[]
}

type Props = {
  headers: Record<string, string>
  onAnalyzePassword?: (password: string) => void
  onSaveToVault?: (payload: { password: string; suggestedTitle: string }) => void
}

export function SecurePasswordGenerator({ headers, onAnalyzePassword, onSaveToVault }: Props) {
  const { pushToast } = useToast()
  const [mode, setMode] = useState<'random' | 'passphrase'>('random')
  const [length, setLength] = useState(20)
  const [flags, setFlags] = useState({ upper: true, lower: true, digits: true, symbols: true })
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false)
  const [count, setCount] = useState(3)
  const [wordCount, setWordCount] = useState(6)
  const [separator, setSeparator] = useState('-')
  const [capitalizeWords, setCapitalizeWords] = useState(false)
  const [options, setOptions] = useState<GenerateOption[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const anyClass = flags.upper || flags.lower || flags.digits || flags.symbols
  const lengthLabelId = 'gen-length-label'
  const countLabelId = 'gen-count-label'
  const wordSliderLabelId = 'gen-word-slider-label'

  const gen = useCallback(async () => {
    setErr(null)
    if (mode === 'random' && !anyClass) {
      setErr('Enable at least one character class.')
      return
    }
    setLoading(true)
    try {
      const body =
        mode === 'passphrase'
          ? {
              mode: 'passphrase' as const,
              word_count: wordCount,
              separator,
              capitalize_words: capitalizeWords,
              count,
            }
          : {
              mode: 'random' as const,
              length,
              use_upper: flags.upper,
              use_lower: flags.lower,
              use_digits: flags.digits,
              use_symbols: flags.symbols,
              avoid_ambiguous: avoidAmbiguous,
              count,
            }
      const res = await api<{ options: GenerateOption[] }>('/generate', { method: 'POST', headers, json: body })
      setOptions(res.options ?? [])
      pushToast({ variant: 'success', title: 'Generated', message: `${res.options?.length ?? 0} option(s) ready.` })
    } catch (e) {
      setErr((e as Error).message)
      pushToast({ variant: 'error', title: 'Generate failed', message: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [
    anyClass,
    avoidAmbiguous,
    capitalizeWords,
    count,
    flags.digits,
    flags.lower,
    flags.symbols,
    flags.upper,
    headers,
    length,
    mode,
    pushToast,
    separator,
    wordCount,
  ])

  async function copyPassword(pw: string) {
    try {
      await navigator.clipboard.writeText(pw)
      pushToast({ variant: 'success', title: 'Copied', message: 'Password copied to clipboard.' })
    } catch {
      pushToast({ variant: 'error', title: 'Copy failed', message: 'Select the text and copy manually.' })
    }
  }

  const modeDescription = useMemo(
    () =>
      mode === 'random'
        ? 'CSPRNG from enabled character classes. Mint several candidates and compare strength previews.'
        : 'Word-list passphrases — often easier to remember than random strings at similar entropy.',
    [mode],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card variant="glass" padding="md" className="h-fit border-white/10 shadow-lg shadow-black/30">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <KeyRound className="h-4 w-4 text-emerald-400" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Generator</p>
            <p className="text-sm text-zinc-500">{modeDescription}</p>
          </div>
        </div>

        <div className="mt-4 flex rounded-xl border border-white/10 bg-black/30 p-1" role="tablist" aria-label="Generator mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'random'}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === 'random' ? 'bg-emerald-500 text-emerald-950 shadow' : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => setMode('random')}
          >
            Random
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'passphrase'}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === 'passphrase' ? 'bg-emerald-500 text-emerald-950 shadow' : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => setMode('passphrase')}
          >
            Passphrase
          </button>
        </div>

        {mode === 'random' ? (
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label id={lengthLabelId} className="text-sm font-medium text-zinc-300">
                  Length
                </label>
                <output className="font-mono text-sm tabular-nums text-emerald-300" htmlFor="gen-length-slider">
                  {length}
                </output>
              </div>
              <input
                id="gen-length-slider"
                type="range"
                min={8}
                max={128}
                step={1}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
                aria-labelledby={lengthLabelId}
                aria-valuemin={8}
                aria-valuemax={128}
                aria-valuenow={length}
                aria-valuetext={`${length} characters`}
              />
              <p className="mt-1 text-xs text-zinc-600">Between 8 and 128 characters.</p>
            </div>

            <fieldset className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Character classes</legend>
              <ToggleRow id="gen-upper" label="Uppercase (A–Z)" checked={flags.upper} onChange={(v) => setFlags((f) => ({ ...f, upper: v }))} />
              <ToggleRow id="gen-lower" label="Lowercase (a–z)" checked={flags.lower} onChange={(v) => setFlags((f) => ({ ...f, lower: v }))} />
              <ToggleRow id="gen-digits" label="Numbers (0–9)" checked={flags.digits} onChange={(v) => setFlags((f) => ({ ...f, digits: v }))} />
              <ToggleRow id="gen-symbols" label="Symbols (!@#$… )" checked={flags.symbols} onChange={(v) => setFlags((f) => ({ ...f, symbols: v }))} />
              {!anyClass ? <p className="text-xs text-rose-300">Select at least one class to build an alphabet.</p> : null}
            </fieldset>

            <ToggleRow
              id="gen-ambiguous"
              label="Avoid ambiguous characters"
              description="Removes l, o, O, I, 0, 1, and | from pools when enabled."
              checked={avoidAmbiguous}
              onChange={setAvoidAmbiguous}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label id={wordSliderLabelId} className="text-sm font-medium text-zinc-300">
                  Word count
                </label>
                <output className="font-mono text-sm tabular-nums text-emerald-300" htmlFor="gen-word-slider">
                  {wordCount}
                </output>
              </div>
              <input
                id="gen-word-slider"
                type="range"
                min={2}
                max={16}
                step={1}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
                aria-labelledby={wordSliderLabelId}
                aria-valuemin={2}
                aria-valuemax={16}
                aria-valuenow={wordCount}
                aria-valuetext={`${wordCount} words`}
              />
            </div>
            <Input
              label="Separator"
              value={separator}
              onChange={(e) => setSeparator(e.target.value.slice(0, 8))}
              hint="Inserted between words (max 8 characters)."
            />
            <ToggleRow id="gen-capitalize" label="Capitalize each word" checked={capitalizeWords} onChange={setCapitalizeWords} />
          </div>
        )}

        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="flex items-baseline justify-between gap-2">
            <label id={countLabelId} className="text-sm font-medium text-zinc-300">
              Number of options
            </label>
            <output className="font-mono text-sm tabular-nums text-zinc-300" htmlFor="gen-count-slider">
              {count}
            </output>
          </div>
          <input
            id="gen-count-slider"
            type="range"
            min={1}
            max={10}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-cyan-500"
            aria-labelledby={countLabelId}
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={count}
            aria-valuetext={`${count} passwords`}
          />
          <p className="mt-1 text-xs text-zinc-600">Up to 10 candidates per request.</p>
        </div>

        <Button
          type="button"
          className="mt-6 w-full"
          size="lg"
          loading={loading}
          disabled={mode === 'random' && !anyClass}
          leftIcon={<Shuffle className="h-4 w-4" aria-hidden />}
          onClick={() => void gen()}
        >
          Generate
        </Button>

        {err ? (
          <div className="mt-4">
            <ErrorState title="Could not generate" message={err} />
          </div>
        ) : null}
      </Card>

      <div className="min-h-[12rem]">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Layers className="h-4 w-4 text-zinc-500" aria-hidden />
          Candidates
        </div>
        <AnimatePresence mode="popLayout">
          {options.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-14 text-center text-sm text-zinc-500"
            >
              Configure the left panel and press <span className="text-zinc-300">Generate</span> to mint passwords with
              live strength previews.
            </motion.div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
              {options.map((o, i) => (
                <motion.li
                  key={`${o.password}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28, delay: i * 0.04 }}
                  className="list-none"
                >
                  <GeneratedOptionCard
                    option={o}
                    index={i}
                    onCopy={() => void copyPassword(o.password)}
                    onAnalyze={onAnalyzePassword ? () => onAnalyzePassword(o.password) : undefined}
                    onSave={
                      onSaveToVault
                        ? () =>
                            onSaveToVault({
                              password: o.password,
                              suggestedTitle: `Generated ${new Date().toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`,
                            })
                        : undefined
                    }
                  />
                </motion.li>
              ))}
            </ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-1 py-1.5 transition hover:border-white/10 hover:bg-white/[0.03]">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm text-zinc-200">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-zinc-500">{description}</span> : null}
      </label>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border border-white/20 bg-zinc-900 accent-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/50"
      />
    </div>
  )
}

function GeneratedOptionCard({
  option,
  index,
  onCopy,
  onAnalyze,
  onSave,
}: {
  option: GenerateOption
  index: number
  onCopy: () => void
  onAnalyze?: () => void
  onSave?: () => void
}) {
  const a = option.analysis
  return (
    <Card variant="outline" padding="md" className="border-emerald-500/20 bg-black/40 shadow-inner shadow-black/40">
      <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Option {index + 1}</span>
      </div>
      <p className="mt-3 break-all font-mono text-sm leading-relaxed text-emerald-100">{option.password}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden />} onClick={onCopy}>
          Copy
        </Button>
        {onAnalyze ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<FlaskConical className="h-3.5 w-3.5" aria-hidden />}
            onClick={onAnalyze}
          >
            Analyze
          </Button>
        ) : null}
        {onSave ? (
          <Button type="button" size="sm" leftIcon={<Save className="h-3.5 w-3.5" aria-hidden />} onClick={onSave}>
            Save to vault
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <SecurityScoreCard score={a.complexity_score} strengthLabel={a.strength_label} isCommon={a.is_common} className="border-white/10" />
        <StrengthMeter score={a.complexity_score} label={a.strength_label} />
        <EntropyGauge bits={a.entropy_bits} className="rounded-xl border border-white/5 bg-black/30 p-3" />
        <CrackTimeCard estimate={option.crack_estimate} className="bg-black/30" />
        {option.constraint_suggestions.length > 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
            <p className="font-semibold text-amber-200/90">Generator hints</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-100/85">
              {option.constraint_suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
