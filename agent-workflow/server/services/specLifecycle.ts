import { mkdir, readFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { SPECS_DONE_DIR, SPECS_IN_PROGRESS_DIR, WORKFLOW_ROOT } from '../env.js'
import { titleFromMarkdown } from '../../shared/slug.js'

export function toRepoRelative(absolutePath: string): string {
  return path.relative(WORKFLOW_ROOT, absolutePath).split(path.sep).join('/')
}

export async function moveSpecToInProgress(filename: string, fromReadyPath: string): Promise<string> {
  await mkdir(SPECS_IN_PROGRESS_DIR, { recursive: true })
  const dest = path.join(SPECS_IN_PROGRESS_DIR, filename)
  await rename(fromReadyPath, dest)
  return dest
}

export async function moveSpecToDone(inProgressPath: string, filename: string): Promise<string> {
  await mkdir(SPECS_DONE_DIR, { recursive: true })
  const dest = path.join(SPECS_DONE_DIR, filename)
  await rename(inProgressPath, dest)
  return dest
}

export async function readTitleFromSpecFile(specPath: string, slug: string): Promise<string> {
  const content = await readFile(specPath, 'utf8')
  return titleFromMarkdown(content, slug)
}
