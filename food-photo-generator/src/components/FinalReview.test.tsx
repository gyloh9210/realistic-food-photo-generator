/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FinalReview } from './FinalReview.js'

describe('FinalReview', () => {
  it('submits approval directly', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<FinalReview imageUrl="/run-files/1/generated/attempt-0.png" capped={false} round={0} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Approve' }))

    expect(onSubmit).toHaveBeenCalledWith({ status: 'approved' })
  })

  it('reveals a reason field then submits rejection with it', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<FinalReview imageUrl="/run-files/1/generated/attempt-0.png" capped={false} round={0} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.type(screen.getByLabelText("Why doesn't this work?"), 'too glossy')
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }))

    expect(onSubmit).toHaveBeenCalledWith({ status: 'rejected', rejectReason: 'too glossy' })
  })

  it('shows a capped banner', () => {
    render(<FinalReview imageUrl="/x.png" capped round={5} onSubmit={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('5 times')
  })

  it('disables its buttons and ignores clicks while a submission is in flight', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<FinalReview imageUrl="/x.png" capped={false} round={0} submitting onSubmit={onSubmit} />)

    const approve = screen.getByRole('button', { name: 'Submitting…' })
    expect(approve).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
    await user.click(approve)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the reject reason input while a submission is in flight', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <FinalReview imageUrl="/x.png" capped={false} round={0} onSubmit={onSubmit} />,
    )

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    rerender(<FinalReview imageUrl="/x.png" capped={false} round={0} submitting onSubmit={onSubmit} />)

    expect(screen.getByLabelText("Why doesn't this work?")).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirm reject' })).toBeDisabled()
  })

  it('shows the submitted outcome in read-only mode', () => {
    render(
      <FinalReview
        imageUrl="/run-files/1/generated/attempt-0.png"
        capped={false}
        round={0}
        readOnly
        submittedStatus="rejected"
        submittedRejectReason="too glossy"
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByText(/Decision: Rejected/)).toHaveTextContent('too glossy')
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Why doesn't this work?")).toHaveValue('too glossy')
  })
})
