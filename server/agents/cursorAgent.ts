import path from 'node:path'
import { stat } from 'node:fs/promises'
import { Agent } from '@cursor/sdk'
import { CURSOR_MODEL, REPO_ROOT } from '../env.js'

const MODEL = { id: CURSOR_MODEL }

export function toRepoRelative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

export async function runCursorAgent(params: {
  apiKey: string
  systemPrompt: string
  task: string
  timeoutMs?: number
}): Promise<void> {
  const { apiKey, systemPrompt, task, timeoutMs = 180_000 } = params
  const agent = await Agent.create({ apiKey, model: MODEL, local: { cwd: REPO_ROOT } })
  try {
    const run = await agent.send(`${systemPrompt}\n\n---\n\n${task}`)
    const result = await withTimeout(run.wait(), timeoutMs, `Cursor agent run timed out after ${timeoutMs}ms`)
    if (result.status === 'error') {
      throw new Error(`Cursor agent run failed (${result.id})`)
    }
  } finally {
    try {
      await agent[Symbol.asyncDispose]()
    } catch {
      agent.close()
    }
  }
}

export async function waitForFile(absolutePath: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await stat(absolutePath)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error(`Timed out waiting for file: ${absolutePath}`)
}
