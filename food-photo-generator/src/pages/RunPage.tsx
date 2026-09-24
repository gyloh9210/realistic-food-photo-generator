import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchRun, resumeRun } from '../api.js'
import { ReferenceGrid } from '../components/ReferenceGrid.js'
import { FinalReview } from '../components/FinalReview.js'
import { RunContext, RunGenerationPrompt } from '../components/RunContext.js'
import { PageShell } from '@/components/PageShell.js'
import { Alert, AlertDescription } from '@/components/ui/alert.js'
import { Card, CardContent } from '@/components/ui/card.js'
import type { RunSnapshot } from '../../shared/types.js'

const POLL_INTERVAL_MS = 2000

function isInteractiveReferenceReview(snapshot: RunSnapshot): boolean {
  const { state, pendingInterrupt } = snapshot
  return (
    (state.runStatus === 'paused-references' || state.runStatus === 'capped-references') &&
    pendingInterrupt?.type === 'references'
  )
}

function shouldShowArchivedReferences(snapshot: RunSnapshot): boolean {
  const { state } = snapshot
  if (state.referenceImages.length === 0) return false
  if (!state.referenceImages.some((image) => image.status !== 'pending')) return false
  return !isInteractiveReferenceReview(snapshot)
}

export function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    if (!runId) return
    try {
      const next = await fetchRun(runId)
      setSnapshot(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run')
    }
  }, [runId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!snapshot || snapshot.state.runStatus !== 'working') return
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [snapshot, refresh])

  /**
   * A resume can take minutes (prompt writing + image generation), so guard
   * against double-submission and surface failures instead of leaving an
   * unhandled rejection and a frozen review screen.
   */
  async function submitResume(payload: Parameters<typeof resumeRun>[1]) {
    if (!runId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      setSnapshot(await resumeRun(runId, payload))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReferencesSubmit(
    decisions: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }[],
  ) {
    await submitResume({ decisions })
  }

  async function handleFinalSubmit(payload: { status: 'approved' | 'rejected'; rejectReason?: string }) {
    await submitResume(payload)
  }

  function renderArchivedReferences() {
    if (!snapshot || !shouldShowArchivedReferences(snapshot)) return null
    const { state } = snapshot
    return (
      <ReferenceGrid
        images={state.referenceImages}
        capped={false}
        round={state.referenceRound}
        readOnly
        onSubmit={() => {}}
      />
    )
  }

  function renderBody() {
    if (!snapshot) return error ? null : <p className="text-muted-foreground">Loading…</p>

    const { state, pendingInterrupt } = snapshot

    switch (state.runStatus) {
      case 'working':
        return (
          <div className="space-y-8">
            {renderArchivedReferences()}
            {state.generationPrompt && <RunGenerationPrompt generationPrompt={state.generationPrompt} />}
            {state.generatedImagePath && state.finalStatus !== 'pending' ? (
              <FinalReview
                imageUrl={state.generatedImagePath}
                capped={false}
                round={state.finalRound}
                readOnly
                submittedStatus={state.finalStatus}
                submittedRejectReason={state.finalRejectReason}
                onSubmit={() => {}}
              />
            ) : (
              <p className="text-muted-foreground">Working…</p>
            )}
          </div>
        )
      case 'paused-references':
      case 'capped-references':
        if (pendingInterrupt?.type === 'references') {
          return (
            <ReferenceGrid
              images={pendingInterrupt.images}
              capped={pendingInterrupt.capped}
              round={state.referenceRound}
              submitting={submitting}
              onSubmit={handleReferencesSubmit}
            />
          )
        }
        return null
      case 'paused-final':
      case 'capped-final':
        if (pendingInterrupt?.type === 'final') {
          return (
            <div className="space-y-8">
              {renderArchivedReferences()}
              <FinalReview
                imageUrl={pendingInterrupt.imageUrl}
                capped={pendingInterrupt.capped}
                round={state.finalRound}
                submitting={submitting}
                onSubmit={handleFinalSubmit}
              />
            </div>
          )
        }
        return null
      case 'done':
        return (
          <div className="space-y-8">
            {renderArchivedReferences()}
            <section className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight">Done</h1>
              {state.generatedImagePath && (
                <Card>
                  <CardContent className="p-0">
                    <img
                      src={state.generatedImagePath}
                      alt="Final food photo"
                      className="w-full rounded-lg"
                    />
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        )
      case 'failed':
        return (
          <Alert variant="destructive">
            <AlertDescription>Run failed: {state.error}</AlertDescription>
          </Alert>
        )
      case 'abandoned':
        return (
          <Alert variant="destructive">
            <AlertDescription>This run was abandoned.</AlertDescription>
          </Alert>
        )
      default:
        return null
    }
  }

  // The error is a banner rather than a full-page replacement: a failed submit
  // must not throw away the review UI the human still needs to act on.
  return (
    <PageShell>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {snapshot && (
        <div className="mb-8">
          <RunContext prompt={snapshot.state.prompt} />
        </div>
      )}
      {renderBody()}
    </PageShell>
  )
}
