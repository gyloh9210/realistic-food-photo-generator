import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOpenverse } from './openverse.js'

describe('searchOpenverse', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns candidates up to the limit, skipping excluded urls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { url: 'https://x/1.jpg', title: 'one' },
          { url: 'https://x/2.jpg', title: 'two' },
          { url: 'https://x/3.jpg', title: 'three' },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const candidates = await searchOpenverse('nasi lemak', ['https://x/2.jpg'], 2)

    expect(candidates).toEqual([
      { sourceUrl: 'https://x/1.jpg', title: 'one' },
      { sourceUrl: 'https://x/3.jpg', title: 'three' },
    ])
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://api.openverse.org/v1/images/')
    expect(requestedUrl.searchParams.get('q')).toBe('nasi lemak')
  })

  it('returns an empty array when limit is 0 without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchOpenverse('nasi lemak', [], 0)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }))
    await expect(searchOpenverse('nasi lemak', [], 5)).rejects.toThrow('Openverse search failed')
  })
})
