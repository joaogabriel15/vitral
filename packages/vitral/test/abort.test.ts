// @vitest-environment happy-dom
// Cancelar a montagem: o remote não roda se o slot sai antes de ele chegar.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSlot, mountRemote, register, type RemoteModule } from '../src/index'
import { cleanup, flush } from './helpers'

afterEach(cleanup)

/** Remote local que só chega quando `arrive()` é chamado. */
function slowRemote() {
  const mount = vi.fn((el: HTMLElement) => ((el.textContent = 'montado'), { unmount: vi.fn() }))
  let arrive!: () => void
  const ready = new Promise<void>((r) => (arrive = r))
  register('lento', { module: async () => (await ready, { mount } as RemoteModule) })
  return { mount, arrive }
}

describe('AbortSignal', () => {
  it('signal já abortado: nem baixa, rejeita com o motivo', async () => {
    const { mount } = slowRemote()
    const c = new AbortController()
    c.abort(new Error('saiu'))
    await expect(mountRemote(document.body, 'lento', {}, { signal: c.signal })).rejects.toThrow('saiu')
    expect(mount).not.toHaveBeenCalled()
  })

  it('abortar durante o download: mount() não roda e nada fica no DOM', async () => {
    const { mount, arrive } = slowRemote()
    const c = new AbortController()
    const el = document.body.appendChild(document.createElement('div'))
    const done = mountRemote(el, 'lento', {}, { signal: c.signal })
    c.abort()
    arrive()
    await expect(done).rejects.toMatchObject({ name: 'AbortError' })
    expect(mount).not.toHaveBeenCalled()
    expect(el.childElementCount).toBe(0)
  })

  it('slot destruído enquanto baixa: o remote nunca monta', async () => {
    const { mount, arrive } = slowRemote()
    const el = document.body.appendChild(document.createElement('div'))
    const slot = createSlot(el, { name: 'lento' })
    await flush()
    slot.destroy()
    arrive()
    await flush()
    expect(mount).not.toHaveBeenCalled()
  })

  it('trocar de remote enquanto baixa: só o novo monta', async () => {
    const { mount, arrive } = slowRemote()
    const outro = vi.fn((el: HTMLElement) => ((el.textContent = 'outro'), { unmount() {} }))
    register('outro', { module: { mount: outro } })
    const el = document.body.appendChild(document.createElement('div'))
    const slot = createSlot(el, { name: 'lento' })
    slot.set({ name: 'outro' })
    arrive()
    await vi.waitFor(() => expect(el.textContent).toBe('outro'))
    expect(mount).not.toHaveBeenCalled()
  })

  it('abortar durante o mount(): desmonta quando ele termina', async () => {
    const unmount = vi.fn()
    let finish!: () => void
    register('async', { module: { mount: () => new Promise((r) => (finish = () => r({ unmount }))) } })
    const c = new AbortController()
    const done = mountRemote(document.body.appendChild(document.createElement('div')), 'async', {}, { signal: c.signal })
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    c.abort()
    finish()
    await expect(done).rejects.toMatchObject({ name: 'AbortError' })
    expect(unmount).toHaveBeenCalledTimes(1)
  })
})

describe('ctx.signal', () => {
  it('é abortado no unmount, depois do unmount do remote', async () => {
    let signal: AbortSignal | undefined
    const order: string[] = []
    register('sinal', {
      module: {
        mount(_el, _p, ctx) {
          signal = ctx.signal
          ctx.signal!.addEventListener('abort', () => order.push('abort'))
          return { unmount: () => order.push('unmount') }
        },
      },
    })
    const h = await mountRemote(document.body, 'sinal', {})
    expect(signal?.aborted).toBe(false)
    h.unmount()
    expect(signal?.aborted).toBe(true)
    expect(order).toEqual(['unmount', 'abort'])
  })

  it('é abortado quando o mount() falha', async () => {
    let signal: AbortSignal | undefined
    register('quebra', {
      module: {
        mount(_el, _p, ctx) {
          signal = ctx.signal
          throw new Error('x')
        },
      },
    })
    await expect(mountRemote(document.body, 'quebra', {})).rejects.toThrow()
    expect(signal?.aborted).toBe(true)
  })

  it('AbortError entregue ao reportError não chega no onError', async () => {
    const onError = vi.fn()
    let report!: (e: unknown) => void
    register('cancela', { module: { mount: (_el, _p, ctx) => ((report = ctx.reportError), { unmount() {} }) } })
    await mountRemote(document.body, 'cancela', {}, { onError })
    report(new DOMException('cancelado', 'AbortError'))
    expect(onError).not.toHaveBeenCalled()
    report(new Error('defeito'))
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
