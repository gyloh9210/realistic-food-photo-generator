import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { findReferenceCandidates } from '../../search/index.js'
import type { SearchCandidate } from '../../search/index.js'
import { downloadImage } from '../../search/download.js'
import { hashFile } from '../../search/hash.js'
import { runDir } from '../../env.js'
import type { GraphState } from '../state.js'
import type { ReferenceImage } from '../../../shared/types.js'

const TARGET_COUNT = 5
const MAX_REFETCH_ROUNDS = 3

function buildExcludeList(
  state: GraphState,
  approved: ReferenceImage[],
  attemptedUrls: Set<string>,
): string[] {
  return [
    ...new Set([
      ...state.excludedSourceUrls,
      ...approved.map((image) => image.sourceUrl),
      ...attemptedUrls,
    ]),
  ]
}

export async function searchReferences(state: GraphState): Promise<Partial<GraphState>> {
  const approved = state.referenceImages.filter((image) => image.status === 'approved')
  let stillNeeded = Math.max(0, TARGET_COUNT - approved.length)
  if (stillNeeded === 0) {
    return { referenceImages: approved }
  }

  const seenContentHashes = new Set<string>()
  for (const image of approved) {
    try {
      seenContentHashes.add(await hashFile(image.localPath))
    } catch {
      console.warn(`[searchReferences] could not hash approved image at ${image.localPath}; skipping content dedup for it`)
    }
  }

  const attemptedUrls = new Set<string>()
  const downloaded: ReferenceImage[] = []
  const referencesDir = path.join(runDir(state.runId), 'references')

  async function ingestCandidates(candidates: SearchCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      attemptedUrls.add(candidate.sourceUrl)
    }

    const results = await Promise.allSettled(
      candidates.map(async (candidate) => {
        const id = randomUUID()
        const ext = path.extname(new URL(candidate.sourceUrl).pathname) || '.jpg'
        const localPath = path.join(referencesDir, `${id}${ext}`)
        const contentHash = await downloadImage(candidate.sourceUrl, localPath)
        return {
          image: { id, sourceUrl: candidate.sourceUrl, localPath, status: 'pending' as const },
          contentHash,
        }
      }),
    )

    const failedCount = results.filter((result) => result.status === 'rejected').length
    if (failedCount > 0) {
      console.warn(`[searchReferences] skipped ${failedCount} of ${results.length} candidate download(s)`)
    }

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { image, contentHash } = result.value
      if (seenContentHashes.has(contentHash)) {
        console.warn(
          `[searchReferences] dropped duplicate content for ${image.sourceUrl} (matches an already-seen image)`,
        )
        continue
      }
      seenContentHashes.add(contentHash)
      downloaded.push(image)
      stillNeeded -= 1
    }
  }

  const initialCandidates = await findReferenceCandidates(
    state.prompt,
    buildExcludeList(state, approved, attemptedUrls),
    stillNeeded,
  )
  await ingestCandidates(initialCandidates)

  let refetchRound = 0
  while (stillNeeded > 0 && refetchRound < MAX_REFETCH_ROUNDS) {
    refetchRound += 1
    const refetchCandidates = await findReferenceCandidates(
      state.prompt,
      buildExcludeList(state, approved, attemptedUrls),
      stillNeeded,
    )
    await ingestCandidates(refetchCandidates)
  }

  if (stillNeeded > 0 && refetchRound >= MAX_REFETCH_ROUNDS) {
    console.warn(
      `[searchReferences] stopped after ${MAX_REFETCH_ROUNDS} refetch round(s); still need ${stillNeeded} candidate(s)`,
    )
  }

  return { referenceImages: [...approved, ...downloaded] }
}
