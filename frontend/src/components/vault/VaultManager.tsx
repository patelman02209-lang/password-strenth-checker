import { ArrowLeft, Download, FileText, Lock, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Button,
  Card,
  ConfirmDialog,
  CredentialCard,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PasswordInput,
} from '../ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { api } from '../../lib/api'
import { downloadAuthenticatedBlob } from '../../lib/downloadBlob'
import type { VaultSecurityReport } from '../../lib/vaultSecurityPdf'
import { downloadVaultSecurityPdf } from '../../lib/vaultSecurityPdf'
import { VAULT_REVEAL_AUTO_HIDE_MS } from './vault-utils'

export type VaultItem = {
  id: number
  title: string
  account_username?: string | null
  notes?: string | null
  website_url?: string | null
  strength_label?: string | null
  last_checked_at?: string | null
  entropy_bits?: number | null
  complexity_score?: number | null
  is_breached?: boolean
  password_set_at?: string | null
  password_age_days?: number | null
  password_stale?: boolean
  password_reuse_group_size?: number
  password_reuse_warning?: boolean
  password_rotation_max_age_days?: number
  password: string | null
  password_hidden: boolean
}

type StrengthCheckResponse = {
  strength_label: string
  complexity_score: number
  entropy_bits: number
  patterns: string[]
  suggestions: string[]
  crack_estimate: unknown
  last_checked_at: string | null
  is_breached?: boolean
}

type VaultPage = 'list' | 'add' | 'view' | 'edit'

function parseVaultRoute(sp: URLSearchParams): { page: VaultPage; itemId?: number } {
  const mode = sp.get('vaultMode')
  const raw = sp.get('vaultItem')
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : undefined
  if (mode === 'add') return { page: 'add' }
  if (id != null && mode === 'edit') return { page: 'edit', itemId: id }
  if (id != null) return { page: 'view', itemId: id }
  return { page: 'list' }
}

type Props = {
  importRequest?: { password: string; title?: string; nonce: number } | null
  onImportConsumed?: () => void
}

function VaultEditForm({
  item,
  headers,
  onCancel,
  onSaved,
}: {
  item: VaultItem
  headers: Record<string, string>
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const { pushToast } = useToast()
  const [editTitle, setEditTitle] = useState(item.title)
  const [editAcct, setEditAcct] = useState(item.account_username ?? '')
  const [editNotes, setEditNotes] = useState(item.notes ?? '')
  const [editUrl, setEditUrl] = useState(item.website_url ?? '')
  const [editPassword, setEditPassword] = useState('')
  const [formErr, setFormErr] = useState<string | null>(null)

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    setFormErr(null)
    const json: Record<string, string> = {
      title: editTitle,
      account_username: editAcct,
      notes: editNotes,
      website_url: editUrl,
    }
    if (editPassword.trim()) json.password = editPassword
    try {
      await api(`/vault/items/${item.id}`, { method: 'PATCH', headers, json })
      await onSaved()
      pushToast({ variant: 'success', title: 'Updated', message: 'Credential changes saved.' })
    } catch (err) {
      setFormErr((err as Error).message)
    }
  }

  return (
    <>
      {formErr ? <p className="mb-4 text-sm text-rose-400">{formErr}</p> : null}
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => void saveEdit(e)}>
        <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
        <Input label="Username" value={editAcct} onChange={(e) => setEditAcct(e.target.value)} />
        <Input className="md:col-span-2" label="Website URL" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
        <div className="md:col-span-2">
          <label htmlFor="vault-edit-notes" className="block text-sm font-medium text-zinc-300">
            Notes
          </label>
          <textarea
            id="vault-edit-notes"
            className="mt-1 min-h-[88px] w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none ring-emerald-500/30 focus:ring-2"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </div>
        <PasswordInput
          className="md:col-span-2"
          label="New password (optional)"
          value={editPassword}
          onChange={(e) => setEditPassword(e.target.value)}
          autoComplete="new-password"
          hint="Only sent if you type a new value; otherwise the stored secret is unchanged."
        />
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Button type="submit">Save changes</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  )
}

