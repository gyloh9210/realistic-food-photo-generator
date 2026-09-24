import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { downloadImage } from './download.js'
import { hashBuffer } from './hash.js'

describe('downloadImage', () => {
  let tempDir: string | undefined

  afterEach(async () => {
    vi.unstubAllGlobals()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  it('writes the fetched bytes to destPath, creating directories as needed', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'download-test-'))
    const dest = path.join(tempDir, 'nested', 'photo.jpg')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode('fake-image-bytes').buffer,
      }),
    )

    const bytes = new TextEncoder().encode('fake-image-bytes')
    const hash = await downloadImage('https://example.com/photo.jpg', dest)

    expect((await readFile(dest, 'utf8'))).toBe('fake-image-bytes')
    expect(hash).toBe(hashBuffer(Buffer.from(bytes)))
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }))
    await expect(downloadImage('https://example.com/missing.jpg', '/tmp/wont-be-written.jpg')).rejects.toThrow(
      'Failed to download image',
    )
  })
})
