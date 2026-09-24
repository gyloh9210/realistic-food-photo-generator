/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Home } from './Home.js'
import * as api from '../api.js'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/runs/:runId" element={<div>Run page for run-123</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Home', () => {
  it('creates a run and navigates to it on submit', async () => {
    vi.spyOn(api, 'createRun').mockResolvedValue({ runId: 'run-123' })
    const user = userEvent.setup()

    renderHome()
    await user.type(screen.getByLabelText('Describe a dish'), 'nasi lemak with fried chicken')
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(api.createRun).toHaveBeenCalledWith('nasi lemak with fried chicken')
    expect(await screen.findByText('Run page for run-123')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    vi.spyOn(api, 'createRun').mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    renderHome()
    await user.type(screen.getByLabelText('Describe a dish'), 'nasi lemak')
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
  })
})
