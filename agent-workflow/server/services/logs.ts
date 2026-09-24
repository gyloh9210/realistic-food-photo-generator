import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { LOGS_DIR, logPathForJob } from '../env.js'

export async function appendLog(jobId: string, line: string): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true })
  const msg = line.endsWith('\n') ? line : `${line}\n`
  await appendFile(logPathForJob(jobId), `[${new Date().toISOString()}] ${msg}`)
}

export async function readLogTail(jobId: string, tail: number): Promise<string> {
  try {
    const raw = await readFile(logPathForJob(jobId), 'utf8')
    const lines = raw.split('\n')
    if (tail <= 0) return raw
    return lines.slice(-tail).join('\n')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw err
  }
}
