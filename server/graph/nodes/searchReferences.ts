import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { findReferenceCandidates } from '../../search/index.js'
import { downloadImage } from '../../search/download.js'
import { runDir } from '../../env.js'
import type { GraphState } from '../state.js'

const TARGET_COUNT = 5

export async function searchReferences(state: GraphState): Promise<Partial<GraphState>> {
  const approved = state.referenceImages.filter((image) => image.status === 'approved')
  const needed = Math.max(0, TARGET_COUNT - approved.length)
  if (needed === 0) {
    return { referenceImages: approved }
  }

  const candidates = await findReferenceCandidates(state.prompt, state.excludedSourceUrls, needed)
  const referencesDir = path.join(runDir(state.runId), 'references')
  const downloaded = await Promise.all(
    candidates.map(async (candidate) => {
      const id = randomUUID()
      const ext = path.extname(new URL(candidate.sourceUrl).pathname) || '.jpg'
      const localPath = path.join(referencesDir, `${id}${ext}`)
      await downloadImage(candidate.sourceUrl, localPath)
      return { id, sourceUrl: candidate.sourceUrl, localPath, status: 'pending' as const }
    }),
  )

  return { referenceImages: [...approved, ...downloaded] }
}
