import { readFile } from 'node:fs/promises'
import { Agent } from '@cursor/sdk'
import type { FeatureJob } from '../../shared/types.js'
import { ENGINEER_MODEL, PERSONAS_DIR, getCursorApiKey } from '../env.js'
import { appendLog } from './logs.js'

const MODEL = { id: ENGINEER_MODEL }

export async function loadEngineerSystemPrompt(): Promise<string> {
  return readFile(`${PERSONAS_DIR}/engineer.md`, 'utf8')
}

export type EngineerRunResult = {
  agentRunId: string
  ok: boolean
  error?: string
}

export async function runEngineerForJob(job: FeatureJob): Promise<EngineerRunResult> {
  const apiKey = getCursorApiKey()
  const systemPrompt = await loadEngineerSystemPrompt()
  const task = [
    'Implement the feature described in the spec below.',
    `Spec path (absolute): ${job.specPath}`,
    `Worktree branch: ${job.branch}`,
    '',
    '---',
    '',
    await readFile(job.specPath, 'utf8'),
  ].join('\n')

  await appendLog(job.id, `Starting engineer run (model ${ENGINEER_MODEL})`)

  const agent = await Agent.create({
    apiKey,
    model: MODEL,
    local: { cwd: job.worktreePath },
  })

  try {
    const run = await agent.send(`${systemPrompt}\n\n---\n\n${task}`)
    const result = await run.wait()
    await appendLog(job.id, `Agent finished with status ${result.status} (id ${result.id})`)
    if (result.status === 'error') {
      return { agentRunId: result.id, ok: false, error: `Cursor agent run failed (${result.id})` }
    }
    return { agentRunId: result.id, ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await appendLog(job.id, `Agent error: ${message}`)
    return { agentRunId: '', ok: false, error: message }
  } finally {
    try {
      await agent[Symbol.asyncDispose]()
    } catch {
      agent.close()
    }
  }
}
