const IGNORED_BASENAMES = new Set(['readme.md'])

export function isSpecMarkdownFile(basename: string): boolean {
  const lower = basename.toLowerCase()
  if (!lower.endsWith('.md')) return false
  if (IGNORED_BASENAMES.has(lower)) return false
  if (lower.endsWith('.example.md')) return false
  return true
}

export function slugFromFilename(filename: string): string {
  const base = filename.replace(/\.md$/i, '')
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) throw new Error(`Invalid spec filename: ${filename}`)
  return slug
}

export function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function titleFromMarkdown(content: string, fallbackSlug: string): string {
  const match = content.match(/^#\s+(.+?)\s*$/m)
  if (match?.[1]) return match[1].trim()
  return humanizeSlug(fallbackSlug)
}

export function branchForSlug(slug: string): string {
  return `feature/${slug}`
}
