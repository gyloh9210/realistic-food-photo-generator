import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function hashFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return hashBuffer(buffer)
}
