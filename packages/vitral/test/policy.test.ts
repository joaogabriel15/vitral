// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { choose, configure, policy, signals, signalsFrom } from '../src/index'
import { warmRoutes } from '../src/core/loader'
import { cleanup } from './helpers'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('política por rede e aparelho', () => {
  it('a tabela', () => {
    expect(choose({})).toBe('all')
    expect(choose({ effectiveType: '4g', deviceMemory: 8 })).toBe('all')
    expect(choose({ saveData: true, effectiveType: '4g' })).toBe('lazy')
    expect(choose({ effectiveType: 'slow-2g' })).toBe('lazy')
    expect(choose({ effectiveType: '2g' })).toBe('lazy')
    expect(choose({ effectiveType: '3g' })).toBe('critical')
    expect(choose({ deviceMemory: 2 })).toBe('critical')
    expect(choose({ deviceMemory: 4 })).toBe('all')
  })

  it('Client Hints do servidor', () => {
    expect(signalsFrom(new Headers({ 'save-data': 'on', ect: '3g', 'device-memory': '4' }))).toEqual({ saveData: true, effectiveType: '3g', deviceMemory: 4 })
    // Objeto de headers do Node.
    expect(choose(signalsFrom({ ect: '4g', 'device-memory': ['0.5'] }))).toBe('critical')
    expect(signalsFrom({})).toEqual({ saveData: undefined, effectiveType: undefined, deviceMemory: undefined })
  })

  it('lê o navegador; configure fixa a política', () => {
    vi.stubGlobal('navigator', { ...navigator, connection: { effectiveType: '3g' } })
    expect(policy()).toBe('critical')
    // A conta do núcleo é a mesma da tabela.
    for (const connection of [{}, { saveData: true }, { effectiveType: '2g' }, { effectiveType: '4g' }]) {
      for (const deviceMemory of [undefined, 1, 8]) {
        vi.stubGlobal('navigator', { ...navigator, connection, deviceMemory })
        expect(policy()).toBe(choose(signals()))
      }
    }
    configure({ policy: 'all' })
    expect(policy()).toBe('all')
  })

  it('warmRoutes não baixa fora de "all"', async () => {
    const f = vi.fn(async () => new Response(''))
    vi.stubGlobal('fetch', f)
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => (fn(), 1))
    const r = { split: { entry: 'https://x/split/e.js', chunks: [], lazy: ['https://x/split/rota.js'], sri: {} } } as never
    configure({ policy: 'critical' })
    warmRoutes(r)
    expect(f).not.toHaveBeenCalled()
    configure({ policy: 'all' })
    warmRoutes(r)
    await vi.waitFor(() => expect(f).toHaveBeenCalledWith('https://x/split/rota.js', expect.anything()))
  })
})
