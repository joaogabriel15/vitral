import { describe, expect, it } from 'vitest'
import { buildPrior } from '../src/cli/prior'

describe('vitral prior', () => {
  it('conta transições das sessões e tira as raras', () => {
    const lines = [
      ...Array.from({ length: 30 }, () => JSON.stringify(['/a', '/b'])),
      ...Array.from({ length: 6 }, () => JSON.stringify({ path: ['/a', '/c'] })),
      JSON.stringify(['/a', '/rara']),
      JSON.stringify(['/x', '/y']),
      'lixo',
      JSON.stringify(['__proto__', '/a']),
    ]
    expect(buildPrior(lines)).toEqual({ t: { '/a': { '/b': 30, '/c': 6 } } })
    expect(buildPrior(lines, { minCount: 1, minRow: 1, top: 1 })).toEqual({ t: { '/a': { '/b': 30 }, '/x': { '/y': 1 } } })
  })
})
