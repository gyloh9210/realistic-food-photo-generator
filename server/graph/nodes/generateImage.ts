import path from 'node:path'
import { generateFoodImage } from '../../agents/generateImage.js'
import { getCursorApiKey, runDir } from '../../env.js'
import type { GraphState } from '../state.js'

export async function generateImageNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.generationPrompt) {
    throw new Error('generateImageNode requires generationPrompt to be set')
  }
  const outputPath = path.join(runDir(state.runId), 'generated', `attempt-${state.finalRound}.png`)
  await generateFoodImage({ apiKey: getCursorApiKey(), generationPrompt: state.generationPrompt, outputPath })
  return { generatedImagePath: outputPath, runStatus: 'paused-final' }
}
