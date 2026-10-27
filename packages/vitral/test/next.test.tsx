// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dynamic, formatUrl, hostRouter, Image, Link, nextRemote, RouterContext, setBasePath, useRouter, usePathname, type NextRouter } from '../src/next'
import vitral, { pureExcept } from '../src/vite'
import { entryCode } from '../src/vite/adapter'
import { loadNext, nextDefine, resolveNextId } from '../src/vite/next'
import { svgComponents } from '../src/vite/svg'
import { parseJsonc, pathCandidates, pathsFor, resolvePath } from '../src/vite/tsconfig'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let roots: Array<() => void> = []
afterEach(() => {
  roots.forEach((u) => u())
  roots = []
  document.body.innerHTML = ''
  setBasePath('')
  history.replaceState(null, '', '/')
})

async function render(node: React.ReactNode) {
  const div = document.body.appendChild(document.createElement('div'))
  const root = createRoot(div)
  await act(async () => root.render(node))
  roots.push(() => act(() => root.unmount()))
  return div
}

function Where() {
  const r = useRouter()
  return h('p', null, `${r.pathname}|${r.asPath}|${JSON.stringify(r.query)}|${usePathname()}`)
}

describe('vitral/next: roteador', () => {
  it('lê a URL sem o basePath e re-renderiza ao navegar', async () => {
    setBasePath('/delivery')
    history.replaceState(null, '', '/delivery/store?mode=a')
    const div = await render(h('div', null, h(Where), h(Link, { href: { pathname: '/orders', query: { id: '7' } } }, 'ir')))
    expect(div.querySelector('p')!.textContent).toBe('/store|/store?mode=a|{"mode":"a"}|/store')
    const a = div.querySelector('a')!
    expect(a.getAttribute('href')).toBe('/delivery/orders?id=7')
    await act(async () => a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(location.pathname + location.search).toBe('/delivery/orders?id=7')
    expect(div.querySelector('p')!.textContent).toBe('/orders|/orders?id=7|{"id":"7"}|/orders')
  })

  it('usa o RouterContext do host quando existe', async () => {
    const pushed: string[] = []
    const host = { pathname: '/x', asPath: '/x', basePath: '', query: {}, push: async (u: string) => (pushed.push(u), true) } as unknown as NextRouter
    const div = await render(h(RouterContext.Provider, { value: host }, h(Where), h(Link, { href: '/y' }, 'y')))
    expect(div.querySelector('p')!.textContent).toBe('/x|/x|{}|/x')
    await act(async () => div.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(pushed).toEqual(['/y'])
    expect(location.pathname).toBe('/')
  })

  it('não intercepta link externo nem clique com modificador', async () => {
    const div = await render(h('div', null, h(Link, { href: 'https://ex.com/a' }, 'e'), h(Link, { href: '/b' }, 'b')))
    const [ext, local] = div.querySelectorAll('a')
    expect(ext.getAttribute('href')).toBe('https://ex.com/a')
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    local.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('formatUrl aceita texto e objeto', () => {
    expect(formatUrl('/a?b=1')).toBe('/a?b=1')
    expect(formatUrl({ pathname: '/a', query: { t: ['1', '2'] }, hash: 'h' })).toBe('/a?t=1&t=2#h')
  })
})

describe('vitral/next: Image e dynamic', () => {
  it('Image vira <img> e aceita import estático e fill', async () => {
    const div = await render(h('div', null, h(Image, { src: { src: '/a.png', width: 10, height: 20 }, alt: 'a' }), h(Image, { src: '/b.png', alt: 'b', fill: true, priority: true })))
    const [a, b] = div.querySelectorAll('img')
    expect([a.getAttribute('src'), a.getAttribute('width'), a.getAttribute('height'), a.getAttribute('loading')]).toEqual(['/a.png', '10', '20', 'lazy'])
    expect([b.getAttribute('loading'), b.style.position, b.getAttribute('width')]).toEqual(['eager', 'absolute', null])
  })

  it('dynamic carrega o componente com o loading enquanto isso', async () => {
    let done!: (m: any) => void
    const Lazy = dynamic(() => new Promise((r) => (done = r)), { loading: () => h('i', null, '...') })
    const div = await render(h(Lazy as any, { n: 3 }))
    expect(div.textContent).toBe('...')
    await act(async () => done({ default: ({ n }: { n: number }) => h('b', null, `n=${n}`) }))
    expect(div.textContent).toBe('n=3')
  })
})

describe('plugin: next', () => {
  it('troca só os módulos next/* conhecidos e passa o basePath', () => {
    expect(resolveNextId('next/link')).toBe('\0vitral-next:next/link')
    expect(resolveNextId('next/router.js')).toBe('\0vitral-next:next/router')
    expect(resolveNextId('next/server')).toBeUndefined()
    expect(loadNext('\0vitral-next:next/link', { basePath: '/d' })).toContain('setBasePath("/d")')
    expect(loadNext('\0vitral:entry', {})).toBeUndefined()
  })

  it('process.env só com NODE_ENV e NEXT_PUBLIC_*', () => {
    const d = nextDefine({ NEXT_PUBLIC_API: 'x', SECRET: 'y' }, 'production')
    expect(JSON.parse(d['process.env'])).toEqual({ NODE_ENV: 'production', NEXT_PUBLIC_API: 'x' })
    expect(d['process.env.NEXT_PUBLIC_API']).toBe('"x"')
  })

  it('config roda sem this, como no Vite 5 e 6, e põe as NEXT_PUBLIC_* em process.env', async () => {
    process.env.NEXT_PUBLIC_TESTE = 'v'
    const config = vitral({ entry: 'src/next.tsx', next: true }).config as (...a: any[]) => Promise<any>
    const out = await config({}, { mode: 'production', command: 'build' })
    delete process.env.NEXT_PUBLIC_TESTE
    expect(JSON.parse(out.define['process.env'])).toMatchObject({ NODE_ENV: 'production', NEXT_PUBLIC_TESTE: 'v' })
    expect(out.build.lib.entry).toBe('__vitral_entry__.js')
  })
})

describe('vitral/next: roteador do host (NextRemote)', () => {
  const routes = [
    { public: '/delivery', zone: '/delivery' },
    { public: '/store', zone: '/delivery/store' },
    { public: '/orders', zone: '/delivery/store/orders' },
  ]
  const host = (asPath: string, pushed: string[] = []) => ({ asPath, basePath: '/delivery', routes, push: (u: string) => void pushed.push(u), replace: (u: string) => void pushed.push('replace:' + u) })

  it('a URL pública vira o caminho da zona, sem o basePath', () => {
    expect(hostRouter(host('/orders/7?x=1')).asPath).toBe('/store/orders/7?x=1')
    expect(hostRouter(host('/orders/7?x=1')).query).toEqual({ x: '1' })
    expect(hostRouter(host('/delivery')).pathname).toBe('/')
    expect(hostRouter(host('/delivery/approvals')).pathname).toBe('/approvals')
  })

  it('push e Link vão para a rota pública pelo roteador do host', async () => {
    const pushed: string[] = []
    const Remote = nextRemote(() => h('div', null, h(Where), h(Link, { href: '/store/orders/9' }, 'p')))
    const div = await render(h(Remote, { __next: host('/store', pushed) }))
    expect(div.querySelector('p')!.textContent).toBe('/store|/store|{}|/store')
    const a = div.querySelector('a')!
    expect(a.getAttribute('href')).toBe('/orders/9')
    await act(async () => a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
    expect(pushed).toEqual(['/orders/9'])
    await hostRouter(host('/store', pushed)).replace('/approvals')
    expect(pushed).toEqual(['/orders/9', 'replace:/delivery/approvals'])
  })

  it('sem __next, o remote usa o roteador da URL', async () => {
    const Remote = nextRemote(() => h(Where))
    history.replaceState(null, '', '/a?b=2')
    const div = await render(h(Remote, {}))
    expect(div.querySelector('p')!.textContent).toBe('/a|/a?b=2|{"b":"2"}|/a')
  })

  it('a entrada do modo next embrulha o componente com nextRemote', () => {
    expect(entryCode('/app/src/remote.tsx', 'react', 'x', true)).toContain('wrap(nextRemote(c))')
    expect(entryCode('/app/src/remote.tsx', 'react', 'x')).not.toContain('nextRemote')
  })
})

describe('plugin: next no build', () => {
  it('NODE_ENV=development do .env não vira build de dev', async () => {
    const before = process.env.VITE_USER_NODE_ENV
    delete process.env.VITE_USER_NODE_ENV
    await (vitral({ entry: 'src/next.tsx', next: true }).config as any)({}, { mode: 'production', command: 'build' })
    expect(process.env.VITE_USER_NODE_ENV).toBe('')
    if (before === undefined) delete process.env.VITE_USER_NODE_ENV
    else process.env.VITE_USER_NODE_ENV = before
  })

  it('sem o SVGR instalado, .svg continua URL', async () => {
    expect(await svgComponents(tmpdir())).toBeUndefined()
  })

  it('sideEffectFree: só o CSS do pacote mantém efeitos', () => {
    const pure = pureExcept(['@acme/ui'])
    expect(pure('/app/node_modules/@acme/ui/src/a.ts')).toBe(false)
    expect(pure('/app/node_modules/@acme/ui/src/a.css')).toBe(true)
    expect(pure('/app/node_modules/outro/index.js')).toBe(true)
  })
})

describe('tsconfig paths', () => {
  it('lê JSON com comentários e vírgulas sobrando', () => {
    expect(parseJsonc('{ // a\n "a": "x//y", /* b */ "b": [1,], }')).toEqual({ a: 'x//y', b: [1] })
  })

  it('exato vence curinga, prefixo mais longo vence, alvos em ordem, pacote em node_modules volta ao nome', () => {
    const c = { base: '/app', paths: { '@/*': ['./src/*'], '@/ui/*': ['./ui/*', './src/ui/*'], '@/ui/x': ['./x.ts'], zod: ['./node_modules/zod'], '@acme/ui': ['../ui/src/index.ts', './node_modules/@acme/ui'] } }
    expect(pathCandidates('@/a/b', c)).toEqual(['/app/src/a/b'])
    expect(pathCandidates('@/ui/btn', c)).toEqual(['/app/ui/btn', '/app/src/ui/btn'])
    expect(pathCandidates('@/ui/x', c)).toEqual(['/app/x.ts'])
    expect(pathCandidates('zod', c)).toBeUndefined()
    expect(pathCandidates('@acme/ui', c)).toEqual(['/ui/src/index.ts', '@acme/ui'])
    expect(pathCandidates('lodash', c)).toBeUndefined()
  })

  it('arquivo em node_modules só usa o tsconfig do próprio pacote', () => {
    const root = mkdtempSync(join(tmpdir(), 'vitral-paths-'))
    writeFileSync(join(root, 'tsconfig.json'), '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}')
    mkdirSync(join(root, 'node_modules/lib/dist'), { recursive: true })
    mkdirSync(join(root, 'node_modules/ui/src'), { recursive: true })
    writeFileSync(join(root, 'node_modules/ui/tsconfig.json'), '{"extends":"../../tsconfig.json"}')
    expect(pathsFor(join(root, 'src/a.ts'))?.base).toBe(root)
    expect(pathsFor(join(root, 'node_modules/lib/dist/a.js'))).toBeNull()
    // `extends` herda os paths, relativos ao tsconfig que os declara.
    expect(pathsFor(join(root, 'node_modules/ui/src/a.ts'))).toMatchObject({ base: root, paths: { '@/*': ['./src/*'] } })
    rmSync(root, { recursive: true, force: true })
  })
})

describe('plugin: next em dev', () => {
  it('o pré-bundle leva o adaptador e os paths do tsconfig de cada pacote', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vitral-dev-'))
    mkdirSync(join(root, 'node_modules/@acme/ui/src/lib'), { recursive: true })
    writeFileSync(join(root, 'node_modules/@acme/ui/tsconfig.json'), '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}')
    writeFileSync(join(root, 'node_modules/@acme/ui/src/lib/utils.ts'), '')
    const importer = join(root, 'node_modules/@acme/ui/src/a.tsx')
    expect(resolvePath('@/lib/utils', importer)).toBe(join(root, 'node_modules/@acme/ui/src/lib/utils.ts'))
    expect(resolvePath('@/nao/existe', importer)).toBeUndefined()
    expect(resolvePath('react', importer)).toBeUndefined()
    const out = await (vitral({ entry: 'src/next.tsx', next: true, adapter: 'react' }).config as any)({ root }, { mode: 'development', command: 'serve' })
    expect(out.optimizeDeps).toMatchObject({ entries: ['src/next.tsx'], include: ['vitral/react', 'vitral/next'] })
    const plugin = out.optimizeDeps.esbuildOptions.plugins[0]
    let onResolve: any
    plugin.setup({ onResolve: (_: unknown, fn: unknown) => (onResolve = fn) })
    expect(onResolve({ path: '@/lib/utils', importer })).toEqual({ path: join(root, 'node_modules/@acme/ui/src/lib/utils.ts') })
    rmSync(root, { recursive: true, force: true })
  })
})
