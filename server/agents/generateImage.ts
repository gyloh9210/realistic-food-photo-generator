import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'
import { loadRolePrompt } from '../prompts/loadPrompt.js'

export async function generateFoodImage(params: {
  apiKey: string
  generationPrompt: string
  outputPath: string
  timeoutMs?: number
}): Promise<void> {
  const { apiKey, generationPrompt, outputPath, timeoutMs = 15_000 } = params
  const systemPrompt = await loadRolePrompt('generate-image')
  const task = [
    'Generate a 16:9 photorealistic image using the GenerateImage tool for this exact prompt:',
    '',
    generationPrompt,
    '',
    `Save (or copy) the resulting PNG to: ${toRepoRelative(outputPath)}`,
  ].join('\n')
  await runCursorAgent({ apiKey, systemPrompt, task, timeoutMs: 240_000 })
  await waitForFile(outputPath, timeoutMs)
}
