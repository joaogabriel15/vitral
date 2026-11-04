import { describe, expect, it } from 'vitest'
import { hintsOf } from '../src/core/next-hints'
import { ordered } from '../src/core/order'
import { criticalOrder } from '../src/vite/manifest'

describe('criticalOrder', () => {
  // e → a (10) → b (50); e → c (5). Depois da inicialização: d (80) → f (1), g (2).
  const imports: Record<string, string[]> = { e: ['c', 'a'], a: ['b'], b: [], c: [], d: ['f'], f: [], g: [] }
  const size: Record<string, number> = { e: 1, a: 10, b: 50, c: 5, d: 80, f: 1, g: 2 }
  const run = (mount: string[]) => criticalOrder('e', mount, (f) => imports[f] ?? [], (f) => size[f])

  it('a entrada e o que ela importa antes; em cada etapa, o caminho mais pesado primeiro', () => {
    const { order, critical } = run(['c', 'a', 'b', 'g', 'd', 'f'])
    expect(order).toEqual(['e', 'a', 'b', 'c', 'd', 'g', 'f'])
    expect(critical.map((i) => order[i])).toEqual(['e', 'a', 'b', 'd', 'f'])
  })

  it('ciclo entre chunks não trava', () => {
    imports.b = ['a']
    expect(run(['a', 'b', 'c']).order).toEqual(['e', 'a', 'b', 'c'])
    imports.b = []
  })

  it('ordered: arquivos fora da ordem vão no fim', () => {
    expect(ordered(['x', 'b', 'a'], ['a', 'b'])).toEqual(['a', 'b', 'x'])
    expect(ordered(['x', 'b'], undefined)).toEqual(['x', 'b'])
  })

  it('hints do HTML na ordem do build, com high só no caminho crítico', () => {
    const m = {
      name: 'r',
      entry: 'remote.js',
      files: { 'split/e.js': 'sha384-e', 'split/a.js': 'sha384-a' },
      split: { entry: 'split/e.js', chunks: ['split/c.js', 'split/a.js'], order: ['split/e.js', 'split/own.js', 'split/a.js', 'split/c.js'], critical: [0, 1] },
      dedupe: [{ name: 'lib', range: '^1.0.0', version: '1.0.0', file: 'split/own.js' }],
    }
    const h = hintsOf(m as never, '/r/vitral.json', {})
    expect(h.js).toEqual([['/r/split/e.js', 'sha384-e', 'high'], ['/r/split/own.js', undefined, 'high'], ['/r/split/a.js', 'sha384-a'], ['/r/split/c.js']])
    // O host oferece a lib: a cópia própria sai da lista.
    expect(hintsOf(m as never, '/r/vitral.json', { lib: '1.2.0' }).js.map(([u]) => u)).toEqual(['/r/split/e.js', '/r/split/a.js', '/r/split/c.js'])
  })
})
