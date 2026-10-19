// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, mountRemote, type RemoteError } from '../src/index'
import { singleSpaRemote, type SingleSpaLifecycles } from '../src/single-spa'
import { flush } from './helpers'

afterEach(() => {
  __reset()
  document.body.replaceChildren()
})

const host = () => document.body.appendChild(document.createElement('div'))

/** App do single-spa escrito à mão: escreve no `domElement` e registra cada lifecycle. */
function app(extra: Partial<SingleSpaLifecycles> = {}) {
  const log: string[] = []
  const lifecycles = {
    bootstrap: vi.fn(async (p: any) => void log.push(`bootstrap ${p.name}`)),
    mount: vi.fn(async (p: any) => {
      await Promise.resolve()
      log.push(`mount ${p.name}`)
      p.domElement.textContent = `${p.name}:${p.usuario}`
    }),
    unmount: vi.fn(async (p: any) => {
      await new Promise((r) => setTimeout(r, 5))
      log.push(`unmount ${p.name}`)
      p.domElement.textContent = ''
    }),
    ...extra,
  }
  return { log, lifecycles }
}

describe('singleSpaRemote', () => {
  it('chama bootstrap uma vez e mount com as props do host, name e domElement', async () => {
    const { log, lifecycles } = app()
    configure({ remotes: { conta: { module: { default: singleSpaRemote(lifecycles) } } } })
    const el = host()
    const r = await mountRemote(el, 'conta', { usuario: 'ana' })
    expect(el.textContent).toBe('conta:ana')
    const props = lifecycles.mount.mock.calls[0][0]
    expect(props).toMatchObject({ usuario: 'ana', name: 'conta' })
    expect(el.contains(props.domElement)).toBe(true)
    r.unmount()
    await new Promise((r) => setTimeout(r, 10))
    expect(el.textContent).toBe('')
    await mountRemote(el, 'conta', { usuario: 'bia' })
    expect(log).toEqual(['bootstrap conta', 'mount conta', 'unmount conta', 'mount conta'])
  })

  it('aceita o namespace do módulo (import * as lifecycles) e listas de funções', async () => {
    const ordem: string[] = []
    const ns = {
      default: {
        bootstrap: [() => void ordem.push('b1'), async () => void ordem.push('b2')],
        mount: [(p: any) => void (p.domElement.textContent = 'ok'), () => void ordem.push('m')],
        unmount: () => void ordem.push('u'),
      },
    }
    configure({ remotes: { x: { module: { default: singleSpaRemote(ns) } } } })
    const el = host()
    await mountRemote(el, 'x', {})
    expect(el.textContent).toBe('ok')
    expect(ordem).toEqual(['b1', 'b2', 'm'])
  })

  it('um mount novo espera o unmount anterior terminar', async () => {
    const { log, lifecycles } = app()
    configure({ remotes: { conta: { module: { default: singleSpaRemote(lifecycles) } } } })
    const a = await mountRemote(host(), 'conta', { usuario: 'ana' })
    a.unmount()
    await mountRemote(host(), 'conta', { usuario: 'bia' })
    expect(log).toEqual(['bootstrap conta', 'mount conta', 'unmount conta', 'mount conta'])
  })

  it('duas instâncias ao mesmo tempo recebem names diferentes', async () => {
    const { lifecycles } = app()
    configure({ remotes: { conta: { module: { default: singleSpaRemote(lifecycles) } } } })
    const a = host()
    const b = host()
    await mountRemote(a, 'conta', { usuario: 'ana' })
    const rb = await mountRemote(b, 'conta', { usuario: 'bia' })
    expect(a.textContent).toBe('conta:ana')
    expect(b.textContent).toBe('conta-2:bia')
    rb.unmount()
    await new Promise((r) => setTimeout(r, 10))
    // O name liberado volta a ser usado.
    const c = host()
    await mountRemote(c, 'conta', { usuario: 'cris' })
    expect(c.textContent).toBe('conta-2:cris')
  })

  it('update usa o lifecycle update (parcels) com as props novas', async () => {
    const update = vi.fn(async (p: any) => void (p.domElement.textContent = `${p.name}:${p.usuario}!`))
    const { lifecycles } = app({ update })
    configure({ remotes: { conta: { module: { default: singleSpaRemote(lifecycles) } } } })
    const el = host()
    const r = await mountRemote(el, 'conta', { usuario: 'ana' })
    r.update?.({ usuario: 'bia' })
    await flush()
    expect(el.textContent).toBe('conta:bia!')
    expect(lifecycles.mount).toHaveBeenCalledTimes(1)
  })

  it('sem update, o app é desmontado e montado de novo com as props novas', async () => {
    const { log, lifecycles } = app()
    configure({ remotes: { conta: { module: { default: singleSpaRemote(lifecycles) } } } })
    const el = host()
    const r = await mountRemote(el, 'conta', { usuario: 'ana' })
    r.update?.({ usuario: 'bia' })
    await new Promise((r) => setTimeout(r, 20))
    expect(el.textContent).toBe('conta:bia')
    expect(log).toEqual(['bootstrap conta', 'mount conta', 'unmount conta', 'mount conta'])
    expect(lifecycles.unmount.mock.calls[0][0].usuario).toBe('ana')
  })

  it('erro no mount vira MOUNT_FAILED; erro no bootstrap deixa tentar de novo', async () => {
    let quebra = true
    const bootstrap = vi.fn(async () => {
      if (quebra) throw new Error('sem config')
    })
    const { lifecycles } = app({ bootstrap })
    configure({ remotes: { conta: { module: { default: singleSpaRemote(lifecycles) } } } })
    const e = (await mountRemote(host(), 'conta', {}).catch((e) => e)) as RemoteError
    expect(e.code).toBe('MOUNT_FAILED')
    expect((e.cause as Error).message).toBe('sem config')
    quebra = false
    const el = host()
    await mountRemote(el, 'conta', { usuario: 'ana' })
    expect(el.textContent).toBe('conta:ana')
    expect(bootstrap).toHaveBeenCalledTimes(2)
  })

  it('erro no unmount vai para o onError do host', async () => {
    const { lifecycles } = app({ unmount: async () => Promise.reject(new Error('preso')) })
    configure({ remotes: { conta: { module: { default: singleSpaRemote(lifecycles) } } } })
    const onError = vi.fn()
    const r = await mountRemote(host(), 'conta', {}, { onError })
    r.unmount()
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].code).toBe('RENDER_FAILED')
  })

  it('recusa um objeto sem mount e unmount', () => {
    expect(() => singleSpaRemote({ default: {} } as any)).toThrow('faltam os lifecycles mount e unmount')
  })
})
