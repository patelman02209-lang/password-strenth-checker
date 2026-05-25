import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordStrengthAnalyzer } from './PasswordStrengthAnalyzer'

vi.mock('../../lib/api', () => ({
  api: vi.fn(),
}))

import { api } from '../../lib/api'

const sampleResult = {
  entropy_bits: 22.4,
  complexity_score: 35,
  strength_label: 'weak',
  is_common: false,
  patterns: ['keyboard_pattern'],
  suggestions: ['Avoid keyboard walks.'],
  charset_size: 70,
  crack_estimate: { seconds: 1 },
  is_breached: false,
  breach_count: 0,
}

describe('PasswordStrengthAnalyzer', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset()
    vi.mocked(api).mockResolvedValue(sampleResult)
  })

  it('renders strength checker chrome', () => {
    render(<PasswordStrengthAnalyzer headers={{}} />)
    expect(screen.getByText('Analysis privacy')).toBeInTheDocument()
    expect(screen.getByLabelText(/Password under test/i)).toBeInTheDocument()
  })

  it('updates the strength panel after explicit analyze', async () => {
    render(<PasswordStrengthAnalyzer headers={{ Authorization: 'Bearer t' }} />)
    fireEvent.change(screen.getByLabelText(/Password under test/i), { target: { value: 'qwerty-like' } })
    fireEvent.click(screen.getByRole('button', { name: /Analyze now/i }))
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalled()
    })
    expect(await screen.findByText(/Avoid keyboard walks/i)).toBeInTheDocument()
    expect(screen.getByText(/keyboard pattern/i)).toBeInTheDocument()
  })
})
