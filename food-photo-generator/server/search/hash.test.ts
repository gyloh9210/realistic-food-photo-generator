import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { hashBuffer, hashFile } from './hash.js'

describe('hashBuffer', () => {
  it('returns SHA-256 hex of the buffer', () => {
    const buffer = Buffer.from('fake-image-bytes')
    expect(hashBuffer(Buffer.alloc(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(hashBuffer(buffer)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashBuffer(buffer)).toBe(hashBuffer(Buffer.from('fake-image-bytes')))
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

  it('matches hashBuffer of the file contents', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'hash-test-'))
    const filePath = path.join(tempDir, 'photo.jpg')
    const bytes = Buffer.from('file-bytes-for-hash')
    await writeFile(filePath, bytes)

    expect(await hashFile(filePath)).toBe(hashBuffer(bytes))
  })
})
