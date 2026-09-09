import { useState } from 'react'

export function FinalReview(props: {
  imageUrl: string
  capped: boolean
  round: number
  onSubmit: (payload: { status: 'approved' | 'rejected'; rejectReason?: string }) => void
}) {
  const { imageUrl, capped, round, onSubmit } = props
  const [rejectReason, setRejectReason] = useState('')
  const [showReasonField, setShowReasonField] = useState(false)

  return (
    <section>
      <h1>Review the generated photo</h1>
      {capped && (
        <p role="alert">
          This has looped {round} times. You can still approve this image, but rejecting now will abandon the
          run.
        </p>
      )}
      <img src={imageUrl} alt="Generated food photo" />
      <button type="button" onClick={() => onSubmit({ status: 'approved' })}>
        Approve
      </button>
      {!showReasonField ? (
        <button type="button" onClick={() => setShowReasonField(true)}>
          Reject
        </button>
      ) : (
        <>
          <label htmlFor="reject-reason">Why doesn&apos;t this work?</label>
          <input
            id="reject-reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
          <button
            type="button"
            onClick={() => onSubmit({ status: 'rejected', rejectReason: rejectReason.trim() || undefined })}
          >
            Confirm reject
          </button>
        </>
      )}
    </section>
  )
}
