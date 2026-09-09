import { describe, expect, it, vi } from 'vitest'
import { findReferenceCandidates } from './index.js'
import * as openverse from './openverse.js'
import * as wikimedia from './wikimedia.js'

vi.mock('./openverse.js', () => ({ searchOpenverse: vi.fn() }))
vi.mock('./wikimedia.js', () => ({ searchWikimedia: vi.fn() }))

describe('findReferenceCandidates', () => {
  it('returns Openverse results first without calling Wikimedia if enough were found', async () => {
    vi.mocked(openverse.searchOpenverse).mockResolvedValue([
      { sourceUrl: 'https://x/1.jpg' },
      { sourceUrl: 'https://x/2.jpg' },
    ])
    const result = await findReferenceCandidates('nasi lemak', [], 2)
    expect(result).toHaveLength(2)
    expect(wikimedia.searchWikimedia).not.toHaveBeenCalled()
  })

  it('tops up with Wikimedia when Openverse is short', async () => {
    vi.mocked(openverse.searchOpenverse).mockResolvedValue([{ sourceUrl: 'https://x/1.jpg' }])
    vi.mocked(wikimedia.searchWikimedia).mockResolvedValue([{ sourceUrl: 'https://commons/2.jpg' }])
    const result = await findReferenceCandidates('nasi lemak', [], 2)
    expect(result).toEqual([{ sourceUrl: 'https://x/1.jpg' }, { sourceUrl: 'https://commons/2.jpg' }])
  })

  it('returns fewer than needed rather than failing when both sources are short', async () => {
    vi.mocked(openverse.searchOpenverse).mockResolvedValue([])
    vi.mocked(wikimedia.searchWikimedia).mockResolvedValue([])
    const result = await findReferenceCandidates('an extremely obscure dish', [], 5)
    expect(result).toEqual([])
  })

  it('returns an empty array when needed is 0', async () => {
    const result = await findReferenceCandidates('nasi lemak', [], 0)
    expect(result).toEqual([])
    expect(openverse.searchOpenverse).not.toHaveBeenCalled()
  })
})
