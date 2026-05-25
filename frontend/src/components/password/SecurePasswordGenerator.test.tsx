import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../context/ToastContext'
import { SecurePasswordGenerator } from './SecurePasswordGenerator'

vi.mock('../../lib/api', () => ({
  api: vi.fn(),
}))

import { api } from '../../lib/api'

describe('SecurePasswordGenerator', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset()
    vi.mocked(api).mockResolvedValue({
      options: [
        {
          password: 'Generated!9aZ',
          analysis: {
            entropy_bits: 40,
            complexity_score: 60,
            strength_label: 'moderate',
            is_common: false,
            patterns: [],
            suggestions: [],
            charset_size: 90,
          },
          crack_estimate: {},
          constraint_suggestions: [],
        },
      ],
    })
  })

  it('shows generator controls and surfaces API output', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <SecurePasswordGenerator headers={{ Authorization: 'Bearer t' }} />
      </ToastProvider>,
    )
    expect(screen.getByText(/^Generator$/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Generate/i }))
    await waitFor(() => {
      expect(vi.mocked(api)).toHaveBeenCalledWith(
        '/generate',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText('Generated!9aZ')).toBeInTheDocument()
  })
})
