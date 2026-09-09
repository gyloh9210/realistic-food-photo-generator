import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { downloadImage } from './download.js'

describe('downloadImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes the fetched bytes to destPath, creating directories as needed', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'download-test-'))
    const dest = path.join(dir, 'nested', 'photo.jpg')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode('fake-image-bytes').buffer,
      }),
    )

    await downloadImage('https://example.com/photo.jpg', dest)

    expect((await readFile(dest, 'utf8'))).toBe('fake-image-bytes')
    await rm(dir, { recursive: true, force: true })
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }))
    await expect(downloadImage('https://example.com/missing.jpg', '/tmp/wont-be-written.jpg')).rejects.toThrow(
      'Failed to download image',
    )
  })
})
