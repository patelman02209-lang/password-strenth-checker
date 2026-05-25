/** Badge variant aligned with ``SecurityScoreCard`` strength mapping. */
export function vaultStrengthBadgeVariant(
  strengthLabel: string | null | undefined,
  isCommon?: boolean,
): 'danger' | 'warning' | 'success' | 'info' {
  if (isCommon) return 'danger'
  const k = (strengthLabel ?? '').trim().toLowerCase()
  if (k === 'very_weak' || k === 'weak') return 'danger'
  if (k === 'moderate') return 'warning'
  if (k === 'strong' || k === 'very_strong') return 'success'
  return 'info'
}

export const VAULT_REVEAL_AUTO_HIDE_MS = 30_000
