import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { hashBuffer, hashFile } from './hash.js'

describe('hashBuffer', () => {
  it('returns SHA-256 hex for the given bytes', () => {
    const hash = hashBuffer(Buffer.from('fake-image-bytes'))
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hashBuffer(Buffer.from('fake-image-bytes'))).toBe(hash)
    expect(hashBuffer(Buffer.from('other-bytes'))).not.toBe(hash)
  })
})

describe('hashFile', () => {
  let tempDir: string | undefined

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  it('hashes the file contents the same as hashBuffer would', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'hash-file-test-'))
    const filePath = path.join(tempDir, 'photo.jpg')
    const bytes = Buffer.from('file-bytes-for-hash')
    await writeFile(filePath, bytes)

    expect(await hashFile(filePath)).toBe(hashBuffer(bytes))
  })
})
