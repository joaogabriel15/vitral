// @vitest-environment happy-dom
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const router = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>()
  return {
    asPath: '/store/x',
    isReady: true,
    push: vi.fn(async () => true),
    replace: vi.fn(async () => true),
    events: {
      on: (t: string, fn: () => void) => void (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(fn),
      off: (t: string, fn: () => void) => void listeners.get(t)?.delete(fn),
      emit: (t: string) => listeners.get(t)?.forEach((fn) => fn()),
    },
  }
})
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
vi.mock('vitral-next-host-config', () => ({
  remotes: {
    delivery: { url: '/delivery-remote/vitral.json', basePath: '/delivery', routes: [{ public: '/store', zone: '/delivery/store' }], integrity: false },
    outro: { url: 'https://cdn.x/vitral.json', basePath: '/outro', preload: 'route' },
  },
  shared: { i18next: { version: '25.0.0', modules: async () => ({ i18next: { ok: true } }) } },
}))
const remoteProps = vi.hoisted(() => ({ last: undefined as any }))
vi.mock('../src/react', () => ({
  preload: vi.fn(),
  Remote: (p: any) => ((remoteProps.last = p), null),
}))

import { interceptNavigation, NextRemote, remoteFor } from '../src/next-host'
import { protocol } from '../src/core/state'
import { preload } from '../src/react'
import { devRemotes, hostModule, remoteHeaders, remoteRewrites, sharedGroups, throughAlias, withVitral } from '../src/next-config'

/** Navigation API mínima: o teste dispara os eventos `navigate`. */
function navigation() {
  const target = new EventTarget()
  ;(globalThis as any).navigation = target
  return (url: string, init: Partial<{ sameDocument: boolean; navigationType: string; cancelable: boolean }> = {}) => {
    const e = Object.assign(new Event('navigate', { cancelable: init.cancelable ?? true }), {
      destination: { url: new URL(url, location.href).href, sameDocument: init.sameDocument ?? false },
      navigationType: init.navigationType ?? 'push',
      hashChange: false,
      downloadRequest: null,
      formData: null,
    })
    target.dispatchEvent(e)
    return e.defaultPrevented
  }
}

afterEach(() => {
  delete (globalThis as any).navigation
  router.push.mockClear()
  router.replace.mockClear()
})

describe('vitral/next-host', () => {
  it('remoteFor: basePath e rotas públicas', () => {
    expect(remoteFor('/store/1')).toBe('delivery')
    expect(remoteFor('/delivery')).toBe('delivery')
    expect(remoteFor('/storex')).toBeUndefined()
    expect(remoteFor('/reporting')).toBeUndefined()
  })

  it('navegação de página inteira para rota de remote vira Router.push', () => {
    const go = navigation()
    const stop = interceptNavigation()
    expect(go('/store/9?a=1')).toBe(true)
    expect(router.push).toHaveBeenCalledWith('/store/9?a=1')
    expect(go('/delivery/x', { navigationType: 'replace' })).toBe(true)
    expect(router.replace).toHaveBeenCalledWith('/delivery/x')
    stop()
  })

  it('deixa passar: outra rota, mesma página (pushState), recarga e a repetição do próprio Next', () => {
    const go = navigation()
    const stop = interceptNavigation()
    expect(go('/reporting')).toBe(false)
    expect(go('/store/1', { sameDocument: true })).toBe(false)
    expect(go('/store/1', { navigationType: 'reload' })).toBe(false)
    expect(go('https://outro.com/store')).toBe(false)
    expect(go('/store/2')).toBe(true)
    // O Next pediu página inteira para a mesma URL (falha ao carregar a rota): não intercepta de novo.
    expect(go('/store/2')).toBe(false)
    router.events.emit('routeChangeComplete')
    expect(go('/store/2')).toBe(true)
    stop()
    expect(go('/store/3')).toBe(false)
  })

  it('erro ao carregar a rota: a navegação de página inteira do Next passa, sem laço', () => {
    const go = navigation()
    const stop = interceptNavigation()
    expect(go('/store/5')).toBe(true)
    // handleRouteInfoError do Next: emite routeChangeError e logo navega a página inteira para a mesma URL.
    router.events.emit('routeChangeError')
    expect(go('/store/5')).toBe(false)
    expect(router.push).toHaveBeenCalledTimes(1)
    stop()
  })

  it('sem Navigation API, nada muda', () => {
    expect(() => interceptNavigation()()).not.toThrow()
  })

  it('NextRemote registra os remotes, passa o roteador do host e oferece só sob demanda', async () => {
    const div = document.body.appendChild(document.createElement('div'))
    const root = createRoot(div)
    await act(async () => root.render(h(NextRemote, { name: 'delivery', props: { a: 1 } })))
    const { props, name } = remoteProps.last
    expect(name).toBe('delivery')
    expect(props.a).toBe(1)
    expect(props.__next).toMatchObject({ asPath: '/store/x', basePath: '/delivery', routes: [{ public: '/store', zone: '/delivery/store' }] })
    expect(props.__next.events).toBe(router.events)
    props.__next.push('/store/y')
    expect(router.push).toHaveBeenCalledWith('/store/y', undefined, undefined)
    const p = protocol()
    expect(p.entry('delivery')).toMatchObject({ url: expect.stringContaining('/delivery-remote/vitral.json'), integrity: false })
    await p.pending()
    expect(await p.dedupe!('i18next', '^25.0.0')).toEqual({ i18next: { ok: true } })
    await act(async () => root.unmount())
  })

  it('preload: a rota aberta já, os outros no ocioso, `route` nunca antes', async () => {
    vi.resetModules()
    history.replaceState(null, '', '/store/1')
    const idle = vi.fn((fn: () => void) => (fn(), 1))
    vi.stubGlobal('requestIdleCallback', idle)
    const { VitralNext } = await import('../src/next-host')
    const { preload: pre } = await import('../src/react')
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    await act(async () => root.render(h(VitralNext)))
    expect(vi.mocked(pre).mock.calls.map(([n]) => n)).toEqual(['delivery'])
    expect(idle).not.toHaveBeenCalled()
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
    void preload
  })
})

