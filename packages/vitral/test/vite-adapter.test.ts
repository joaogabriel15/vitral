// @vitest-environment happy-dom
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { build, type PluginOption } from 'vite'
import { afterAll, describe, expect, it, vi } from 'vitest'
import vitral, { type VitralViteOptions } from '../src/vite'
import { detectAdapter, entryCode, findEntry } from '../src/vite/adapter'
import type { RemoteContext, RemoteModule } from '../src/index'

const root = resolve(__dirname, 'fixtures/vite-adapter')
const src = resolve(__dirname, '../src')
const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
const dirs: string[] = []
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

/** Builda o fixture com o plugin e importa o JS gerado. */
async function buildRemote(options: VitralViteOptions, plugins: PluginOption[] = []): Promise<RemoteModule> {
  // Dentro do pacote: o Vitest só importa arquivos do projeto.
  mkdirSync(cache, { recursive: true })
  const outDir = mkdtempSync(join(cache, 'adapter-'))
  dirs.push(outDir)
  // Como num `vite build` de verdade (o Vitest põe NODE_ENV=test, e o JSX sairia em modo dev).
  const env = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    // O fixture importa `vitral` como um projeto de verdade; aqui aponta para o código-fonte.
    resolve: { alias: [{ find: /^vitral\/(.*)$/, replacement: `${src}/$1` }, { find: /^vitral$/, replacement: `${src}/index.ts` }] },
    plugins: [...plugins, vitral(options)],
    build: { outDir, emptyOutDir: true },
  }).finally(() => (process.env.NODE_ENV = env))
  const { entry } = JSON.parse(readFileSync(join(outDir, 'vitral.json'), 'utf8'))
  return (await import(/* @vite-ignore */ pathToFileURL(join(outDir, entry)).href)).default
}

const ctx = (name: string) => ({ name, events: { on: () => () => {}, emit() {}, last() {} }, reportError: vi.fn() }) as unknown as RemoteContext

async function mount(mod: RemoteModule, props: Record<string, unknown>, name = 'x') {
  const el = document.body.appendChild(document.createElement('div'))
  const handle = await mod.mount(el, props, ctx(name))
  await vi.waitFor(() => expect(el.textContent).not.toBe(''))
  return { el, handle }
}

describe('detectAdapter', () => {
  it.each([
    [['vite:react-babel', 'vite:react-refresh'], 'react'],
    [['vite:react-swc'], 'react'],
    [['vite:vue'], 'vue'],
    [['vite-plugin-svelte', 'vite-plugin-svelte:config'], 'svelte'],
    [['solid'], 'solid'],
    [['preact:config', 'vite:preact-jsx', 'prefresh'], 'preact'],
    [['@analogjs/vite-plugin-angular'], 'angular'],
    [['vite:vue-jsx'], 'element'],
    [[], 'element'],
  ])('%j → %s', (names, adapter) => {
    expect(detectAdapter(names.map((name) => ({ name })))).toBe(adapter)
  })
})

describe('entrada virtual', () => {
  it('usa o export como está quando já tem mount', () => {
    expect(entryCode('/a/App.tsx', 'react', 'x')).toContain("typeof c?.mount === 'function' ? c : wrap(c)")
    expect(entryCode('/a/App.tsx', 'react', 'x')).toContain("import { reactRemote as wrap } from 'vitral/react'")
  })

  it('acha src/remote.* ou src/App.*', () => {
    expect(findEntry(root)).toBe('src/App.js')
    expect(findEntry(resolve(root, 'src'))).toBeUndefined()
  })
})

describe('build sem adaptador', () => {
  it('React: export default App vira remote', async () => {
    const mod = await buildRemote({ entry: 'src/react.js' }, [{ name: 'vite:react-babel' }])
    const { el, handle } = await mount(mod, { nome: 'Ana' })
    expect(el.textContent).toBe('oi Ana')
    handle.update?.({ nome: 'Bia' })
    await vi.waitFor(() => expect(el.textContent).toBe('oi Bia'))
    handle.unmount()
  }, 60_000)

  it('Svelte: o componente .svelte direto como entrada', async () => {
    const mod = await buildRemote({ entry: resolve(__dirname, 'fixtures/Card.svelte') }, [svelte()])
    const { el } = await mount(mod, { msg: 'oi' }, 'card')
    expect(el.textContent).toContain('oi (card) cliques=0')
  }, 60_000)

  it('Web Component: registra a tag e passa props como propriedades', async () => {
    const mod = await buildRemote({ entry: 'src/element.js' })
    const { el } = await mount(mod, { nome: 'Ana' })
    expect(el.firstElementChild!.tagName).toBe('ADAPTADOR-REMOTE')
    expect(el.textContent).toBe('oi Ana')
  }, 60_000)

  it('função que devolve html`` vira component()', async () => {
    const mod = await buildRemote({ entry: 'src/funcao.js' })
    const { el } = await mount(mod, { nome: '<b>Ana</b>' })
    expect(el.innerHTML).toBe('<p>oi &lt;b&gt;Ana&lt;/b&gt;</p>')
  }, 60_000)

  it('sem entry, acha src/App.* e usa o objeto com mount como está', async () => {
    const mod = await buildRemote({})
    const { el } = await mount(mod, { nome: 'Ana' })
    expect(el.textContent).toBe('oi Ana')
  }, 60_000)

  it('adapter: false não embrulha', async () => {
    const mod = await buildRemote({ entry: 'src/react.js', adapter: false }, [{ name: 'vite:react-babel' }])
    expect(typeof mod).toBe('function')
  }, 60_000)

  it('adapter força o adaptador', async () => {
    const mod = await buildRemote({ entry: 'src/react.js', adapter: 'react' })
    const { el } = await mount(mod, { nome: 'Ana' })
    expect(el.textContent).toBe('oi Ana')
  }, 60_000)

  it('export que não é remote dá erro claro', () => {
    expect(entryCode('/a/x.js', 'element', 'x')).toContain('o export default não é um remote')
  })
})
