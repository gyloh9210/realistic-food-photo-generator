import { describe, expect, it } from 'vitest'
import { loadRolePrompt } from './loadPrompt.js'

describe('loadRolePrompt', () => {
  it('includes the anti-slop guidance and the few-shot examples pointer for screen-references', async () => {
    const prompt = await loadRolePrompt('screen-references')
    expect(prompt).toContain('screening candidate real-world food photos')
    expect(prompt).toContain('radial or symmetrical')
    expect(prompt).toContain('ai-slop-examples/annotations.md')
  })

  it('includes the anti-slop guidance for write-generation-prompt', async () => {
    const prompt = await loadRolePrompt('write-generation-prompt')
    expect(prompt).toContain('You write the prompt')
    expect(prompt).toContain('Appetite checklist')
  })

  it('does not include anti-slop guidance for generate-image', async () => {
    const prompt = await loadRolePrompt('generate-image')
    expect(prompt).toContain('GenerateImage tool')
    expect(prompt).not.toContain('Appetite checklist')
  })
})
