import { useState } from 'react'
import type { ReferenceImage } from '../../shared/types.js'

type Decision = { status: 'approved' | 'rejected'; rejectReason?: string }

export function ReferenceGrid(props: {
  images: ReferenceImage[]
  capped: boolean
  round: number
  onSubmit: (decisions: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }[]) => void
}) {
  const { images, capped, round, onSubmit } = props
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  function setStatus(id: string, status: 'approved' | 'rejected') {
    setDecisions((prev) => ({ ...prev, [id]: { status, rejectReason: prev[id]?.rejectReason } }))
  }

  function setReason(id: string, rejectReason: string) {
    setDecisions((prev) => ({ ...prev, [id]: { status: 'rejected', rejectReason } }))
  }

  function handleSubmit() {
    onSubmit(
      images.map((image) => ({
        id: image.id,
        status: decisions[image.id]?.status ?? 'rejected',
        rejectReason: decisions[image.id]?.rejectReason,
      })),
    )
  }

  return (
    <section>
      <h1>Review reference photos</h1>
      {capped && (
        <p role="alert">
          This has looped {round} times. You can still approve one of these to continue, but rejecting now
          will abandon the run.
        </p>
      )}
      <ul>
        {images.map((image) => (
          <li key={image.id}>
            <img src={image.localPath} alt="Candidate reference" />
            {image.cursorNote && <p>{image.cursorNote}</p>}
            <button type="button" onClick={() => setStatus(image.id, 'approved')}>
              Approve
            </button>
            <button type="button" onClick={() => setStatus(image.id, 'rejected')}>
              Reject
            </button>
            {decisions[image.id]?.status === 'rejected' && (
              <input
                aria-label={`Reason for rejecting ${image.id}`}
                value={decisions[image.id]?.rejectReason ?? ''}
                onChange={(event) => setReason(image.id, event.target.value)}
              />
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={handleSubmit}>
        Submit review
      </button>
    </section>
  )
}
