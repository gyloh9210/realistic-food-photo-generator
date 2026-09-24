import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { hashBuffer } from './hash.js'

export async function downloadImage(url: string, destPath: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await mkdir(path.dirname(destPath), { recursive: true })
  await writeFile(destPath, buffer)
  return hashBuffer(buffer)
}
