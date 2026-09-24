import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { findReferenceCandidates } from '../../search/index.js'
import { downloadImage } from '../../search/download.js'
import { hashFile } from '../../search/hash.js'
import { runDir } from '../../env.js'
import type { GraphState } from '../state.js'
import type { ReferenceImage } from '../../../shared/types.js'

const TARGET_COUNT = 5
const MAX_REFETCH_ROUNDS = 3

function buildExcludeSet(state: GraphState, approved: ReferenceImage[], attemptedUrls: Set<string>): string[] {
  const exclude = new Set<string>(state.excludedSourceUrls)
  for (const image of approved) {
    exclude.add(image.sourceUrl)
  }
  for (const url of attemptedUrls) {
    exclude.add(url)
  }
  return [...exclude]
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
    } catch (error) {
      console.warn(`[searchReferences] could not hash approved image at ${image.localPath}:`, error)
    }
  }

  const attemptedUrls = new Set<string>()
  const downloaded: ReferenceImage[] = []
  let dedupTriggeredRefetch = false
  let refetchRound = 0

  const processCandidates = async (candidates: Awaited<ReturnType<typeof findReferenceCandidates>>) => {
    const results = await Promise.allSettled(
      candidates.map(async (candidate): Promise<ReferenceImage | null> => {
        attemptedUrls.add(candidate.sourceUrl)
        const id = randomUUID()
        const ext = path.extname(new URL(candidate.sourceUrl).pathname) || '.jpg'
        const referencesDir = path.join(runDir(state.runId), 'references')
        const localPath = path.join(referencesDir, `${id}${ext}`)
        const contentHash = await downloadImage(candidate.sourceUrl, localPath)
        if (seenContentHashes.has(contentHash)) {
          dedupTriggeredRefetch = true
          console.warn(
            `[searchReferences] skipped duplicate content for ${candidate.sourceUrl} (matches existing image)`,
          )
          return null
        }
        seenContentHashes.add(contentHash)
        return { id, sourceUrl: candidate.sourceUrl, localPath, status: 'pending' as const }
      }),
    )

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<ReferenceImage | null> => result.status === 'fulfilled',
    )
    const added: ReferenceImage[] = []
    for (const result of fulfilled) {
      if (result.value) {
        added.push(result.value)
        stillNeeded--
      }
    }
    downloaded.push(...added)

    const failedCount = results.length - fulfilled.length
    if (failedCount > 0) {
      console.warn(`[searchReferences] skipped ${failedCount} of ${results.length} candidate download(s)`)
    }
  }

  const initialCandidates = await findReferenceCandidates(
    state.prompt,
    buildExcludeSet(state, approved, attemptedUrls),
    stillNeeded,
  )
  await processCandidates(initialCandidates)

  while (stillNeeded > 0 && refetchRound < MAX_REFETCH_ROUNDS && dedupTriggeredRefetch) {
    refetchRound++
    const refetchCandidates = await findReferenceCandidates(
      state.prompt,
      buildExcludeSet(state, approved, attemptedUrls),
      stillNeeded,
    )
    await processCandidates(refetchCandidates)
  }

  if (stillNeeded > 0 && refetchRound === MAX_REFETCH_ROUNDS) {
    console.warn(
      `[searchReferences] stopped after ${MAX_REFETCH_ROUNDS} refetch round(s); still need ${stillNeeded} candidate(s)`,
    )
  }

  return { referenceImages: [...approved, ...downloaded] }
}
