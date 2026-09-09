import { readFile } from 'node:fs/promises'
import path from 'node:path'

const PROMPTS_DIR = import.meta.dirname

const ANTI_SLOP_ROLES = new Set(['screen-references', 'write-generation-prompt'])

export type PromptRole = 'screen-references' | 'write-generation-prompt' | 'generate-image'

export async function loadRolePrompt(role: PromptRole): Promise<string> {
  const roleText = await readFile(path.join(PROMPTS_DIR, `${role}.md`), 'utf8')
  if (!ANTI_SLOP_ROLES.has(role)) return roleText
  const guidance = await readFile(path.join(PROMPTS_DIR, 'anti-slop-guidance.md'), 'utf8')
  const examplesNote =
    'Before judging or writing, read the few-shot AI-slop examples and explanations in ' +
    'server/prompts/ai-slop-examples/annotations.md and the images alongside it — use them ' +
    'to calibrate what "AI slop" looks like.'
  return [roleText, guidance, examplesNote].join('\n\n---\n\n')
}
