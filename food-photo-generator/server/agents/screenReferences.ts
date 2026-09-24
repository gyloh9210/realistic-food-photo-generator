import { readFile } from 'node:fs/promises'
import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'
import { loadRolePrompt } from '../prompts/loadPrompt.js'
import type { ReferenceImage } from '../../shared/types.js'

export async function screenReferenceImages(params: {
  apiKey: string
  prompt: string
  images: ReferenceImage[]
  notesPath: string
}): Promise<Record<string, string>> {
  const { apiKey, prompt, images, notesPath } = params
  if (images.length === 0) return {}
  const systemPrompt = await loadRolePrompt('screen-references')
  const task = [
    `Dish prompt: "${prompt}"`,
    '',
    `Write your findings as JSON to: ${toRepoRelative(notesPath)}`,
    'Judge exactly these candidate photos:',
    ...images.map((image) => `- ${toRepoRelative(image.localPath)} (id: ${image.id})`),
    '',
    'Output shape: { "<id>": "<one-line note>", ... } — one entry for every id listed above.',
  ].join('\n')
  await runCursorAgent({ apiKey, systemPrompt, task })
  await waitForFile(notesPath)
  const raw = await readFile(notesPath, 'utf8')
  return JSON.parse(raw) as Record<string, string>
}
