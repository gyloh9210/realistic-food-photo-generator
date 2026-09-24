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
  const locked = submitting || readOnly
  const [rejectReason, setRejectReason] = useState(submittedRejectReason ?? '')
  const [showReasonField, setShowReasonField] = useState(
    readOnly && submittedStatus === 'rejected',
  )

  function submit(payload: { status: 'approved' | 'rejected'; rejectReason?: string }) {
    if (locked) return
    onSubmit(payload)
  }

  const displayRejectReason = readOnly ? (submittedRejectReason ?? '') : rejectReason

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
      {readOnly && submittedStatus && (
        <p className="text-sm text-muted-foreground">
          {submittedStatus === 'approved'
            ? 'Decision: Approved'
            : `Decision: Rejected${submittedRejectReason ? ` — ${submittedRejectReason}` : ''}`}
        </p>
      )}
      <Card>
        <CardContent className="p-0">
          <img src={imageUrl} alt="Generated food photo" className="w-full rounded-lg" />
        </CardContent>
      </Card>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => submit({ status: 'approved' })} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Approve'}
          </Button>
          {!showReasonField ? (
            <Button type="button" variant="outline" onClick={() => setShowReasonField(true)} disabled={submitting}>
              Reject
            </Button>
          ) : (
            <div className="w-full space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Why doesn&apos;t this work?</Label>
                <Input
                  id="reject-reason"
                  value={displayRejectReason}
                  disabled={submitting}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => submit({ status: 'rejected', rejectReason: rejectReason.trim() || undefined })}
                disabled={submitting}
              >
                Confirm reject
              </Button>
            </div>
          )}
        </div>
      )}
      {readOnly && submittedStatus === 'rejected' && (
        <div className="space-y-2">
          <Label htmlFor="reject-reason-readonly">Why doesn&apos;t this work?</Label>
          <Input id="reject-reason-readonly" value={displayRejectReason} disabled readOnly />
        </div>
      )}
    </section>
  )
}
