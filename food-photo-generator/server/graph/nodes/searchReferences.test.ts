import { describe, expect, it, vi } from 'vitest'
import { searchReferences } from './searchReferences.js'
import * as searchIndex from '../../search/index.js'
import * as download from '../../search/download.js'
import * as hash from '../../search/hash.js'
import { createInitialState } from '../state.js'

vi.mock('../../search/index.js', () => ({ findReferenceCandidates: vi.fn() }))
vi.mock('../../search/download.js', () => ({ downloadImage: vi.fn() }))
vi.mock('../../search/hash.js', () => ({ hashFile: vi.fn() }))

function mockUniqueDownloadHashes() {
  vi.mocked(download.downloadImage).mockImplementation(async (url: string) => `hash:${url}`)
}

describe('searchReferences', () => {
  it('fetches 5 candidates and downloads each when there are no approved images yet', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue(
      Array.from({ length: 5 }, (_v, i) => ({ sourceUrl: `https://x/${i}.jpg` })),
    )
    mockUniqueDownloadHashes()

    const state = createInitialState('run-1', 'nasi lemak')
    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledWith('nasi lemak', [], 5)
    expect(result.referenceImages).toHaveLength(5)
    expect(result.referenceImages?.every((image) => image.status === 'pending')).toBe(true)
    expect(download.downloadImage).toHaveBeenCalledTimes(5)
  })

  it('keeps approved images and only tops up the remainder', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue([{ sourceUrl: 'https://x/new.jpg' }])
    mockUniqueDownloadHashes()

    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved' },
    ]
    state.excludedSourceUrls = ['https://x/rejected.jpg']

    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledWith(
      'nasi lemak',
      expect.arrayContaining(['https://x/rejected.jpg', 'https://x/a.jpg']),
      4,
    )
    expect(result.referenceImages).toHaveLength(2)
    expect(result.referenceImages?.[0]).toMatchObject({ id: 'a', status: 'approved' })
  })

  it('keeps the successful downloads when one candidate fails to download', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue(
      Array.from({ length: 5 }, (_v, i) => ({ sourceUrl: `https://x/${i}.jpg` })),
    )
    vi.mocked(download.downloadImage).mockImplementation(async (url: string) => {
      if (url === 'https://x/2.jpg') throw new Error('Failed to download image from https://x/2.jpg: 403 Forbidden')
      return `hash:${url}`
    })

    const state = createInitialState('run-1', 'nasi lemak')
    const result = await searchReferences(state)

    expect(result.referenceImages).toHaveLength(4)
    expect(result.referenceImages?.map((image) => image.sourceUrl)).not.toContain('https://x/2.jpg')
    expect(result.referenceImages?.every((image) => image.status === 'pending')).toBe(true)
    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledTimes(1)
  })

  it('returns only the already-approved images when every new download fails', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue([
      { sourceUrl: 'https://x/dead-1.jpg' },
      { sourceUrl: 'https://x/dead-2.jpg' },
    ])
    vi.mocked(download.downloadImage).mockRejectedValue(new Error('404 Not Found'))

    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved' },
    ]

    await expect(searchReferences(state)).resolves.toMatchObject({
      referenceImages: [{ id: 'a', status: 'approved' }],
    })
    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledTimes(1)
  })

  it('returns an empty candidate list rather than throwing when nothing downloads at all', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue([{ sourceUrl: 'https://x/dead.jpg' }])
    vi.mocked(download.downloadImage).mockRejectedValue(new Error('403 Forbidden'))

    const state = createInitialState('run-1', 'nasi lemak')

    await expect(searchReferences(state)).resolves.toEqual({ referenceImages: [] })
  })

  it('does not call search when 5 images are already approved', async () => {
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = Array.from({ length: 5 }, (_v, i) => ({
      id: `a${i}`,
      sourceUrl: `https://x/${i}.jpg`,
      localPath: `/tmp/${i}.jpg`,
      status: 'approved' as const,
    }))

    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).not.toHaveBeenCalled()
    expect(result.referenceImages).toHaveLength(5)
  })

  it('refetches when a download duplicates an approved image and tops up with a unique candidate', async () => {
    vi.mocked(hash.hashFile).mockResolvedValue('approved-hash')
    vi.mocked(searchIndex.findReferenceCandidates)
      .mockResolvedValueOnce([{ sourceUrl: 'https://x/dup.jpg' }])
      .mockResolvedValueOnce([{ sourceUrl: 'https://x/unique.jpg' }])
    vi.mocked(download.downloadImage).mockImplementation(async (url: string) => {
      if (url === 'https://x/dup.jpg') return 'approved-hash'
      return 'unique-hash'
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = Array.from({ length: 4 }, (_v, i) => ({
      id: `a${i}`,
      sourceUrl: `https://x/approved-${i}.jpg`,
      localPath: `/tmp/approved-${i}.jpg`,
      status: 'approved' as const,
    }))

    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledTimes(2)
    expect(result.referenceImages).toHaveLength(5)
    expect(result.referenceImages?.some((image) => image.sourceUrl === 'https://x/unique.jpg')).toBe(true)
    warnSpy.mockRestore()
  })

  it('stops after 3 refetch rounds when every batch is duplicate content', async () => {
    vi.mocked(hash.hashFile).mockResolvedValue('seed-hash')
    vi.mocked(searchIndex.findReferenceCandidates).mockImplementation(async (_query, _exclude, needed) =>
      Array.from({ length: needed }, (_v, i) => ({ sourceUrl: `https://x/dup-${i}.jpg` })),
    )
    vi.mocked(download.downloadImage).mockResolvedValue('seed-hash')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved' },
    ]

    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledTimes(4)
    expect(result.referenceImages).toHaveLength(1)
    expect(warnSpy).toHaveBeenCalledWith(
      '[searchReferences] stopped after 3 refetch round(s); still need 4 candidate(s)',
    )
    warnSpy.mockRestore()
  })
})
