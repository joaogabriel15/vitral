// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { timings } from '../src/core/host-slot'
import { metric } from '../src/core/util'
import { configure, loadRemote, mountRemote, register, type RemoteMetric } from '../src/index'
import { defineVitralElement } from '../src/element'
import { cleanup, flush } from './helpers'

afterEach(() => {
  cleanup()
  performance.clearMeasures()
  vi.unstubAllGlobals()
})

describe('métricas', () => {
  it('cada etapa vira performance.measure e chega no onMetric', async () => {
    const got: RemoteMetric[] = []
    configure({ onMetric: (m) => got.push(m), allowedOrigins: ['*'] })
    register('carrinho', `data:text/javascript,${encodeURIComponent('export default { mount() { return { unmount() {} } } }')}`)
    // URL data: não serve de base para `baseUrl`; aqui medimos só o download.
    await loadRemote('carrinho')
    expect(got.map((m) => m.stage)).toEqual(['manifest', 'js'])
    for (const m of got) {
      expect(m.name).toBe('carrinho')
      expect(m.duration).toBeGreaterThanOrEqual(0)
      expect(m.start).toBeGreaterThan(0)
    }
    expect(performance.getEntriesByName('vitral:carrinho:js', 'measure')).toHaveLength(1)
    expect(Object.keys(timings('carrinho'))).toEqual(['manifest', 'js'])
  })

  it('remote local também mede css e mount', async () => {
    const got: string[] = []
    configure({ onMetric: (m) => got.push(m.stage) })
    register('local', { module: { mount: () => ({ unmount() {} }) } })
    await mountRemote(document.body.appendChild(document.createElement('div')), 'local', {})
    expect(got).toEqual(['css', 'mount'])
  })

  it('erro no onMetric ou navegador sem performance.measure não quebra o carregamento', () => {
    configure({ onMetric: () => { throw new Error('rum fora do ar') } })
    expect(() => metric('x', 'js', performance.now())).not.toThrow()
    const measure = vi.spyOn(performance, 'measure').mockImplementation(() => {
      throw new TypeError('sem suporte a { start }')
    })
    expect(() => metric('x', 'js', performance.now())).not.toThrow()
    measure.mockRestore()
    const get = performance.getEntriesByName
    ;(performance as any).getEntriesByName = undefined
    try {
      expect(timings('x')).toEqual({})
    } finally {
      performance.getEntriesByName = get
    }
  })

  it('o evento vitral-ready traz os tempos no detail', async () => {
    defineVitralElement()
    register('pronto', { module: { mount: () => ({ unmount() {} }) } })
    const el = document.createElement('vitral-remote')
    el.setAttribute('name', 'pronto')
    const ready = new Promise<CustomEvent>((resolve) => el.addEventListener('vitral-ready', (e) => resolve(e as CustomEvent)))
    document.body.appendChild(el)
    await flush()
    const { detail } = await ready
    expect(Object.keys(detail.timings)).toEqual(['css', 'mount'])
  })
})
