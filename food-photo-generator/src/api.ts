import type { ResumeFinalPayload, ResumeReferencesPayload, RunSnapshot } from '../shared/types.js'

const BASE = '/api/runs'

export async function createRun(prompt: string): Promise<{ runId: string }> {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!response.ok) throw new Error(`Failed to create run: ${response.status}`)
  return response.json()
}

export async function fetchRun(runId: string): Promise<RunSnapshot> {
  const response = await fetch(`${BASE}/${runId}`)
  if (!response.ok) throw new Error(`Failed to fetch run: ${response.status}`)
  return response.json()
}

export async function resumeRun(
  runId: string,
  payload: ResumeReferencesPayload | ResumeFinalPayload,
): Promise<RunSnapshot> {
  const response = await fetch(`${BASE}/${runId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`Failed to resume run: ${response.status}`)
  return response.json()
}
