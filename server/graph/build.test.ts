import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as searchIndex from '../search/index.js'
import * as download from '../search/download.js'
import * as screenAgent from '../agents/screenReferences.js'
import * as promptAgent from '../agents/writeGenerationPrompt.js'
import * as generateAgent from '../agents/generateImage.js'
import type { ReferenceImage, RunSnapshot, RunState } from '../../shared/types.js'

vi.mock('../search/index.js', () => ({ findReferenceCandidates: vi.fn() }))
vi.mock('../search/download.js', () => ({ downloadImage: vi.fn() }))
vi.mock('../agents/screenReferences.js', () => ({ screenReferenceImages: vi.fn() }))
vi.mock('../agents/writeGenerationPrompt.js', () => ({ writeGenerationPrompt: vi.fn() }))
vi.mock('../agents/generateImage.js', () => ({ generateFoodImage: vi.fn() }))
vi.mock('../env.js', async () => {
  const actual = await vi.importActual<typeof import('../env.js')>('../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

const { startRun, resumeRun, getRunSnapshot } = await import('./build.js')

/**
 * `startRun` no longer blocks until the first interrupt, so tests have to wait
 * for the background execution to reach the state they care about.
 */
async function waitForRun(
  runId: string,
  predicate: (snapshot: RunSnapshot) => boolean,
  timeoutMs = 5000,
): Promise<RunSnapshot> {
  const deadline = Date.now() + timeoutMs
  let last: RunSnapshot | null = null
  while (Date.now() < deadline) {
    last = await getRunSnapshot(runId)
    if (last && predicate(last)) return last
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for run ${runId}; last snapshot: ${JSON.stringify(last)}`)
}

function waitForStatus(runId: string, runStatus: RunState['runStatus']): Promise<RunSnapshot> {
  return waitForRun(runId, (snapshot) => snapshot.state.runStatus === runStatus)
}

/**
 * `screenReferences` sets `runStatus: 'paused-references'` one checkpoint
 * before `reviewReferences` actually raises the interrupt, so waiting on the
 * status alone can observe the gate a beat early.
 */
function waitForReferencesGate(runId: string): Promise<RunSnapshot> {
  return waitForRun(
    runId,
    (snapshot) =>
      snapshot.state.runStatus === 'paused-references' && snapshot.pendingInterrupt?.type === 'references',
  )
}

function referenceImagesOf(snapshot: RunSnapshot | null): ReferenceImage[] {
  return snapshot?.pendingInterrupt?.type === 'references' ? snapshot.pendingInterrupt.images : []
}

describe('the full run graph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchIndex.findReferenceCandidates).mockImplementation(async (_query, _exclude, needed) =>
      Array.from({ length: needed }, (_v, i) => ({ sourceUrl: `https://example.com/${Math.random()}-${i}.jpg` })),
    )
    vi.mocked(download.downloadImage).mockResolvedValue(undefined)
    vi.mocked(screenAgent.screenReferenceImages).mockImplementation(async ({ images }) =>
      Object.fromEntries(images.map((image) => [image.id, 'looks plausible'])),
    )
    vi.mocked(promptAgent.writeGenerationPrompt).mockResolvedValue('a very detailed prompt')
    vi.mocked(generateAgent.generateFoodImage).mockResolvedValue(undefined)
  })

  it('returns immediately with a working snapshot instead of blocking on the first interrupt', async () => {
    let releaseScreening: () => void = () => {}
    const screeningStarted = new Promise<void>((resolveStarted) => {
      vi.mocked(screenAgent.screenReferenceImages).mockImplementation(async ({ images }) => {
        resolveStarted()
        await new Promise<void>((resolveGate) => {
          releaseScreening = resolveGate
        })
        return Object.fromEntries(images.map((image) => [image.id, 'looks plausible']))
      })
    })

    const started = await startRun('nasi lemak with fried chicken')

    // startRun resolved even though the graph is still parked inside screenReferences.
    expect(started.state.runStatus).toBe('working')
    expect(started.pendingInterrupt).toBeNull()

    // The checkpoint exists straight away, so an immediate GET does not 404.
    const immediate = await getRunSnapshot(started.runId)
    expect(immediate?.state.runStatus).toBe('working')

    await screeningStarted
    releaseScreening()
    const paused = await waitForReferencesGate(started.runId)
    expect(paused.pendingInterrupt?.type).toBe('references')
  })

  it('runs the happy path from prompt to a done, approved image', async () => {
    const started = await startRun('nasi lemak with fried chicken')
    expect(started.state.runStatus).toBe('working')

    const paused = await waitForReferencesGate(started.runId)
    expect(paused.pendingInterrupt?.type).toBe('references')
    const images = referenceImagesOf(paused)
    expect(images).toHaveLength(5)

    const afterReferences = await resumeRun(started.runId, {
      decisions: images.map((image) => ({ id: image.id, status: 'approved' as const })),
    })
    expect(afterReferences?.state.runStatus).toBe('paused-final')
    expect(afterReferences?.pendingInterrupt?.type).toBe('final')

    const afterFinal = await resumeRun(started.runId, { status: 'approved' })
    expect(afterFinal?.state.runStatus).toBe('done')
    expect(afterFinal?.pendingInterrupt).toBeNull()
  })

  it('loops once on a reference rejection before proceeding', async () => {
    const started = await startRun('nasi lemak with fried chicken')
    const images = referenceImagesOf(await waitForReferencesGate(started.runId))

    const afterReject = await resumeRun(started.runId, {
      decisions: [
        { id: images[0].id, status: 'rejected' as const, rejectReason: 'looks AI-generated' },
        ...images.slice(1).map((image) => ({ id: image.id, status: 'approved' as const })),
      ],
    })
    expect(afterReject?.state.runStatus).toBe('paused-references')
    expect(afterReject?.state.referenceRound).toBe(1)
    const newImages = referenceImagesOf(afterReject)
    expect(newImages).toHaveLength(5)

    const afterApproveAll = await resumeRun(started.runId, {
      decisions: newImages.map((image) => ({ id: image.id, status: 'approved' as const })),
    })
    expect(afterApproveAll?.state.runStatus).toBe('paused-final')
  })

  it('loops once on a final-image rejection before finishing', async () => {
    const started = await startRun('nasi lemak with fried chicken')
    const images = referenceImagesOf(await waitForReferencesGate(started.runId))
    const afterReferences = await resumeRun(started.runId, {
      decisions: images.map((image) => ({ id: image.id, status: 'approved' as const })),
    })
    expect(afterReferences?.state.runStatus).toBe('paused-final')

    const afterReject = await resumeRun(started.runId, { status: 'rejected', rejectReason: 'too glossy' })
    expect(afterReject?.state.runStatus).toBe('paused-final')
    expect(afterReject?.state.finalRound).toBe(1)
    expect(promptAgent.writeGenerationPrompt).toHaveBeenCalledTimes(2)

    const afterApprove = await resumeRun(started.runId, { status: 'approved' })
    expect(afterApprove?.state.runStatus).toBe('done')
  })

  it('marks the run failed when a node throws', async () => {
    vi.mocked(screenAgent.screenReferenceImages).mockRejectedValue(new Error('cursor unavailable'))
    const started = await startRun('nasi lemak with fried chicken')
    const failed = await waitForStatus(started.runId, 'failed')
    expect(failed.state.error).toContain('cursor unavailable')
  })

  it('returns null when resuming an unknown run', async () => {
    const result = await resumeRun('does-not-exist', { status: 'approved' })
    expect(result).toBeNull()
  })
})
