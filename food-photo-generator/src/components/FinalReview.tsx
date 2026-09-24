import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert.js'
import { Button } from '@/components/ui/button.js'
import { Card, CardContent } from '@/components/ui/card.js'
import { Input } from '@/components/ui/input.js'
import { Label } from '@/components/ui/label.js'

export function FinalReview(props: {
  imageUrl: string
  capped: boolean
  round: number
  submitting?: boolean
  readOnly?: boolean
  submittedStatus?: 'approved' | 'rejected'
  submittedRejectReason?: string
  onSubmit: (payload: { status: 'approved' | 'rejected'; rejectReason?: string }) => void
}) {
  const {
    imageUrl,
    capped,
    round,
    submitting = false,
    readOnly = false,
    submittedStatus,
    submittedRejectReason,
    onSubmit,
  } = props
  const [rejectReason, setRejectReason] = useState('')
  const [showReasonField, setShowReasonField] = useState(false)
  const locked = submitting || readOnly

  function submit(payload: { status: 'approved' | 'rejected'; rejectReason?: string }) {
    if (locked) return
    onSubmit(payload)
  }

  const displayRejected = readOnly && submittedStatus === 'rejected'
  const showRejectUi = showReasonField || displayRejected

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Review the generated photo</h1>
      {capped && !readOnly && (
        <Alert variant="destructive">
          <AlertDescription>
            This has looped {round} times. You can still approve this image, but rejecting now will abandon the
            run.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="p-0">
          <img src={imageUrl} alt="Generated food photo" className="w-full rounded-lg" />
        </CardContent>
      </Card>
      {readOnly && submittedStatus && (
        <p className="text-muted-foreground">
          {submittedStatus === 'approved'
            ? 'Approved.'
            : submittedRejectReason
              ? `Rejected: ${submittedRejectReason}`
              : 'Rejected.'}
        </p>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => submit({ status: 'approved' })} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Approve'}
          </Button>
          {!showRejectUi ? (
            <Button type="button" variant="outline" onClick={() => setShowReasonField(true)} disabled={submitting}>
              Reject
            </Button>
          ) : (
            <div className="w-full space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Why doesn&apos;t this work?</Label>
                <Input
                  id="reject-reason"
                  value={displayRejected ? (submittedRejectReason ?? '') : rejectReason}
                  disabled={locked}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </div>
              {!displayRejected && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => submit({ status: 'rejected', rejectReason: rejectReason.trim() || undefined })}
                  disabled={submitting}
                >
                  Confirm reject
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
