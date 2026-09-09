import { readFile } from 'node:fs/promises'
import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'
import { loadRolePrompt } from '../prompts/loadPrompt.js'
import type { ReferenceImage } from '../../shared/types.js'

export async function writeGenerationPrompt(params: {
  apiKey: string
  prompt: string
  approvedImages: ReferenceImage[]
  finalRejectReason?: string
  outputPath: string
}): Promise<string> {
  const { apiKey, prompt, approvedImages, finalRejectReason, outputPath } = params
  const systemPrompt = await loadRolePrompt('write-generation-prompt')
  const task = [
    `Dish prompt: "${prompt}"`,
    '',
    'Approved reference photos (ground your prompt in what you actually see in these):',
    ...approvedImages.map((image) => `- ${toRepoRelative(image.localPath)}`),
    '',
    finalRejectReason
      ? `The previous generated image was rejected for this reason — fix it: ${finalRejectReason}`
      : '',
    '',
    `Write the final image-generation prompt as plain text to: ${toRepoRelative(outputPath)}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
  await runCursorAgent({ apiKey, systemPrompt, task })
  await waitForFile(outputPath)
  return (await readFile(outputPath, 'utf8')).trim()
}
