// @vitest-environment happy-dom
// `watchLeaks()`: o que o remote deixa em window/document depois do unmount.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchLeaks, type LeakReport } from '../src/devtools'
import { mountRemote, register } from '../src/index'
import { cleanup } from './helpers'

const LEAKY = pathToFileURL(resolve(__dirname, 'fixtures/remote-leaky.mjs')).href
let stop: (() => void) | undefined
afterEach(() => {
  stop?.()
  cleanup()
})

describe('watchLeaks', () => {
  it('aponta ouvintes que ficaram; os com ctx.signal e os removidos não contam', async () => {
    const reports: LeakReport[] = []
    stop = watchLeaks({ delay: 0, onLeak: (r) => reports.push(r) })
    register('vaza', { url: LEAKY })
    const h = await mountRemote(document.body.appendChild(document.createElement('div')), 'vaza', {})
    h.unmount()
    await vi.waitFor(() => expect(reports).toHaveLength(1))
    expect(reports[0].name).toBe('vaza')
    expect(reports[0].listeners.map((l) => `${l.target}.${l.type}`)).toEqual(['window.resize', 'document.keydown'])
    expect(reports[0].intervals).toEqual([])
  })

  it('remote que limpa tudo: nenhum aviso', async () => {
    const onLeak = vi.fn()
    stop = watchLeaks({ delay: 0, onLeak })
    register('limpo', { url: LEAKY })
    const h = await mountRemote(document.body.appendChild(document.createElement('div')), 'limpo', { limpo: true })
    h.unmount()
    await new Promise((r) => setTimeout(r, 20))
    expect(onLeak).not.toHaveBeenCalled()
  })

  it('aviso padrão no console e desligar restaura tudo', async () => {
    const add = EventTarget.prototype.addEventListener
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const off = watchLeaks({ delay: 0 })
    expect(EventTarget.prototype.addEventListener).not.toBe(add)
    register('vaza2', { url: LEAKY })
    const h = await mountRemote(document.body.appendChild(document.createElement('div')), 'vaza2', {})
    h.unmount()
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('vaza2 saiu da página e deixou 2 itens: window.resize, document.keydown'), expect.anything()))
    off()
    expect(EventTarget.prototype.addEventListener).toBe(add)
  })
})
