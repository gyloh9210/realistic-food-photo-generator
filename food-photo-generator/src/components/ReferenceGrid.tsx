import { useState } from 'react'
import type { ReferenceImage } from '../../shared/types.js'
import { Alert, AlertDescription } from '@/components/ui/alert.js'
import { Button } from '@/components/ui/button.js'
import { Card, CardContent } from '@/components/ui/card.js'
import { Input } from '@/components/ui/input.js'
import { cn } from '@/lib/utils.js'

type Decision = { status: 'approved' | 'rejected'; rejectReason?: string }

function decisionFromImage(image: ReferenceImage): Decision | undefined {
  if (image.status === 'pending') return undefined
  return { status: image.status, rejectReason: image.rejectReason }
}

export function ReferenceGrid(props: {
  images: ReferenceImage[]
  capped: boolean
  round: number
  submitting?: boolean
  readOnly?: boolean
  onSubmit: (decisions: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }[]) => void
}) {
  const { images, capped, round, submitting = false, readOnly = false, onSubmit } = props
  const locked = submitting || readOnly
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  function getDecision(image: ReferenceImage): Decision | undefined {
    if (readOnly) return decisionFromImage(image)
    return decisions[image.id]
  }

  function setStatus(id: string, status: 'approved' | 'rejected') {
    if (locked) return
    setDecisions((prev) => ({ ...prev, [id]: { status, rejectReason: prev[id]?.rejectReason } }))
  }

  function setReason(id: string, rejectReason: string) {
    if (locked) return
    setDecisions((prev) => ({ ...prev, [id]: { status: 'rejected', rejectReason } }))
  }

  function handleSubmit() {
    if (locked) return
    onSubmit(
      images.map((image) => ({
        id: image.id,
        status: decisions[image.id]?.status ?? 'rejected',
        rejectReason: decisions[image.id]?.rejectReason,
      })),
    )
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Review reference photos</h1>
      {readOnly && <p className="text-sm text-muted-foreground">Submitted for reference</p>}
      {capped && !readOnly && (
        <Alert variant="destructive">
          <AlertDescription>
            This has looped {round} times. You can still approve one of these to continue, but rejecting now
            will abandon the run.
          </AlertDescription>
        </Alert>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {images.map((image) => {
          const decision = getDecision(image)?.status
          const rejectReason = getDecision(image)?.rejectReason
          return (
            <li key={image.id}>
              <Card>
                <CardContent className="space-y-3">
                  <img src={image.localPath} alt="Candidate reference" className="w-full rounded-md" />
                  {image.cursorNote && (
                    <p className="text-sm text-muted-foreground">{image.cursorNote}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={decision === 'approved' ? 'default' : 'outline'}
                      className={cn(decision === 'approved' && 'ring-2 ring-primary ring-offset-2')}
                      disabled={locked}
                      onClick={() => setStatus(image.id, 'approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant={decision === 'rejected' ? 'destructive' : 'outline'}
                      className={cn(decision === 'rejected' && 'ring-2 ring-destructive ring-offset-2')}
                      disabled={locked}
                      onClick={() => setStatus(image.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  </div>
                  {decision === 'rejected' && (
                    <Input
                      aria-label={`Reason for rejecting ${image.id}`}
                      value={rejectReason ?? ''}
                      disabled={locked}
                      onChange={(event) => setReason(image.id, event.target.value)}
                    />
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
      {!readOnly && (
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit review'}
        </Button>
      )}
    </section>
  )
}