describe('vitral/next-config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vitral-next-'))
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), text)
  }
  beforeEach(() => {
    write('package.json', '{"name":"host"}')
    write('node_modules/i18next/package.json', JSON.stringify({ name: 'i18next', version: '25.1.0', main: 'index.js' }))
    write('node_modules/i18next/index.js', '')
    write('node_modules/@acme/ui/package.json', JSON.stringify({ name: '@acme/ui', version: '0.2.59', exports: { '.': './src/index.ts', './routes': './src/routes.ts', './assets/*': './src/assets/*', './styles/a.css': './src/a.css' } }))
    write('node_modules/@acme/ui/src/index.ts', '')
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const remotes = { delivery: { url: '/delivery-remote/vitral.json', basePath: '/delivery', routes: [{ public: '/delivery', zone: '/delivery' }, { public: '/store', zone: '/delivery/store' }] } }

  it('grupos: versão instalada, `pacote/*` com os subpaths JS, React de fora', () => {
    expect(sharedGroups(dir, ['i18next', '@acme/ui/*', 'react', 'react-dom/client'])).toEqual({
      i18next: { version: '25.1.0', specs: ['i18next'] },
      '@acme/ui': { version: '0.2.59', specs: ['@acme/ui', '@acme/ui/routes'] },
    })
    expect(() => sharedGroups(dir, ['nao-existe'])).toThrow()
  })

  it('módulo gerado: ofertas com import() sob demanda', () => {
    const code = hostModule(remotes, { '@acme/ui': { version: '0.2.59', specs: ['@acme/ui', '@acme/ui/routes'] } })
    expect(code).toContain('import("@acme/ui"), import("@acme/ui/routes")')
    expect(code).toContain('"@acme/ui/routes": m[1]')
    expect(code).toContain('"basePath": "/delivery"')
  })

  it('alias do pacote para a pasta: o subpath vira o arquivo do exports', () => {
    const ui = join(dir, 'node_modules/@acme/ui')
    expect(throughAlias('@acme/ui/routes', { '@acme/ui': ui })).toBe(join(ui, 'src/routes.ts'))
    expect(throughAlias('@acme/ui', { '@acme/ui': ui })).toBe('@acme/ui')
    expect(throughAlias('@acme/ui/routes', { '@acme/ui$': ui })).toBe('@acme/ui/routes')
    expect(throughAlias('@acme/ui/routes', {})).toBe('@acme/ui/routes')
    expect(hostModule(remotes, { '@acme/ui': { version: '0.2.59', specs: ['@acme/ui/routes'] } }, { '@acme/ui': ui })).toContain(`import(${JSON.stringify(join(ui, 'src/routes.ts'))})`)
  })

  it('devUrl só vale em dev, apontando para o vitral.json do dev server', () => {
    const r = { delivery: { url: '/d/vitral.json', basePath: '/d', devUrl: 'http://localhost:5173' }, outro: { url: '/o/vitral.json', basePath: '/o' } }
    expect(devRemotes(r, false)).toBe(r)
    expect(devRemotes(r, true).delivery.url).toBe('http://localhost:5173/vitral.json')
    expect(devRemotes({ x: { url: '/x.json', basePath: '/x', devUrl: 'http://localhost:5174/m.json' } }, true).x.url).toBe('http://localhost:5174/m.json')
    expect(devRemotes(r, true).outro.url).toBe('/o/vitral.json')
  })

  it('rewrites das rotas públicas e headers de cache dos arquivos do remote', () => {
    expect(remoteRewrites(remotes)).toEqual([{ source: '/store/:path*', destination: '/delivery/store/:path*' }])
    expect(remoteHeaders(remotes).map((x) => [x.source, x.headers[0].value])).toEqual([
      ['/delivery-remote/vitral.json', 'no-cache'],
      ['/delivery-remote/:file(remote-.*)', 'public, max-age=31536000, immutable'],
      ['/delivery-remote/split/:file*', 'public, max-age=31536000, immutable'],
    ])
    expect(remoteHeaders({ x: { url: 'https://cdn.x/vitral.json', basePath: '/x' } })).toEqual([])
  })

  it('withVitral junta com a config do app e aponta o módulo gerado', async () => {
    const userWebpack = vi.fn((c) => c)
    const config = withVitral(
      { rewrites: async () => [{ source: '/api/:p*', destination: 'http://api/:p*' }], headers: () => [{ source: '/a', headers: [] }], webpack: userWebpack },
      { remotes, share: ['i18next'], dir },
    )
    expect(await config.rewrites!()).toEqual({ beforeFiles: remoteRewrites(remotes), afterFiles: [{ source: '/api/:p*', destination: 'http://api/:p*' }], fallback: [] })
    expect((await config.headers!()).at(-1)).toEqual({ source: '/a', headers: [] })
    const wp = config.webpack!({ resolve: { alias: { x: 'y' } } }, {})
    const file = wp.resolve.alias['vitral-next-host-config$']
    expect(wp.resolve.alias.x).toBe('y')
    expect(userWebpack).toHaveBeenCalled()
    expect(readFileSync(file, 'utf8')).toContain('"i18next": { version: "25.1.0"')
    expect(config.transpilePackages).toEqual(['vitral'])
    expect(config.turbopack!.resolveAlias!['vitral-next-host-config']).toBe('./.vitral/host-config.mjs')
    expect(readFileSync(join(dir, '.vitral/.gitignore'), 'utf8')).toBe('*\n')
    // Sem webpack (Turbopack), o módulo usa o alias do turbopack, relativo ao app.
    withVitral({ turbopack: { resolveAlias: { '@acme/ui': './node_modules/@acme/ui' } } }, { remotes, share: ['@acme/ui/*'], dir })
    expect(readFileSync(file, 'utf8')).toContain('import("../node_modules/@acme/ui/src/routes.ts")')
    const merged = withVitral({ rewrites: () => ({ beforeFiles: [{ source: '/b', destination: '/c' }], afterFiles: [] }) }, { remotes, dir })
    expect((await merged.rewrites!() as any).beforeFiles).toEqual([...remoteRewrites(remotes), { source: '/b', destination: '/c' }])
  })

  it('withVitral não regrava o módulo igual e não quebra sem poder gravar (next start em disco só de leitura)', () => {
    withVitral({}, { remotes, dir })
    const file = join(dir, '.vitral/host-config.mjs')
    const before = statSync(file).mtimeMs
    utimesSync(file, new Date(0), new Date(0))
    withVitral({}, { remotes, dir })
    expect(statSync(file).mtimeMs).toBe(0)
    expect(before).toBeGreaterThan(0)
    const blocked = mkdtempSync(join(tmpdir(), 'vitral-ro-'))
    writeFileSync(join(blocked, 'package.json'), '{}')
    // `.vitral` como arquivo: a pasta não pode ser criada.
    writeFileSync(join(blocked, '.vitral'), '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => withVitral({}, { remotes, dir: blocked })).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('não consegui gravar'))
    warn.mockRestore()
    rmSync(blocked, { recursive: true, force: true })
  })
})
