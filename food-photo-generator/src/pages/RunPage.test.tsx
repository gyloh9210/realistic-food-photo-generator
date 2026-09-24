/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RunPage } from './RunPage.js'
import * as api from '../api.js'
import type { RunSnapshot } from '../../shared/types.js'

function renderRunPage() {
  return render(
    <MemoryRouter initialEntries={['/runs/run-1']}>
      <Routes>
        <Route path="/runs/:runId" element={<RunPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function baseState(overrides: Partial<RunSnapshot['state']> = {}): RunSnapshot['state'] {
  return {
    prompt: 'nasi lemak',
    referenceImages: [],
    excludedSourceUrls: [],
    referenceRound: 0,
    finalStatus: 'pending',
    finalRound: 0,
    runStatus: 'working',
    ...overrides,
  }
}

describe('RunPage', () => {
  it('shows a working message while the graph is processing', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({ runId: 'run-1', state: baseState(), pendingInterrupt: null })
    renderRunPage()
    expect(await screen.findByText('Working…')).toBeInTheDocument()
  })

  it('renders the reference review UI and resumes on submit', async () => {
    const snapshot: RunSnapshot = {
      runId: 'run-1',
      state: baseState({ runStatus: 'paused-references' }),
      pendingInterrupt: {
        type: 'references',
        capped: false,
        images: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/run-files/1/a.jpg', status: 'pending' }],
      },
    }
    vi.spyOn(api, 'fetchRun').mockResolvedValue(snapshot)
    vi.spyOn(api, 'resumeRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({
        runStatus: 'paused-final',
        referenceImages: [
          { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/run-files/1/a.jpg', status: 'approved' },
        ],
      }),
      pendingInterrupt: { type: 'final', capped: false, imageUrl: '/run-files/1/generated/attempt-0.png' },
    })
    const user = userEvent.setup()

    renderRunPage()
    await screen.findByText('Review reference photos')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(api.resumeRun).toHaveBeenCalledWith('run-1', { decisions: [{ id: 'a', status: 'approved', rejectReason: undefined }] })
    expect(await screen.findByText('nasi lemak')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Candidate reference' })).toBeInTheDocument()
    expect(screen.getByText('Review the generated photo')).toBeInTheDocument()
  })

  it('keeps reference context visible while working after reference review', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({
        runStatus: 'working',
        referenceImages: [
          { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/run-files/1/a.jpg', status: 'approved' },
        ],
      }),
      pendingInterrupt: null,
    })
    renderRunPage()

    expect(await screen.findByText('Working…')).toBeInTheDocument()
    expect(screen.getByText('nasi lemak')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Candidate reference' })).toBeInTheDocument()
  })

  it('surfaces an error instead of hanging when a reference submit is rejected', async () => {
    const snapshot: RunSnapshot = {
      runId: 'run-1',
      state: baseState({ runStatus: 'paused-references' }),
      pendingInterrupt: {
        type: 'references',
        capped: false,
        images: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/run-files/1/a.jpg', status: 'pending' }],
      },
    }
    vi.spyOn(api, 'fetchRun').mockResolvedValue(snapshot)
    vi.spyOn(api, 'resumeRun').mockRejectedValue(new Error('Failed to resume run: 400'))
    const user = userEvent.setup()

    renderRunPage()
    await screen.findByText('Review reference photos')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to resume run: 400')
    // The review UI is still there, so the human can retry.
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled()
  })

  it('surfaces an error instead of hanging when a final submit is rejected', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({ runStatus: 'paused-final' }),
      pendingInterrupt: { type: 'final', capped: false, imageUrl: '/run-files/1/generated/attempt-0.png' },
    })
    vi.spyOn(api, 'resumeRun').mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    renderRunPage()
    await screen.findByText('Review the generated photo')
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
  })

  it('disables the submit button while a review submission is in flight', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({ runStatus: 'paused-references' }),
      pendingInterrupt: {
        type: 'references',
        capped: false,
        images: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/run-files/1/a.jpg', status: 'pending' }],
      },
    })
    let releaseResume: (snapshot: RunSnapshot) => void = () => {}
    vi.spyOn(api, 'resumeRun').mockImplementation(
      () => new Promise<RunSnapshot>((resolve) => { releaseResume = resolve }),
    )
    const user = userEvent.setup()

    renderRunPage()
    await screen.findByText('Review reference photos')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    const inFlight = await screen.findByRole('button', { name: 'Submitting…' })
    expect(inFlight).toBeDisabled()
    // A second click while in flight must not fire another request.
    await user.click(inFlight)
    expect(api.resumeRun).toHaveBeenCalledTimes(1)

    releaseResume({
      runId: 'run-1',
      state: baseState({ runStatus: 'done', generatedImagePath: '/run-files/1/generated/attempt-0.png' }),
      pendingInterrupt: null,
    })
    expect(await screen.findByRole('img', { name: 'Final food photo' })).toBeInTheDocument()
  })

  it('renders the done state with the final image', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({ runStatus: 'done', generatedImagePath: '/run-files/1/generated/attempt-0.png' }),
      pendingInterrupt: null,
    })
    renderRunPage()
    expect(await screen.findByRole('img', { name: 'Final food photo' })).toHaveAttribute(
      'src',
      '/run-files/1/generated/attempt-0.png',
    )
  })

  it('renders a failed state with the error message', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({ runStatus: 'failed', error: 'cursor unavailable' }),
      pendingInterrupt: null,
    })
    renderRunPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('cursor unavailable')
  })

  it('recovers from a transient poll failure once a later poll succeeds', async () => {
    const workingSnapshot: RunSnapshot = { runId: 'run-1', state: baseState({ runStatus: 'working' }), pendingInterrupt: null }
    const doneSnapshot: RunSnapshot = {
      runId: 'run-1',
      state: baseState({ runStatus: 'done', generatedImagePath: '/run-files/1/generated/attempt-0.png' }),
      pendingInterrupt: null,
    }
    vi.spyOn(api, 'fetchRun')
      .mockResolvedValueOnce(workingSnapshot)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(doneSnapshot)

    renderRunPage()

    expect(await screen.findByText('Working…')).toBeInTheDocument()
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('network blip')
    expect(
      await screen.findByRole('img', { name: 'Final food photo' }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  }, 10000)
})
