import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'

export type VaultSecurityReport = {
  generated_at: string
  password_rotation_max_age_days: number
  health_score: number
  totals: {
    credentials: number
    weak: number
    unanalyzed: number
    breached_flags: number
    stale_passwords: number
    reuse_clusters: number
  }
  reuse_clusters: { size: number; titles: string[] }[]
  items: {
    id: number
    title: string
    website_url?: string | null
    strength_label?: string | null
    entropy_bits?: number | null
    complexity_score?: number | null
    is_breached: boolean
    password_stale: boolean
    password_reuse_warning: boolean
    password_reuse_group_size: number
    password_age_days?: number | null
  }[]
}

/**
 * Builds a PDF from vault security metadata only (no passwords, usernames, or notes).
 */
export function downloadVaultSecurityPdf(report: VaultSecurityReport): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = 48
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text('Password security report', margin, y)
  y += 22
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Generated (UTC): ${report.generated_at}`, margin, y)
  y += 14
  doc.text(
    'This report lists metadata only. Vault passwords and decrypted usernames are never embedded in exports or PDFs.',
    margin,
    y,
    { maxWidth: 520 },
  )
  y += 28
  doc.setFontSize(11)
  doc.setTextColor(15, 118, 110)
  doc.text(`Overall health score: ${report.health_score} / 100`, margin, y)
  y += 20
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  const t = report.totals
  doc.text(
    `Credentials: ${t.credentials} · Weak labels: ${t.weak} · Unanalyzed: ${t.unanalyzed} · Breach flags: ${t.breached_flags} · Stale (>${report.password_rotation_max_age_days}d): ${t.stale_passwords} · Reuse clusters: ${t.reuse_clusters}`,
    margin,
    y,
    { maxWidth: 520 },
  )
  y += 36

  if (report.reuse_clusters.length) {
    doc.setFontSize(11)
    doc.text('Password reuse clusters (titles only)', margin, y)
    y += 16
    autoTable(doc, {
      startY: y,
      head: [['Cluster size', 'Sites (titles)']],
      body: report.reuse_clusters.map((c) => [String(c.size), c.titles.join('; ')]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 118, 110] },
      margin: { left: margin, right: margin },
    })
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    y = (last?.finalY ?? y) + 28
  }

  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('Per-credential summary', margin, y)
  y += 16
  autoTable(doc, {
    startY: y,
    head: [['ID', 'Title', 'Strength', 'Entropy', 'Score', 'Breach', 'Stale', 'Reuse n']],
    body: report.items.map((it) => [
      String(it.id),
      it.title.slice(0, 42),
      it.strength_label ?? '—',
      it.entropy_bits != null ? it.entropy_bits.toFixed(1) : '—',
      it.complexity_score != null ? String(it.complexity_score) : '—',
      it.is_breached ? 'yes' : 'no',
      it.password_stale ? 'yes' : 'no',
      String(it.password_reuse_group_size ?? 1),
    ]),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: margin, right: margin },
  })

  doc.save(`psc-security-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}
