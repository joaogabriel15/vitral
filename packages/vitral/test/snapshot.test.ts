// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { hostSlot } from '../src/core/host-slot'
import { ctxHooks } from '../src/core/hooks'
import { register } from '../src/index'
import { clearSnapshots, snapshots } from '../src/snapshot'
import { mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  delete ctxHooks.snapshot
})

const target = () => document.body.appendChild(document.createElement('div'))

describe('snapshot da última tela', () => {
  it('guarda ao sair e mostra na volta, inerte, até o remote montar', async () => {
    snapshots()
    mockRemote<{ n: number }>('lista', (el, p) => (el.innerHTML = `<p onclick="alert(1)">itens ${p.n}</p><script>x()</script>`))
    const a = target()
    const s1 = hostSlot(a, { name: 'lista', props: { n: 2 }, snapshot: true })
    await flush(10)
    expect(a.querySelector('p')!.textContent).toBe('itens 2')
    s1.destroy()
    await flush()

    // Remote que demora: o snapshot aparece já.
    let go!: () => void
    register('lista', { module: { mount: async (el, p: any) => (await new Promise<void>((r) => (go = r)), (el.innerHTML = `<p>novo ${p.n}</p>`), { unmount() {} }) } })
    const shown: boolean[] = []
    const b = target()
    hostSlot(b, { name: 'lista', props: { n: 2 }, snapshot: true, onSnapshot: (v) => shown.push(v) })
    const snap = b.querySelector<HTMLElement>('[data-vitral-snapshot]')!
    expect(snap.querySelector('p')!.textContent).toBe('itens 2')
    expect(snap.inert).toBe(true)
    expect(snap.querySelector('script')).toBeNull()
    expect(snap.querySelector('p')!.hasAttribute('onclick')).toBe(false)
    expect(shown).toEqual([true])
    await flush(10)
    go()
    await flush(10)
    expect(b.querySelector('[data-vitral-snapshot]')).toBeNull()
    expect(b.textContent).toBe('novo 2')
    expect(shown).toEqual([true, false])
  })

  it('props diferentes, sem `snapshot` ou sem snapshots(): nada aparece', async () => {
    snapshots()
    mockRemote<{ n: number }>('lista', (el, p) => (el.textContent = `itens ${p.n}`))
    const s = hostSlot(target(), { name: 'lista', props: { n: 1 }, snapshot: true })
    await flush(10)
    s.destroy()
    expect(hostSlot(target(), { name: 'lista', props: { n: 9 }, snapshot: true }) && document.querySelector('[data-vitral-snapshot]')).toBeNull()
    expect(hostSlot(target(), { name: 'lista', props: { n: 1 } }) && document.querySelector('[data-vitral-snapshot]')).toBeNull()
    delete ctxHooks.snapshot
    expect(hostSlot(target(), { name: 'lista', props: { n: 1 }, snapshot: true }) && document.querySelector('[data-vitral-snapshot]')).toBeNull()
    snapshots()
    clearSnapshots()
    expect(hostSlot(target(), { name: 'lista', props: { n: 1 }, snapshot: true }) && document.querySelector('[data-vitral-snapshot]')).toBeNull()
  })
})
