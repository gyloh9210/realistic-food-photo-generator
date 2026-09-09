import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { findReferenceCandidates } from '../../search/index.js'
import { downloadImage } from '../../search/download.js'
import { runDir } from '../../env.js'
import type { GraphState } from '../state.js'
import type { ReferenceImage } from '../../../shared/types.js'

const TARGET_COUNT = 5

export async function searchReferences(state: GraphState): Promise<Partial<GraphState>> {
  const approved = state.referenceImages.filter((image) => image.status === 'approved')
  const needed = Math.max(0, TARGET_COUNT - approved.length)
  if (needed === 0) {
    return { referenceImages: approved }
  }

  const candidates = await findReferenceCandidates(state.prompt, state.excludedSourceUrls, needed)
  const referencesDir = path.join(runDir(state.runId), 'references')
  // Candidates point at arbitrary third-party hosts, so hotlink blocks (403)
  // and link rot (404) are routine. Per the design spec, fewer candidates is
  // not an error — drop the failures and carry on with whatever downloaded.
  const results = await Promise.allSettled(
    candidates.map(async (candidate): Promise<ReferenceImage> => {
      const id = randomUUID()
      const ext = path.extname(new URL(candidate.sourceUrl).pathname) || '.jpg'
      const localPath = path.join(referencesDir, `${id}${ext}`)
      await downloadImage(candidate.sourceUrl, localPath)
      return { id, sourceUrl: candidate.sourceUrl, localPath, status: 'pending' as const }
    }),
  )

  const downloaded = results
    .filter((result): result is PromiseFulfilledResult<ReferenceImage> => result.status === 'fulfilled')
    .map((result) => result.value)

  const failedCount = results.length - downloaded.length
  if (failedCount > 0) {
    console.warn(`[searchReferences] skipped ${failedCount} of ${results.length} candidate download(s)`)
  }

  return { referenceImages: [...approved, ...downloaded] }
}
