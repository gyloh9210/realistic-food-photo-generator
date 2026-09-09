import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchWikimedia } from './wikimedia.js'

describe('searchWikimedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts image URLs from the pages response, skipping excluded ones', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            '1': { title: 'File:A.jpg', imageinfo: [{ url: 'https://commons/a.jpg' }] },
            '2': { title: 'File:B.jpg', imageinfo: [{ url: 'https://commons/b.jpg' }] },
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const candidates = await searchWikimedia('nasi lemak', ['https://commons/b.jpg'], 5)

    expect(candidates).toEqual([{ sourceUrl: 'https://commons/a.jpg', title: 'File:A.jpg' }])
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestedUrl.searchParams.get('generator')).toBe('search')
    expect(requestedUrl.searchParams.get('gsrsearch')).toContain('nasi lemak')
  })

  it('returns an empty array when limit is 0 without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchWikimedia('nasi lemak', [], 0)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles a response with no pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await searchWikimedia('nasi lemak', [], 5)).toEqual([])
  })
})
