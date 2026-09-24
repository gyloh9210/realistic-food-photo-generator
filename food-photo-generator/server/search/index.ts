import { searchOpenverse, type SearchCandidate } from './openverse.js'
import { searchWikimedia } from './wikimedia.js'

export type { SearchCandidate }

export async function findReferenceCandidates(
  query: string,
  exclude: string[],
  needed: number,
): Promise<SearchCandidate[]> {
  if (needed <= 0) return []
  const seen = new Set(exclude)
  const results: SearchCandidate[] = []

  const fromOpenverse = await searchOpenverse(query, [...seen], needed)
  for (const candidate of fromOpenverse) {
    if (seen.has(candidate.sourceUrl)) continue
    seen.add(candidate.sourceUrl)
    results.push(candidate)
    if (results.length >= needed) return results
  }

  const stillNeeded = needed - results.length
  const fromWikimedia = await searchWikimedia(query, [...seen], stillNeeded)
  for (const candidate of fromWikimedia) {
    if (seen.has(candidate.sourceUrl)) continue
    seen.add(candidate.sourceUrl)
    results.push(candidate)
    if (results.length >= needed) return results
  }

  return results
}
