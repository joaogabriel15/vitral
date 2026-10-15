// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearKeepAlive, hostSlot, when } from '../src/core/host-slot'
import { register, type RemoteContext } from '../src/index'
import { mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

/** IntersectionObserver falso: `show()` põe os elementos observados na tela. */
const observers: { els: Element[]; cb: IntersectionObserverCallback; margin?: string; off: boolean }[] = []
class FakeIO {
  o: (typeof observers)[number]
  constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
    this.o = { els: [], cb, margin: init?.rootMargin, off: false }
    observers.push(this.o)
  }
  observe(el: Element) {
    this.o.els.push(el)
  }
  disconnect() {
    this.o.off = true
  }
}
const show = () => {
  for (const o of observers) if (!o.off) o.cb(o.els.map((target) => ({ target, isIntersecting: true })) as any, o as any)
}

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('IntersectionObserver', FakeIO)
})
afterEach(() => {
  clearKeepAlive()
  vi.unstubAllGlobals()
  cleanup()
})

const box = () => document.body.appendChild(document.createElement('div'))

describe('when', () => {
  it('lazy e visible: espera o elemento chegar a 200px da tela', () => {
    const fn = vi.fn()
    when(box(), 'lazy', fn)
    expect(fn).not.toHaveBeenCalled()
    expect(observers[0].margin).toBe('200px')
    show()
    show()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('sem IntersectionObserver, roda na hora', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const fn = vi.fn()
    when(box(), 'visible', fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('idle usa requestIdleCallback, ou um timer onde ele não existe', async () => {
    const cancelled = new Set<number>()
    let ids = 0
    const ric = vi.fn((cb: () => void) => {
      const id = ++ids
      setTimeout(() => cancelled.has(id) || cb(), 0)
      return id
    })
    const cancel = vi.fn((id: number) => cancelled.add(id))
    vi.stubGlobal('requestIdleCallback', ric)
    vi.stubGlobal('cancelIdleCallback', cancel)
    const fn = vi.fn()
    when(box(), 'idle', fn)()
    expect(cancel).toHaveBeenCalledWith(1)
    when(box(), 'idle', fn)
    await flush()
    expect(fn).toHaveBeenCalledTimes(1)

    vi.stubGlobal('requestIdleCallback', undefined)
    const late = vi.fn()
    when(box(), 'idle', late)
    await new Promise((r) => setTimeout(r, 5))
    expect(late).toHaveBeenCalledTimes(1)
    const never = vi.fn()
    when(box(), 'idle', never)()
    await new Promise((r) => setTimeout(r, 5))
    expect(never).not.toHaveBeenCalled()
  })

  it('hover: no primeiro pointerenter ou foco, uma vez só', () => {
    const el = box()
    const fn = vi.fn()
    when(el, 'hover', fn)
    el.dispatchEvent(new Event('focusin'))
    el.dispatchEvent(new Event('pointerenter'))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('sem modo, roda na hora', () => {
    const fn = vi.fn()
    when(box(), undefined, fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('loading e prefetch', () => {
  it('loading="lazy" não baixa nada antes de aparecer', async () => {
    const load = vi.fn(async () => ({ mount: (el: HTMLElement) => ((el.textContent = 'oi'), { unmount() {} }) }))
    register('x', { module: load })
    const el = box()
    hostSlot(el, { name: 'x', loading: 'lazy' })
    await flush()
    expect(load).not.toHaveBeenCalled()
    show()
    await flush()
    expect(el.textContent).toBe('oi')
  })

  it('destroy antes de aparecer cancela a montagem', async () => {
    const load = vi.fn(async () => ({ mount: () => ({ unmount() {} }) }))
    register('x', { module: load })
    const slot = hostSlot(box(), { name: 'x', loading: 'lazy' })
    slot.update({ a: 1 })
    slot.set({ name: 'x' })
    slot.retry()
    slot.destroy()
    show()
    await flush()
    expect(load).not.toHaveBeenCalled()
  })

  it('prefetch="hover" baixa sem montar, e a montagem reaproveita', async () => {
    const load = vi.fn(async () => ({ mount: () => ({ unmount() {} }) }))
    register('x', { module: load })
    const el = box()
    hostSlot(el, { name: 'x', loading: 'lazy', prefetch: 'hover' })
    el.dispatchEvent(new Event('pointerenter'))
    await flush()
    expect(load).toHaveBeenCalledTimes(1)
    expect(el.querySelector('[data-vitral-root]')).toBeNull()
    show()
    await flush()
    expect(el.querySelector('[data-vitral-root]')).not.toBeNull()
    expect(load).toHaveBeenCalledTimes(1)
  })
})

describe('keep-alive', () => {
  function counter(name: string) {
    const log: string[] = []
    const m = mockRemote(name, (el, p: any, ctx: RemoteContext) => {
      if (!el.dataset.ready) {
        el.dataset.ready = '1'
        ctx.onActivate?.(() => log.push('ativo'))
        ctx.onDeactivate?.(() => log.push('pausado'))
      }
      el.textContent = `${name}:${p.n}`
    })
    return { m, log }
  }

  it('sai da página sem desmontar e volta só com update(props)', async () => {
    const { m, log } = counter('aba')
    const first = box()
    const a = hostSlot(first, { name: 'aba', props: { n: 1 }, keepAlive: true })
    await flush()
    expect(a.status).toBe('ready')
    a.destroy()
    expect(first.textContent).toBe('')
    expect(document.querySelector('[data-vitral-keep-alive]')!.textContent).toBe('aba:1')
    expect(log).toEqual(['pausado'])

    const second = box()
    const onStatus = vi.fn()
    const b = hostSlot(second, { name: 'aba', props: { n: 2 }, keepAlive: true, onStatus })
    expect(second.textContent).toBe('aba:2')
    expect(onStatus).toHaveBeenCalledWith('ready', null)
    expect(b.status).toBe('ready')
    expect(m.mounts).toBe(1)
    expect(log).toEqual(['pausado', 'ativo'])
    b.update({ n: 3 })
    expect(second.textContent).toBe('aba:3')
  })

  it('LRU: passando do máximo, o mais antigo desmonta', async () => {
    const remotes = ['a', 'b', 'c'].map((n) => counter(n).m)
    for (const name of ['a', 'b', 'c']) {
      const s = hostSlot(box(), { name, props: { n: 1 }, keepAlive: 2 })
      await flush()
      s.destroy()
    }
    expect(remotes.map((r) => r.mounted)).toEqual([false, true, true])
    // Guardar de novo o mesmo nome troca o antigo.
    const s = hostSlot(box(), { name: 'b', props: { n: 1 }, keepAlive: 2 })
    await flush()
    const again = hostSlot(box(), { name: 'b', props: { n: 1 }, keepAlive: 2 })
    await flush()
    s.destroy()
    again.destroy()
    expect(remotes[1].mounts).toBe(2)
  })

  it('remote que não ficou pronto não é guardado', async () => {
    register('quebra', { module: { mount: () => { throw new Error('x') } } })
    const el = box()
    const s = hostSlot(el, { name: 'quebra', keepAlive: true })
    await flush()
    expect(s.status).toBe('error')
    s.destroy()
    expect(document.querySelector('[data-vitral-keep-alive]')?.childElementCount ?? 0).toBe(0)
    expect(el.childElementCount).toBe(0)
  })

  it('avisa remotes em Shadow DOM e usa moveBefore onde existe', async () => {
    const { log } = counter('sombra')
    const moveBefore = vi.fn(function (this: Element, node: Node) {
      this.appendChild(node)
    })
    ;(Element.prototype as any).moveBefore = moveBefore
    try {
      const s = hostSlot(box(), { name: 'sombra', props: { n: 1 }, isolate: 'shadow', keepAlive: true })
      // Com Shadow DOM a montagem baixa o módulo de estilos antes: mais que um flush.
      await vi.waitFor(() => expect(s.status).toBe('ready'))
      s.destroy()
      expect(log).toEqual(['pausado'])
      expect(moveBefore).toHaveBeenCalled()
    } finally {
      delete (Element.prototype as any).moveBefore
    }
  })
})
