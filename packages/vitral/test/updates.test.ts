// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, checkUpdates, configure, createSlot, events, mountRemote, navigate, refresh, register, RemoteError, watchUpdates } from '../src/index'
import { flush } from './helpers'

afterEach(() => {
  __reset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)

/** Remote local cuja versão muda a cada download. */
function versioned(name: string, versions: Array<string | Error>) {
  const unmounts: string[] = []
  let i = 0
  const load = vi.fn(async () => {
    const v = versions[Math.min(i++, versions.length - 1)]
    if (v instanceof Error) throw v
    return {
      default: {
        mount(el: HTMLElement, props: { msg?: string }) {
          el.textContent = `${v}:${props.msg ?? ''}`
          return {
            update: (p: { msg?: string }) => (el.textContent = `${v}:${p.msg ?? ''}`),
            unmount: () => unmounts.push(v),
          }
        },
      },
      exposes: { './Mini': { default: { mount: (el: HTMLElement) => ((el.textContent = `mini ${v}`), { unmount: () => unmounts.push('mini ' + v) }) } } },
    }
  })
  register(name, { module: load })
  return { load, unmounts }
}

const box = () => document.body.appendChild(document.createElement('div'))

describe('refresh', () => {
  it('troca a montagem pela versão nova mantendo as props atuais', async () => {
    const { unmounts } = versioned('r1', ['v1', 'v2'])
    const el = box()
    const h = await mountRemote(el, 'r1', { msg: 'a' })
    h.update({ msg: 'b' })
    await refresh('r1')
    await flush()
    expect(el.textContent).toBe('v2:b')
    expect(unmounts).toEqual(['v1'])
    h.update({ msg: 'c' })
    expect(el.textContent).toBe('v2:c')
    h.unmount()
    expect(unmounts).toEqual(['v1', 'v2'])
    expect(el.innerHTML).toBe('')
  })

  it('também troca as partes expostas (r/Mini) e os slots', async () => {
    versioned('r2', ['v1', 'v2'])
    const a = box()
    await mountRemote(a, 'r2/Mini', {})
    const b = box()
    createSlot(b, { name: 'r2' })
    await flush()
    expect(a.textContent).toBe('mini v1')
    expect(b.textContent).toBe('v1:')
    await refresh('r2')
    await flush()
    expect(a.textContent).toBe('mini v2')
    expect(b.textContent).toBe('v2:')
  })

  it('não mexe em remotes de outro nome', async () => {
    versioned('r3', ['v1', 'v2'])
    const outro = versioned('r3x', ['x1', 'x2'])
    const el = box()
    await mountRemote(el, 'r3x', {})
    await refresh('r3')
    await flush()
    expect(el.textContent).toBe('x1:')
    expect(outro.load).toHaveBeenCalledTimes(1)
  })

  it('se a versão nova não carrega, rejeita e a antiga fica', async () => {
    versioned('r4', ['v1', new Error('rede')])
    const el = box()
    await mountRemote(el, 'r4', {})
    expect((await fail(refresh('r4'))).code).toBe('LOAD_FAILED')
    await flush()
    expect(el.textContent).toBe('v1:')
  })

  it('se mount() da versão nova falha, refresh rejeita e a antiga fica', async () => {
    let n = 0
    register('r5', {
      module: async () => ({ mount: (el: HTMLElement) => (++n > 1 ? Promise.reject(new Error('boom')) : ((el.textContent = 'v1'), { unmount() {} })) }),
    })
    const el = box()
    await mountRemote(el, 'r5', {})
    expect((await fail(refresh('r5'))).code).toBe('MOUNT_FAILED')
    expect(el.textContent).toBe('v1')
  })

  it('await refresh() só resolve com a versão nova já na tela', async () => {
    const { unmounts } = versioned('r7', ['v1', 'v2'])
    const el = box()
    await mountRemote(el, 'r7', { msg: 'a' })
    await refresh('r7')
    expect(el.textContent).toBe('v2:a')
    expect(unmounts).toEqual(['v1'])
  })

  it('refreshes seguidos: a versão do último fica, mesmo se o primeiro terminar depois', async () => {
    const gates: Array<() => void> = []
    const unmounts: string[] = []
    let i = 0
    register('r8', {
      module: async () => {
        const v = `v${++i}`
        return {
          mount: async (el: HTMLElement) => {
            // A troca para v2 demora mais que a troca para v3.
            if (v === 'v2') await new Promise<void>((r) => gates.push(r))
            el.textContent = v
            return { unmount: () => unmounts.push(v) }
          },
        }
      },
    })
    const el = box()
    await mountRemote(el, 'r8', {})
    const first = refresh('r8')
    await flush()
    await refresh('r8')
    expect(el.textContent).toBe('v3')
    gates.forEach((go) => go())
    await first
    await flush()
    expect(el.querySelectorAll('[data-vitral-root]')).toHaveLength(1)
    expect(el.textContent).toBe('v3')
    expect(unmounts).toEqual(['v1', 'v2'])
  })

  it('props atualizadas durante a troca chegam na versão nova', async () => {
    versioned('r9', ['v1', 'v2'])
    const el = box()
    const h = await mountRemote(el, 'r9', { msg: 'a' })
    const p = refresh('r9')
    h.update({ msg: 'b' })
    await p
    expect(el.textContent).toBe('v2:b')
  })

  it('desmontado durante o refresh: a versão nova é descartada', async () => {
    const { unmounts } = versioned('r6', ['v1', 'v2'])
    const el = box()
    const h = await mountRemote(el, 'r6', {})
    events.emit('vitral:refresh', 'r6')
    h.unmount()
    await flush()
    expect(unmounts).toEqual(['v1', 'v1'])
    expect(el.innerHTML).toBe('')
  })

  it('remote não registrado é NOT_REGISTERED', async () => {
    expect((await fail(refresh('nada'))).code).toBe('NOT_REGISTERED')
  })
})

describe('checkUpdates e watchUpdates', () => {
  const manifests = (entries: Record<string, string>) =>
    vi.fn(async (url: string) => {
      const entry = entries[url]
      return entry ? new Response(JSON.stringify({ name: 'x', entry })) : new Response('fora', { status: 500 })
    })

  async function mountFromManifest(name: string, url: string) {
    register(name, { url, module: { mount: () => ({ unmount() {} }) } })
    // Montado como se tivesse vindo do manifesto: registra a URL de verdade depois.
    await mountRemote(box(), name, {})
    register(name, url)
  }

  it('avisa uma vez por deploy novo, só para remotes de manifesto', async () => {
    configure({ allowedOrigins: ['*'] })
    const url = 'https://cdn.empresa.com/u1/vitral.json'
    await mountFromManifest('u1', url)
    vi.stubGlobal('fetch', manifests({ [url]: 'remote-v2.js' }))
    const got: unknown[] = []
    events.on('vitral:update-available', (d) => got.push(d))
    expect(await checkUpdates()).toEqual(['u1'])
    expect(await checkUpdates()).toEqual([])
    expect(got).toEqual([{ name: 'u1', entry: 'https://cdn.empresa.com/u1/remote-v2.js' }])
  })

  it('falha de rede e remote local não geram aviso', async () => {
    configure({ allowedOrigins: ['*'] })
    await mountFromManifest('u2', 'https://cdn.empresa.com/u2/vitral.json')
    register('local', { module: { mount: () => ({ unmount() {} }) } })
    await mountRemote(box(), 'local', {})
    vi.stubGlobal('fetch', manifests({}))
    expect(await checkUpdates()).toEqual([])
  })

  it('watchUpdates revalida ao navegar e para quando desligado', async () => {
    configure({ allowedOrigins: ['*'] })
    const url = 'https://cdn.empresa.com/u3/vitral.json'
    await mountFromManifest('u3', url)
    const fetch = manifests({ [url]: 'remote-v3.js' })
    vi.stubGlobal('fetch', fetch)
    const got = vi.fn()
    events.on('vitral:update-available', got)
    const stop = watchUpdates()
    navigate('/outra')
    navigate('/mais-uma')
    await flush()
    expect(got).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    stop()
    dispatchEvent(new PopStateEvent('popstate'))
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
