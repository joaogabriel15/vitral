// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { satisfies, validRange } from '../src/core/semver'
import { protocol } from '../src/core/state'
import { shared } from '../src/core/dedupe'
import { configure } from '../src/index'
import { cleanup } from './helpers'

afterEach(() => cleanup())

describe('satisfies', () => {
  it.each([
    ['19.3.0', '^19.2.0', true],
    ['19.1.0', '^19.2.0', false],
    ['20.0.0', '^19.2.0', false],
    ['0.3.5', '^0.3.1', true],
    ['0.4.0', '^0.3.1', false],
    ['0.0.4', '^0.0.3', false],
    ['1.2.9', '~1.2.3', true],
    ['1.3.0', '~1.2.3', false],
    ['5.0.0', '>=4.1.0', true],
    ['4.0.9', '>=4.1.0', false],
    ['5.1.2', '5.1.2', true],
    ['5.1.3', '=5.1.2', false],
    ['19.0.0-rc.1', '^19.0.0', false],
    ['19.0.0-rc.1', '19.0.0-rc.1', true],
    ['3.0.0', '*', true],
    // Faixa parcial, como no contrato (`contract: '^2'`).
    ['2.3.0', '^2', true],
    ['3.0.0', '^2', false],
    ['0.5.0', '^0', true],
    ['0.1.0', '^0.0', false],
    ['2.1.9', '~2.1', true],
    ['2.2.0', '~2.1', false],
    ['2.9.0', '~2', true],
    ['2.0.0', '>=2', true],
    ['2', '^2.0.0', true],
    // Sintaxe do npm além do básico.
    ['19.1.0', '^18.0.0 || ^19.0.0', true],
    ['17.0.2', '^18.0.0 || ^19.0.0', false],
    ['18.3.1', '18.x', true],
    ['19.0.0', '18.x', false],
    ['1.2.9', '1.2.*', true],
    ['18.3.1', '>=18 <20', true],
    ['20.0.0', '>=18 <20', false],
    ['18.3.1', '>= 18 < 20', true],
    ['2.1.0', '>2', false],
    ['3.0.0', '>2', true],
    ['2.0.1', '>2.0.0', true],
    ['1.4.9', '<=1.4', true],
    ['1.5.0', '<=1.4', false],
    ['1.9.0', '<2', true],
    ['2.3.4', '1.2 - 2.3.4', true],
    ['2.3.5', '1.2 - 2.3.4', false],
    ['2.9.0', '1.2 - 2', true],
    ['1.1.0', '1.2 - 2', false],
    ['1.2.0', '1.2', true],
    ['1.3.0', '1.2', false],
    ['1.2.3', 'v1.2.3', true],
    ['1.2.5', '~>1.2.3', true],
    ['0.0.4', '^0.0.3', false],
    ['19.1.0', '^19.0.0-rc.1', true],
    ['19.1.0', 'latest', false],
    ['19.1.0', 'workspace:*', false],
  ])('%s em %s: %s', (version, range, ok) => {
    expect(satisfies(version, range)).toBe(ok)
  })
})

it('validRange separa faixa válida de texto qualquer', () => {
  expect(['^1 || ^2', '>=18 <20', '1.2 - 2', '*', '', '18.x'].every(validRange)).toBe(true)
  expect(['latest', 'workspace:*', '^a', '>=1 || nope'].some(validRange)).toBe(false)
})

describe('protocolo: dedupe', () => {
  it('devolve a primeira oferta na faixa e carrega uma vez só', async () => {
    const load = vi.fn(async () => ({ react: 'host' }))
    const p = { dedupe: shared(protocol()) }
    p.dedupe('react', '19.3.0', { version: '19.3.0', load })
    expect(await p.dedupe('react', '^19.0.0')).toEqual({ react: 'host' })
    expect(await p.dedupe('react', '^19.2.0', { version: '19.2.0', load: vi.fn() })).toEqual({ react: 'host' })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('sem oferta na faixa, registra a própria para os próximos', async () => {
    const p = { dedupe: shared(protocol()) }
    expect(p.dedupe('vue', '^3.4.0')).toBeUndefined()
    p.dedupe('vue', '^3.0.0', { version: '3.0.1', load: async () => ({ vue: 'velho' }) })
    expect(await p.dedupe('vue', '^3.4.0', { version: '3.5.0', load: async () => ({ vue: 'novo' }) })).toEqual({ vue: 'novo' })
    expect(await p.dedupe('vue', '^3.5.0')).toEqual({ vue: 'novo' })
  })

  it('oferta que falhou sai da lista', async () => {
    const p = { dedupe: shared(protocol()) }
    await expect(p.dedupe('react', '^19.0.0', { version: '19.0.0', load: () => Promise.reject(new Error('rede')) })).rejects.toThrow('rede')
    await Promise.resolve()
    expect(p.dedupe('react', '^19.0.0')).toBeUndefined()
  })

  it('configure({ dedupe }) oferece os módulos do host', async () => {
    const vue = { createApp() {} }
    configure({ dedupe: { vue: { version: '3.5.1', modules: { vue } } } })
    await protocol().pending()
    expect(await shared(protocol())('vue', '^3.4.0')).toEqual({ vue })
    expect(protocol().settings()).not.toHaveProperty('dedupe')
  })
})

describe('dedupe: cópia já no cache', () => {
  it('prefere a URL que carregou na visita anterior, se ela chega logo', async () => {
    const a = vi.fn(async () => ({ react: 'a' }))
    const b = vi.fn(async () => ({ react: 'b' }))
    localStorage.setItem('vitral:dedupe:react@19.2.0', 'https://b/react.js')
    const d = shared(protocol())
    const first = d('react', '^19.0.0', { version: '19.2.0', url: 'https://a/react.js', load: a })
    const second = d('react', '^19.0.0', { version: '19.2.0', url: 'https://b/react.js', load: b })
    expect(await first).toEqual({ react: 'b' })
    expect(await second).toEqual({ react: 'b' })
    expect(a).not.toHaveBeenCalled()
  })

  it('sem a URL lembrada a tempo, carrega a própria e passa a lembrar dela', async () => {
    vi.useFakeTimers()
    const a = vi.fn(async () => ({ react: 'a' }))
    localStorage.setItem('vitral:dedupe:react@19.2.0', 'https://b/react.js')
    const p = shared(protocol())('react', '^19.0.0', { version: '19.2.0', url: 'https://a/react.js', load: a })
    await vi.advanceTimersByTimeAsync(300)
    expect(await p).toEqual({ react: 'a' })
    expect(localStorage.getItem('vitral:dedupe:react@19.2.0')).toBe('https://a/react.js')
    vi.useRealTimers()
  })
})
