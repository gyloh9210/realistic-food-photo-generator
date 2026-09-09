import { describe, expect, it } from 'vitest'
import {
  applyFinalDecision,
  applyReferenceDecisions,
  decideFinalOutcome,
  decideReferenceOutcome,
  MAX_ROUNDS,
} from './decisions.js'
import type { ReferenceImage } from '../../shared/types.js'

function image(id: string, overrides: Partial<ReferenceImage> = {}): ReferenceImage {
  return {
    id,
    sourceUrl: `https://example.com/${id}.jpg`,
    localPath: `/tmp/${id}.jpg`,
    status: 'pending',
    ...overrides,
  }
}

describe('applyReferenceDecisions', () => {
  it('applies status and rejectReason to matching images only', () => {
    const result = applyReferenceDecisions(
      [image('a'), image('b')],
      [],
      [{ id: 'a', status: 'approved' }, { id: 'b', status: 'rejected', rejectReason: 'AI-looking' }],
    )
    expect(result.referenceImages).toEqual([
      image('a', { status: 'approved' }),
      image('b', { status: 'rejected', rejectReason: 'AI-looking' }),
    ])
  })

  it('adds rejected sourceUrls to excludedSourceUrls, de-duplicated', () => {
    const result = applyReferenceDecisions(
      [image('a')],
      ['https://example.com/old.jpg'],
      [{ id: 'a', status: 'rejected', rejectReason: 'no good' }],
    )
    expect(result.excludedSourceUrls.sort()).toEqual(
      ['https://example.com/a.jpg', 'https://example.com/old.jpg'].sort(),
    )
  })

  it('leaves images with no matching decision untouched', () => {
    const result = applyReferenceDecisions([image('a', { status: 'approved' })], [], [])
    expect(result.referenceImages).toEqual([image('a', { status: 'approved' })])
  })
})

describe('decideReferenceOutcome', () => {
  it('proceeds when every image is approved', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'approved' })],
      referenceRound: 0,
      runStatus: 'working',
    })
    expect(outcome).toBe('proceed')
  })

  it('retries when not all approved and under the round cap', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'rejected' })],
      referenceRound: MAX_ROUNDS - 1,
      runStatus: 'working',
    })
    expect(outcome).toBe('retry')
  })

  it('holds at the cap the first time the round limit is hit', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'rejected' })],
      referenceRound: MAX_ROUNDS,
      runStatus: 'working',
    })
    expect(outcome).toBe('hold-capped')
  })

  it('abandons when already capped and nothing at all was approved', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'rejected' }), image('b', { status: 'rejected' })],
      referenceRound: MAX_ROUNDS,
      runStatus: 'capped-references',
    })
    expect(outcome).toBe('abandon')
  })

  it('proceeds when already capped and the human approved only some of the candidates', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [
        image('a', { status: 'approved' }),
        image('b', { status: 'rejected', rejectReason: 'AI-looking' }),
        image('c', { status: 'pending' }),
      ],
      referenceRound: MAX_ROUNDS,
      runStatus: 'capped-references',
    })
    expect(outcome).toBe('proceed')
  })

  it('still retries on a partial approval when NOT yet capped', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'approved' }), image('b', { status: 'rejected' })],
      referenceRound: 1,
      runStatus: 'working',
    })
    expect(outcome).toBe('retry')
  })

  it('abandons when already capped and every candidate is left pending', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a'), image('b')],
      referenceRound: MAX_ROUNDS,
      runStatus: 'capped-references',
    })
    expect(outcome).toBe('abandon')
  })

  it('proceeds even when already capped, if the human approves everything', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'approved' })],
      referenceRound: MAX_ROUNDS,
      runStatus: 'capped-references',
    })
    expect(outcome).toBe('proceed')
  })

  it('treats an empty image list as not-approved (never auto-proceeds)', () => {
    const outcome = decideReferenceOutcome({ referenceImages: [], referenceRound: 0, runStatus: 'working' })
    expect(outcome).toBe('retry')
  })
})

describe('applyFinalDecision', () => {
  it('carries the status and reject reason through', () => {
    expect(applyFinalDecision({ status: 'rejected', rejectReason: 'too glossy' })).toEqual({
      finalStatus: 'rejected',
      finalRejectReason: 'too glossy',
    })
  })
})

describe('decideFinalOutcome', () => {
  it('is done when approved, regardless of round', () => {
    expect(decideFinalOutcome({ finalStatus: 'approved', finalRound: MAX_ROUNDS, runStatus: 'capped-final' })).toBe(
      'done',
    )
  })

  it('retries when rejected and under the cap', () => {
    expect(decideFinalOutcome({ finalStatus: 'rejected', finalRound: MAX_ROUNDS - 1, runStatus: 'working' })).toBe(
      'retry',
    )
  })

  it('holds at the cap the first time the round limit is hit', () => {
    expect(decideFinalOutcome({ finalStatus: 'rejected', finalRound: MAX_ROUNDS, runStatus: 'working' })).toBe(
      'hold-capped',
    )
  })

  it('abandons when already capped and rejected again', () => {
    expect(decideFinalOutcome({ finalStatus: 'rejected', finalRound: MAX_ROUNDS, runStatus: 'capped-final' })).toBe(
      'abandon',
    )
  })
})
