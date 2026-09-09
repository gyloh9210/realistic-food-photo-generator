import type { SearchCandidate } from './openverse.js'

export async function searchWikimedia(query: string, exclude: string[], limit: number): Promise<SearchCandidate[]> {
  if (limit <= 0) return []
  const excluded = new Set(exclude)
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap`)
  url.searchParams.set('gsrnamespace', '6')
  url.searchParams.set('gsrlimit', String(Math.min(limit * 3, 20)))
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url')
  url.searchParams.set('format', 'json')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Wikimedia search failed: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ url?: string }> }> }
  }
  const pages = Object.values(data.query?.pages ?? {})
  const candidates: SearchCandidate[] = []
  for (const page of pages) {
    const imageUrl = page.imageinfo?.[0]?.url
    if (!imageUrl || excluded.has(imageUrl)) continue
    candidates.push({ sourceUrl: imageUrl, title: page.title })
    if (candidates.length >= limit) break
  }
  return candidates
}
