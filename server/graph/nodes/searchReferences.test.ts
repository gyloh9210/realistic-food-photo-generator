import { describe, expect, it, vi } from 'vitest'
import { searchReferences } from './searchReferences.js'
import * as searchIndex from '../../search/index.js'
import * as download from '../../search/download.js'
import { createInitialState } from '../state.js'

vi.mock('../../search/index.js', () => ({ findReferenceCandidates: vi.fn() }))
vi.mock('../../search/download.js', () => ({ downloadImage: vi.fn() }))

describe('searchReferences', () => {
  it('fetches 5 candidates and downloads each when there are no approved images yet', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue(
      Array.from({ length: 5 }, (_v, i) => ({ sourceUrl: `https://x/${i}.jpg` })),
    )
    vi.mocked(download.downloadImage).mockResolvedValue(undefined)

    const state = createInitialState('run-1', 'nasi lemak')
    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledWith('nasi lemak', [], 5)
    expect(result.referenceImages).toHaveLength(5)
    expect(result.referenceImages?.every((image) => image.status === 'pending')).toBe(true)
    expect(download.downloadImage).toHaveBeenCalledTimes(5)
  })

  it('keeps approved images and only tops up the remainder', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue([{ sourceUrl: 'https://x/new.jpg' }])
    vi.mocked(download.downloadImage).mockResolvedValue(undefined)

    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved' },
    ]
    state.excludedSourceUrls = ['https://x/rejected.jpg']

    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledWith('nasi lemak', ['https://x/rejected.jpg'], 4)
    expect(result.referenceImages).toHaveLength(2)
    expect(result.referenceImages?.[0]).toMatchObject({ id: 'a', status: 'approved' })
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
})
