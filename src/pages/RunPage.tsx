import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchRun, resumeRun } from '../api.js'
import { ReferenceGrid } from '../components/ReferenceGrid.js'
import { FinalReview } from '../components/FinalReview.js'
import type { RunSnapshot } from '../../shared/types.js'

const POLL_INTERVAL_MS = 2000

export function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!runId) return
    try {
      const next = await fetchRun(runId)
      setSnapshot(next)
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

  async function handleReferencesSubmit(
    decisions: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }[],
  ) {
    if (!runId) return
    setSnapshot(await resumeRun(runId, { decisions }))
  }

  async function handleFinalSubmit(payload: { status: 'approved' | 'rejected'; rejectReason?: string }) {
    if (!runId) return
    setSnapshot(await resumeRun(runId, payload))
  }

  if (error) return <p role="alert">{error}</p>
  if (!snapshot) return <p>Loading…</p>

  const { state, pendingInterrupt } = snapshot

  switch (state.runStatus) {
    case 'working':
      return <p>Working…</p>
    case 'paused-references':
    case 'capped-references':
      return pendingInterrupt?.type === 'references' ? (
        <ReferenceGrid
          images={pendingInterrupt.images}
          capped={pendingInterrupt.capped}
          round={state.referenceRound}
          onSubmit={handleReferencesSubmit}
        />
      ) : null
    case 'paused-final':
    case 'capped-final':
      return pendingInterrupt?.type === 'final' ? (
        <FinalReview
          imageUrl={pendingInterrupt.imageUrl}
          capped={pendingInterrupt.capped}
          round={state.finalRound}
          onSubmit={handleFinalSubmit}
        />
      ) : null
    case 'done':
      return (
        <section>
          <h1>Done</h1>
          {state.generatedImagePath && <img src={state.generatedImagePath} alt="Final food photo" />}
        </section>
      )
    case 'failed':
      return <p role="alert">Run failed: {state.error}</p>
    case 'abandoned':
      return <p role="alert">This run was abandoned.</p>
    default:
      return null
  }
}
