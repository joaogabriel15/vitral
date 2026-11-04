// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { configure, planDedupe } from '../src/index'
import { planned } from '../src/core/dedupe'
import { resolveEntry } from '../src/core/loader'
import { cleanup } from './helpers'

afterEach(cleanup)

const remote = (name: string, range: string, version: string) => ({
  url: `/${name}/vitral.json`,
  manifest: {
    name,
    entry: 'remote.js',
    split: { entry: 'split/e.js' },
    files: { [`split/own-${version}.js`]: `sha384-${version}` },
    dedupe: [{ name: 'lib', range, version, file: `split/own-${version}.js` }],
  },
})

describe('planDedupe', () => {
  it('faixas que se cruzam: uma cópia só, a mais nova que serve a todos', () => {
    const { plan, notes } = planDedupe({ a: remote('a', '^1.0.0', '1.2.0'), b: remote('b', '^1.3.0', '1.4.0') })
    expect(plan).toEqual({ a: { lib: { for: '^1.0.0@1.2.0', version: '1.4.0', file: '/b/split/own-1.4.0.js', sri: { '/b/split/own-1.4.0.js': 'sha384-1.4.0' } } } })
    expect(notes).toEqual([])
  })

  it('a oferta do host vem primeiro; sem versão em comum, explica o conflito', () => {
    const all = { a: remote('a', '^1.0.0', '1.2.0'), b: remote('b', '^1.3.0', '1.4.0'), c: remote('c', '^2.0.0', '2.1.0') }
    const { plan, notes } = planDedupe(all, { lib: '1.5.0' })
    // O host serve a e b; c fica com a própria.
    expect(plan).toEqual({})
    expect(notes).toEqual(['lib: as faixas não têm uma versão em comum; a página com todos os remotes baixa 2 cópias: 1.5.0 do host para a (^1.0.0), b (^1.3.0); 2.1.0 para c (^2.0.0).'])
  })

  it('o build dividido troca a cópia própria pela do plano, só para a faixa e versão do build', async () => {
    const { plan } = planDedupe({ a: remote('a', '^1.0.0', '1.2.0'), b: remote('b', '^1.3.0', '1.4.0') })
    configure({ dedupePlan: plan })
    const a = remote('a', '^1.0.0', '1.2.0')
    const r = { split: planned('a', (await resolveEntry('a', { url: location.origin + a.url, manifest: a.manifest as never })).split!) }
    expect(r.split!.dedupe![0]).toMatchObject({ version: '1.4.0', file: location.origin + '/b/split/own-1.4.0.js' })
    expect(r.split!.sri[location.origin + '/b/split/own-1.4.0.js']).toBe('sha384-1.4.0')
    // Outro deploy do remote (outra versão): o plano não vale.
    const novo = remote('a', '^1.0.0', '1.2.5')
    const r2 = { split: planned('a', (await resolveEntry('a', { url: location.origin + novo.url, manifest: novo.manifest as never })).split!) }
    expect(r2.split!.dedupe![0]).toMatchObject({ version: '1.2.5', file: location.origin + '/a/split/own-1.2.5.js' })
  })
})
