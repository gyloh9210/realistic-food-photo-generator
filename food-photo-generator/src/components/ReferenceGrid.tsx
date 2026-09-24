import { useState } from 'react'
import type { ReferenceImage } from '../../shared/types.js'
import { Alert, AlertDescription } from '@/components/ui/alert.js'
import { Button } from '@/components/ui/button.js'
import { Card, CardContent } from '@/components/ui/card.js'
import { Input } from '@/components/ui/input.js'
import { cn } from '@/lib/utils.js'

type Decision = { status: 'approved' | 'rejected'; rejectReason?: string }

export function ReferenceGrid(props: {
  images: ReferenceImage[]
  capped: boolean
  round: number
  submitting?: boolean
  onSubmit: (decisions: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }[]) => void
}) {
  const { images, capped, round, submitting = false, onSubmit } = props
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  function setStatus(id: string, status: 'approved' | 'rejected') {
    setDecisions((prev) => ({ ...prev, [id]: { status, rejectReason: prev[id]?.rejectReason } }))
  }

  function setReason(id: string, rejectReason: string) {
    setDecisions((prev) => ({ ...prev, [id]: { status: 'rejected', rejectReason } }))
  }

  function handleSubmit() {
    if (submitting) return
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
      {capped && (
        <Alert variant="destructive">
          <AlertDescription>
            This has looped {round} times. You can still approve one of these to continue, but rejecting now
            will abandon the run.
          </AlertDescription>
        </Alert>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {images.map((image) => {
          const decision = decisions[image.id]?.status
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
                      variant="success"
                      className={cn(decision === 'approved' && 'ring-2 ring-success ring-offset-2')}
                      onClick={() => setStatus(image.id, 'approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant={decision === 'rejected' ? 'destructive' : 'outline'}
                      className={cn(decision === 'rejected' && 'ring-2 ring-destructive ring-offset-2')}
                      onClick={() => setStatus(image.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  </div>
                  {decision === 'rejected' && (
                    <Input
                      aria-label={`Reason for rejecting ${image.id}`}
                      value={decisions[image.id]?.rejectReason ?? ''}
                      onChange={(event) => setReason(image.id, event.target.value)}
                    />
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
      <Button type="button" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit review'}
      </Button>
    </section>
  )
}
