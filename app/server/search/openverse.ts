export type SearchCandidate = { sourceUrl: string; title?: string }

export async function searchOpenverse(query: string, exclude: string[], limit: number): Promise<SearchCandidate[]> {
  if (limit <= 0) return []
  const excluded = new Set(exclude)
  const url = new URL('https://api.openverse.org/v1/images/')
  url.searchParams.set('q', query)
  url.searchParams.set('page_size', String(Math.min(limit * 3, 20)))
  url.searchParams.set('mature', 'false')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Openverse search failed: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as { results?: Array<{ url?: string; title?: string }> }
  const results = data.results ?? []
  const candidates: SearchCandidate[] = []
  for (const result of results) {
    if (!result.url || excluded.has(result.url)) continue
    candidates.push({ sourceUrl: result.url, title: result.title })
    if (candidates.length >= limit) break
  }
  return candidates
}