export function VaultManager({ importRequest, onImportConsumed }: Props) {
  const { accessToken } = useAuth()
  const { pushToast } = useToast()
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` }
  const [searchParams, setSearchParams] = useSearchParams()

  const route = useMemo(() => parseVaultRoute(searchParams), [searchParams])

  const navigateVault = useCallback(
    (next: { page: VaultPage; itemId?: number }) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', 'vault')
          if (next.page === 'list') {
            p.delete('vaultMode')
            p.delete('vaultItem')
          } else if (next.page === 'add') {
            p.set('vaultMode', 'add')
            p.delete('vaultItem')
          } else if (next.page === 'view' && next.itemId != null) {
            p.delete('vaultMode')
            p.set('vaultItem', String(next.itemId))
          } else if (next.page === 'edit' && next.itemId != null) {
            p.set('vaultMode', 'edit')
            p.set('vaultItem', String(next.itemId))
          }
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const [items, setItems] = useState<VaultItem[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [revealedPw, setRevealedPw] = useState<Record<number, string>>({})
  const revealTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const [strengthOpen, setStrengthOpen] = useState<Record<number, StrengthCheckResponse>>({})
  const [title, setTitle] = useState('')
  const [acct, setAcct] = useState('')
  const [notes, setNotes] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [revealConfirmId, setRevealConfirmId] = useState<number | null>(null)
  const [vaultInsight, setVaultInsight] = useState<Pick<
    VaultSecurityReport,
    'reuse_clusters' | 'health_score' | 'password_rotation_max_age_days'
  > | null>(null)

  const activeItem = useMemo(
    () => (route.itemId != null ? items.find((i) => i.id === route.itemId) : undefined),
    [items, route.itemId],
  )

  useEffect(() => {
    if (!importRequest?.password) return
    startTransition(() => {
      setPassword(importRequest.password)
      if (importRequest.title) setTitle(importRequest.title)
    })
    navigateVault({ page: 'add' })
    onImportConsumed?.()
  }, [importRequest?.nonce, importRequest?.password, importRequest?.title, navigateVault, onImportConsumed])

  useEffect(() => {
    for (const t of revealTimers.current.values()) clearTimeout(t)
    revealTimers.current.clear()
    startTransition(() => setRevealedPw({}))
  }, [route.page, route.itemId])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    void (async () => {
      try {
        const res = await api<{ items: VaultItem[] }>('/vault/items', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!cancelled) setItems(res.items)
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken || route.page !== 'list') return
    let cancelled = false
    void (async () => {
      try {
        const r = await api<VaultSecurityReport>('/vault/security-report', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!cancelled) {
          setVaultInsight({
            health_score: r.health_score,
            reuse_clusters: r.reuse_clusters,
            password_rotation_max_age_days: r.password_rotation_max_age_days,
          })
        }
      } catch {
        if (!cancelled) setVaultInsight(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, route.page, items.length])

  useEffect(() => {
    const timers = revealTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  async function loadList() {
    const res = await api<{ items: VaultItem[] }>('/vault/items', { headers })
    setItems(res.items)
  }

  async function loadSearch() {
    const q = searchQ.trim()
    if (!q) {
      setErr('Enter text to search.')
      return
    }
    const res = await api<{ items: VaultItem[] }>(
      `/vault/items/search?q=${encodeURIComponent(q)}`,
      { headers },
    )
    setItems(res.items)
  }

  async function reloadView() {
    for (const t of revealTimers.current.values()) clearTimeout(t)
    revealTimers.current.clear()
    setRevealedPw({})
    if (!accessToken) return
    if (searchActive && searchQ.trim()) await loadSearch()
    else await loadList()
  }

  function scheduleAutoHide(id: number) {
    const prev = revealTimers.current.get(id)
    if (prev) clearTimeout(prev)
    const t = setTimeout(() => {
      hidePassword(id)
      revealTimers.current.delete(id)
    }, VAULT_REVEAL_AUTO_HIDE_MS)
    revealTimers.current.set(id, t)
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      await api('/vault/items', {
        method: 'POST',
        headers,
        json: {
          title,
          account_username: acct || undefined,
          notes: notes || undefined,
          website_url: websiteUrl || undefined,
          password,
        },
      })
      setTitle('')
      setAcct('')
      setNotes('')
      setWebsiteUrl('')
      setPassword('')
      setSearchActive(false)
      await loadList()
      pushToast({ variant: 'success', title: 'Saved', message: 'Credential encrypted in the vault.' })
      navigateVault({ page: 'list' })
    } catch (err) {
      setErr((err as Error).message)
    }
  }

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      setSearchActive(true)
      await loadSearch()
    } catch (err) {
      setErr((err as Error).message)
    }
  }

  async function clearSearch() {
    setErr(null)
    setSearchActive(false)
    setSearchQ('')
    setRevealedPw({})
    await loadList()
  }

  async function revealConfirmed(id: number) {
    setRevealConfirmId(null)
    setErr(null)
    try {
      const res = await api<{ password: string }>(`/vault/items/${id}/reveal-password`, {
        method: 'POST',
        headers,
      })
      setRevealedPw((prev) => ({ ...prev, [id]: res.password }))
      scheduleAutoHide(id)
    } catch (err) {
      setErr((err as Error).message)
    }
  }

  function hidePassword(id: number) {
    const ex = revealTimers.current.get(id)
    if (ex) clearTimeout(ex)
    revealTimers.current.delete(id)
    setRevealedPw((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function copyPassword(id: number) {
    setErr(null)
    try {
      const res = await api<{ password: string }>(`/vault/items/${id}/reveal-password`, {
        method: 'POST',
        headers,
      })
      await navigator.clipboard.writeText(res.password)
      pushToast({ variant: 'success', title: 'Copied', message: 'Password copied without displaying on screen.' })
    } catch (err) {
      setErr((err as Error).message)
      pushToast({ variant: 'error', title: 'Copy failed', message: (err as Error).message })
    }
  }

  async function checkStrength(id: number) {
    setErr(null)
    try {
      const res = await api<StrengthCheckResponse>(`/vault/items/${id}/check-strength`, {
        method: 'POST',
        headers,
      })
      setStrengthOpen((prev) => ({ ...prev, [id]: res }))
      await loadList()
      try {
        const r = await api<VaultSecurityReport>('/vault/security-report', { headers })
        setVaultInsight({
          health_score: r.health_score,
          reuse_clusters: r.reuse_clusters,
          password_rotation_max_age_days: r.password_rotation_max_age_days,
        })
      } catch {
        setVaultInsight(null)
      }
      pushToast({ variant: 'success', title: 'Strength updated', message: 'Latest analysis stored as metadata only.' })
    } catch (err) {
      setErr((err as Error).message)
    }
  }

  async function remove(id: number) {
    setErr(null)
    try {
      await api(`/vault/items/${id}`, { method: 'DELETE', headers })
      setDeleteTarget(null)
      await reloadView()
      pushToast({ variant: 'success', title: 'Removed', message: 'Credential deleted from vault.' })
      navigateVault({ page: 'list' })
    } catch (err) {
      setErr((err as Error).message)
    }
  }

  async function confirmDelete() {
    if (deleteTarget == null) return
    setDeleteBusy(true)
    try {
      await remove(deleteTarget)
    } finally {
      setDeleteBusy(false)
    }
  }

  const encryptionBanner = (
    <Card variant="outline" padding="md" className="border-sky-500/25 bg-sky-950/20">
      <div className="flex gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" aria-hidden />
        <div className="text-sm leading-relaxed text-sky-100/90">
          <p className="font-semibold text-white">Encrypted at rest</p>
          <p className="mt-1 text-sky-100/85">
            Secrets are encrypted on the server with keys derived for your account. Plaintext exists only briefly in
            memory for reveal, copy, and analysis. Use <strong className="text-white">Reveal</strong> sparingly—
            passwords auto-hide after {Math.round(VAULT_REVEAL_AUTO_HIDE_MS / 1000)} seconds to reduce shoulder-surfing
            and screen-recording exposure.
          </p>
        </div>
      </div>
    </Card>
  )

  if (route.page === 'add') {
    return (
      <div className="space-y-6">
        {encryptionBanner}
        <Card variant="glass" padding="none" className="overflow-hidden border-white/10">
          <div className="p-6">
            <PageHeader
              eyebrow="Vault"
              title="Add credential"
              description="Create a new encrypted entry. Nothing is stored until you submit."
              actions={
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
                  onClick={() => navigateVault({ page: 'list' })}
                >
                  Back to vault
                </Button>
              }
            />
            {err ? <p className="mb-4 text-sm text-rose-400">{err}</p> : null}
            <form className="grid gap-4 md:grid-cols-2" onSubmit={add}>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Input label="Account username" value={acct} onChange={(e) => setAcct(e.target.value)} />
              <Input className="md:col-span-2" label="Website URL" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              <Input className="md:col-span-2" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <PasswordInput
                className="md:col-span-2"
                label="Password / secret"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button type="submit">Save credential</Button>
                <Button type="button" variant="secondary" onClick={() => navigateVault({ page: 'list' })}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    )
  }

  if (route.page === 'edit' && route.itemId != null) {
    return (
      <div className="space-y-6">
        {encryptionBanner}
        <Card variant="glass" padding="none" className="overflow-hidden border-white/10">
          <div className="p-6">
            <PageHeader
              eyebrow="Vault"
              title="Edit credential"
              description="Updates are re-encrypted server-side. Leave password blank to keep the current secret."
              actions={
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
                  onClick={() => navigateVault({ page: 'view', itemId: route.itemId })}
                >
                  Back
                </Button>
              }
            />
            {!activeItem ? (
              <p className="text-sm text-zinc-500">Loading credential…</p>
            ) : (
              <VaultEditForm
                key={activeItem.id}
                item={activeItem}
                headers={headers}
                onCancel={() => navigateVault({ page: 'view', itemId: route.itemId })}
                onSaved={async () => {
                  await reloadView()
                  navigateVault({ page: 'view', itemId: route.itemId })
                }}
              />
            )}
          </div>
        </Card>
      </div>
    )
  }

  if (route.page === 'view' && route.itemId != null && activeItem) {
    const it = activeItem
    const revealed = revealedPw[it.id] ?? null
    const hint = revealed ? `Auto-hides in ~${Math.round(VAULT_REVEAL_AUTO_HIDE_MS / 1000)}s` : null
    return (
      <div className="space-y-6">
        {encryptionBanner}
        <ul className="list-none">
          <CredentialCard
            title={it.title}
            websiteUrl={it.website_url}
            username={it.account_username}
            notes={it.notes}
            strengthLabel={it.strength_label}
            lastCheckedAt={it.last_checked_at}
            passwordReuseWarning={it.password_reuse_warning}
            passwordReuseGroupSize={it.password_reuse_group_size}
            passwordStale={it.password_stale}
            passwordRotationMaxAgeDays={it.password_rotation_max_age_days}
            isBreached={it.is_breached}
            revealedPassword={revealed}
            revealHint={hint}
            onReveal={() => setRevealConfirmId(it.id)}
            onHide={() => hidePassword(it.id)}
            onCopyPassword={() => void copyPassword(it.id)}
            onEdit={() => navigateVault({ page: 'edit', itemId: it.id })}
            onDelete={() => setDeleteTarget(it.id)}
            onCheckStrength={() => void checkStrength(it.id)}
            avatarSize="lg"
            footer={
              strengthOpen[it.id] ? (
                <div className="rounded-lg bg-black/50 p-2 text-[11px] text-zinc-300">
                  <p>
                    Score {strengthOpen[it.id].complexity_score} · entropy {strengthOpen[it.id].entropy_bits.toFixed(1)} bits
                  </p>
                  {strengthOpen[it.id].patterns?.length ? (
                    <p className="mt-1 text-zinc-500">Patterns: {strengthOpen[it.id].patterns.join(', ')}</p>
                  ) : null}
                  {strengthOpen[it.id].suggestions?.length ? (
                    <ul className="mt-1 list-inside list-disc text-zinc-400">
                      {strengthOpen[it.id].suggestions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : null}
                  <pre className="mt-1 max-h-32 overflow-auto text-[10px] text-zinc-500">
                    {JSON.stringify(strengthOpen[it.id].crack_estimate, null, 2)}
                  </pre>
                </div>
              ) : undefined
            }
            className="border-emerald-500/20"
          />
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />} onClick={() => navigateVault({ page: 'list' })}>
            Back to vault
          </Button>
        </div>
        <ConfirmDialog
          open={revealConfirmId === it.id}
          onClose={() => setRevealConfirmId(null)}
          title="Reveal password on screen?"
          description="Anyone who can see your display may read the secret. The value will auto-hide shortly after you confirm."
          confirmLabel="Reveal briefly"
          onConfirm={() => void revealConfirmed(it.id)}
        />
        <ConfirmDialog
          open={deleteTarget === it.id}
          onClose={() => setDeleteTarget(null)}
          title="Delete credential"
          description="This removes the encrypted entry permanently from your vault."
          confirmLabel="Delete"
          variant="danger"
          loading={deleteBusy}
          onConfirm={() => void confirmDelete()}
        />
      </div>
    )
  }

  if (route.page === 'view' && route.itemId != null && !activeItem) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />} onClick={() => navigateVault({ page: 'list' })}>
          Back to vault
        </Button>
        <EmptyState
          title="Credential not found"
          description="It may have been removed, or the list is still loading. Return to the vault list and try again."
          action={
            <Button type="button" variant="secondary" onClick={() => navigateVault({ page: 'list' })}>
              View all credentials
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {encryptionBanner}
      {vaultInsight?.reuse_clusters != null && vaultInsight.reuse_clusters.length > 0 ? (
        <Card variant="outline" padding="md" className="border-amber-500/30 bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-100">Password reuse detected</p>
          <p className="mt-1 text-sm text-amber-100/85">
            {vaultInsight.reuse_clusters.length} cluster(s) — the same secret protects multiple saved entries. Use unique passwords
            per site and rotate shared ones. Health score: <span className="font-mono text-white">{vaultInsight.health_score}</span>
            / 100.
          </p>
        </Card>
      ) : null}
      <PageHeader
        eyebrow="Vault"
        title="Credential dashboard"
        description="Search, open, and manage encrypted entries. Reveal is gated and time-limited; copy fetches the secret without displaying it."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" aria-hidden />}
              onClick={() =>
                void downloadAuthenticatedBlob('/vault/export/security-metadata.csv', 'password-security-metadata.csv')
              }
            >
              Metadata CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<FileText className="h-3.5 w-3.5" aria-hidden />}
              onClick={() => {
                void (async () => {
                  try {
                    const r = await api<VaultSecurityReport>('/vault/security-report', { headers })
                    downloadVaultSecurityPdf(r)
                    pushToast({ variant: 'success', title: 'PDF ready', message: 'Metadata-only report downloaded.' })
                  } catch (e) {
                    pushToast({ variant: 'error', title: 'PDF failed', message: (e as Error).message })
                  }
                })()
              }}
            >
              Metadata PDF
            </Button>
            {items.length > 0 || searchActive ? (
              <Button type="button" leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => navigateVault({ page: 'add' })}>
                Add credential
              </Button>
            ) : null}
          </div>
        }
      />

      <Card variant="outline" padding="md" className="border-white/10">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={runSearch}>
          <Input
            className="min-w-0 flex-1"
            label="Search credentials"
            placeholder="Title, URL, or username"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            leftSlot={<Search className="h-4 w-4 text-zinc-500" aria-hidden />}
          />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="submit">Search</Button>
            <Button type="button" variant="secondary" onClick={() => void clearSearch()}>
              Show all
            </Button>
          </div>
        </form>
        {err ? <ErrorState title="Vault error" message={err} className="mt-3" /> : null}
        {searchActive ? <p className="mt-2 text-xs text-zinc-500">Showing search results.</p> : null}
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title={searchActive ? 'No matches' : 'No credentials yet'}
          description={
            searchActive
              ? 'Try different keywords or clear the search to show all entries.'
              : 'Add your first encrypted credential. Secrets are encrypted at rest with a per-user key derived server-side (see README threat model).'
          }
          action={
            searchActive ? (
              <Button type="button" variant="secondary" onClick={() => void clearSearch()}>
                Show all entries
              </Button>
            ) : (
              <Button type="button" leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => navigateVault({ page: 'add' })}>
                Add credential
              </Button>
            )
          }
        />
      ) : (
        <ul className="list-none space-y-4">
          {items.map((it) => {
            const revealed = revealedPw[it.id] ?? null
            const hint = revealed ? `Auto-hides in ~${Math.round(VAULT_REVEAL_AUTO_HIDE_MS / 1000)}s` : null
            return (
              <CredentialCard
                key={it.id}
                title={it.title}
                websiteUrl={it.website_url}
                username={it.account_username}
                notes={it.notes}
                strengthLabel={it.strength_label}
                lastCheckedAt={it.last_checked_at}
                passwordReuseWarning={it.password_reuse_warning}
                passwordReuseGroupSize={it.password_reuse_group_size}
                passwordStale={it.password_stale}
                passwordRotationMaxAgeDays={it.password_rotation_max_age_days}
                isBreached={it.is_breached}
                revealedPassword={revealed}
                revealHint={hint}
                onReveal={() => setRevealConfirmId(it.id)}
                onHide={() => hidePassword(it.id)}
                onCopyPassword={() => void copyPassword(it.id)}
                onViewDetails={() => navigateVault({ page: 'view', itemId: it.id })}
                onEdit={() => navigateVault({ page: 'edit', itemId: it.id })}
                onDelete={() => setDeleteTarget(it.id)}
                onCheckStrength={() => void checkStrength(it.id)}
                footer={
                  strengthOpen[it.id] ? (
                    <div className="rounded-lg bg-black/50 p-2 text-[11px] text-zinc-300">
                      <p>
                        Score {strengthOpen[it.id].complexity_score} · entropy {strengthOpen[it.id].entropy_bits.toFixed(1)} bits
                      </p>
                      {strengthOpen[it.id].patterns?.length ? (
                        <p className="mt-1 text-zinc-500">Patterns: {strengthOpen[it.id].patterns.join(', ')}</p>
                      ) : null}
                      {strengthOpen[it.id].suggestions?.length ? (
                        <ul className="mt-1 list-inside list-disc text-zinc-400">
                          {strengthOpen[it.id].suggestions.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      ) : null}
                      <pre className="mt-1 max-h-32 overflow-auto text-[10px] text-zinc-500">
                        {JSON.stringify(strengthOpen[it.id].crack_estimate, null, 2)}
                      </pre>
                    </div>
                  ) : undefined
                }
              />
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={revealConfirmId !== null}
        onClose={() => setRevealConfirmId(null)}
        title="Reveal password on screen?"
        description="Anyone who can see your display may read the secret. The value will auto-hide shortly after you confirm."
        confirmLabel="Reveal briefly"
        onConfirm={() => {
          if (revealConfirmId != null) void revealConfirmed(revealConfirmId)
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete credential"
        description="This removes the encrypted entry permanently from your vault."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteBusy}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
