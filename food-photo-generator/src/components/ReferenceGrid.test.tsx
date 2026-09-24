/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReferenceGrid } from './ReferenceGrid.js'
import type { ReferenceImage } from '../../shared/types.js'

const images: ReferenceImage[] = [
  { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/run-files/1/references/a.jpg', status: 'pending', cursorNote: 'looks real' },
  { id: 'b', sourceUrl: 'https://x/b.jpg', localPath: '/run-files/1/references/b.jpg', status: 'pending' },
]

describe('ReferenceGrid', () => {
  it('submits a decision per image, defaulting undecided ones to rejected', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ReferenceGrid images={images} capped={false} round={0} onSubmit={onSubmit} />)

    const approveButtons = screen.getAllByRole('button', { name: 'Approve' })
    await user.click(approveButtons[0])
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[1])
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(onSubmit).toHaveBeenCalledWith([
      { id: 'a', status: 'approved', rejectReason: undefined },
      { id: 'b', status: 'rejected', rejectReason: undefined },
    ])
  })

  it('shows a capped banner explaining that rejecting will abandon the run', () => {
    render(<ReferenceGrid images={images} capped round={5} onSubmit={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('5 times')
  })

  it('disables the submit button and ignores clicks while a submission is in flight', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ReferenceGrid images={images} capped={false} round={0} submitting onSubmit={onSubmit} />)

    const button = screen.getByRole('button', { name: 'Submitting…' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
