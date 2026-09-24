import path from 'node:path'
import { writeGenerationPrompt } from '../../agents/writeGenerationPrompt.js'
import { getCursorApiKey, runDir } from '../../env.js'
import type { GraphState } from '../state.js'

export async function writeGenerationPromptNode(state: GraphState): Promise<Partial<GraphState>> {
  const approvedImages = state.referenceImages.filter((image) => image.status === 'approved')
  const outputPath = path.join(runDir(state.runId), `generation-prompt-${state.finalRound}.txt`)
  const generationPrompt = await writeGenerationPrompt({
    apiKey: getCursorApiKey(),
    prompt: state.prompt,
    approvedImages,
    finalRejectReason: state.finalRejectReason,
    outputPath,
  })
  return { generationPrompt }
}
