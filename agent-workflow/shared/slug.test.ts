import { describe, expect, it } from 'vitest'
import {
  isSpecMarkdownFile,
  slugFromFilename,
  titleFromMarkdown,
} from './slug.js'

describe('slug', () => {
  it('ignores readme and example specs', () => {
    expect(isSpecMarkdownFile('README.md')).toBe(false)
    expect(isSpecMarkdownFile('foo.example.md')).toBe(false)
    expect(isSpecMarkdownFile('feature.md')).toBe(true)
  })

  it('derives slug from filename', () => {
    expect(slugFromFilename('dedup-ref-photo.md')).toBe('dedup-ref-photo')
  })

  it('extracts title from first H1', () => {
    expect(titleFromMarkdown('# Hello World\n\nbody', 'x')).toBe('Hello World')
    expect(titleFromMarkdown('no heading', 'my-slug')).toBe('My Slug')
  })
})
