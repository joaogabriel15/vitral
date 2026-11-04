// Build com dedupe: a cópia própria vira um chunk separado e o remote usa a
// versão oferecida na página quando ela serve. Os arquivos gerados rodam aqui
// mesmo, no Node.
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import * as RealReact from 'react'
import vitral from '../src/vite'
import { protocol, resetProtocol } from '../src/core/state'
import { shared } from '../src/core/dedupe'
import type { RemoteManifest } from '../src/index'

const out = mkdtempSync(join(tmpdir(), 'vitral-dedupe-'))
let m: RemoteManifest
const read = (f: string) => readFileSync(join(out, f), 'utf8')

beforeAll(async () => {
  await build({
    root: resolve(__dirname, 'fixtures/vite-dedupe'),
    configFile: false,
    logLevel: 'silent',
    // Sem adaptador: o embrulho traria o código da própria lib para o build.
    plugins: [vitral({ entry: 'src/remote.js', adapter: false, dedupe: ['react'] })],
    build: { outDir: out, emptyOutDir: true },
  })
  m = JSON.parse(read('vitral.json'))
}, 60_000)

afterAll(() => rmSync(out, { recursive: true, force: true }))
afterEach(() => resetProtocol())

/** Cada import precisa de uma cópia nova: o Node guarda os módulos por URL. */
let copies = 0
async function importSplit() {
  const dir = join(out, `copia-${copies++}`)
  cpSync(join(out, 'split'), join(dir, 'split'), { recursive: true })
  return (await import(pathToFileURL(join(dir, m.split!.entry)).href)).default
}

const KEYS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react/compiler-runtime']
const fake = (version: string, keys = KEYS) => {
  const react = { version: `falso ${version}`, createContext: (v: unknown) => ({ falso: v }) }
  return { version, load: async () => Object.fromEntries(keys.map((k) => [k, k === 'react' ? { ...react, default: react } : { createRoot() {} }])) }
}

describe('build com dedupe', () => {
  it('manifesto: faixa ^ da versão instalada e a cópia própria num arquivo à parte', () => {
    expect(m.dedupe).toEqual([{ name: 'react', range: `^${RealReact.version}`, version: RealReact.version, file: expect.stringMatching(/^split\/.*own.*react.*\.js$/), chunks: [], uses: expect.any(Object) }])
    // Os nomes que o remote lê de cada especificador: o host pode oferecer só esses.
    expect(m.dedupe![0].uses).toMatchObject({ react: expect.arrayContaining(['createContext']), 'react-dom/client': expect.arrayContaining(['createRoot']), 'react/jsx-runtime': expect.arrayContaining(['jsx']) })
    expect(m.files![m.dedupe![0].file]).toMatch(/^sha384-/)
    // O loader baixa a entrada, o módulo de dependências e o remote juntos; a cópia própria, só se precisar.
    expect(m.split!.chunks).not.toContain(m.dedupe![0].file)
    expect(m.split!.chunks!.length).toBeGreaterThan(0)
    // O contrato leva a faixa, para o host que declara `contract` conferir.
    expect(m.contract).toEqual({ peers: { react: `^${RealReact.version}` } })
  })

  it('ordem de download: a entrada e o que ela importa, depois a cópia própria; o React no caminho crítico', () => {
    const { order = [], critical = [] } = m.split!
    expect(order[0]).toBe(m.split!.entry)
    expect(new Set(order)).toEqual(new Set([m.split!.entry, ...m.split!.chunks!, m.dedupe![0].file]))
    expect(order.indexOf(m.dedupe![0].file)).toBeGreaterThan(0)
    const path = critical.map((i) => order[i])
    expect(path).toContain(m.split!.entry)
    expect(path).toContain(m.dedupe![0].file)
    // `chunks` sai na mesma ordem.
    expect(m.split!.chunks).toEqual(order.filter((f) => m.split!.chunks!.includes(f)))
  })

  it('o React fica só na cópia própria; o remote e a entrada não o carregam', () => {
    expect(read(m.dedupe![0].file)).toContain('react.transitional.element')
    for (const f of [m.split!.entry, ...m.split!.chunks!]) expect(read(f)).not.toContain('react.transitional.element')
    // Os módulos síncronos não têm top-level await (só a entrada tem).
    for (const f of m.split!.chunks!) expect(read(f)).not.toMatch(/^(var|const|let)?[^\n]*\bawait\b/m)
  })

  it('sem oferta na página, o build dividido usa a cópia própria', async () => {
    protocol()
    const remote = await importSplit()
    expect(remote.react.version).toBe(RealReact.version)
    expect(typeof remote.mount).toBe('function')
  })

  it('com uma versão na faixa oferecida, usa a da página', async () => {
    shared(protocol())('react', RealReact.version, fake(RealReact.version))
    const remote = await importSplit()
    expect(remote.react.version).toBe(`falso ${RealReact.version}`)
    expect(remote.tema).toEqual({ falso: 'claro' })
  })

  it('versão fora da faixa ou grupo incompleto: cópia própria', async () => {
    shared(protocol())('react', '18.3.1', fake('18.3.1'))
    expect((await importSplit()).react.version).toBe(RealReact.version)
    resetProtocol()
    shared(protocol())('react', RealReact.version, fake(RealReact.version, ['react', 'react-dom']))
    expect((await importSplit()).react.version).toBe(RealReact.version)
  })

  it('o arquivo único usa sempre a cópia própria', async () => {
    shared(protocol())('react', RealReact.version, fake(RealReact.version))
    const remote = (await import(pathToFileURL(join(out, m.entry)).href)).default
    expect(remote.react.version).toBe(RealReact.version)
    expect(read(m.entry)).toContain('react.transitional.element')
  })
})

describe('build com dedupe e import * as React', () => {
  const ns = mkdtempSync(join(tmpdir(), 'vitral-dedupe-ns-'))
  let n: RemoteManifest

  beforeAll(async () => {
    await build({
      root: resolve(__dirname, 'fixtures/vite-dedupe'),
      configFile: false,
      logLevel: 'silent',
      plugins: [vitral({ entry: 'src/namespace.js', adapter: false, dedupe: ['react'] })],
      build: { outDir: ns, emptyOutDir: true },
    })
    n = JSON.parse(readFileSync(join(ns, 'vitral.json'), 'utf8'))
  }, 60_000)

  afterAll(() => rmSync(ns, { recursive: true, force: true }))

  it('os nomes do manifesto são os do React de produção, mesmo com o de dev carregado no processo', () => {
    // O vitest roda com NODE_ENV=test: aqui o React carregado é o de dev, que exporta `act` e `captureOwnerStack`.
    expect(Object.keys(RealReact)).toContain('captureOwnerStack')
    const uses = n.dedupe![0].uses!.react
    expect(uses).toEqual(expect.arrayContaining(['createElement', 'useState', 'version']))
    expect(uses).not.toContain('act')
    expect(uses).not.toContain('captureOwnerStack')
  })

  it('oferta do host sem um nome que o remote lê: avisa e fica com o React do host', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dir = join(ns, 'copia')
    cpSync(join(ns, 'split'), join(dir, 'split'), { recursive: true })
    const url = pathToFileURL(join(dir, n.split!.entry)).href
    // O host Next com webpackExports: a oferta só tem alguns nomes (falta `useState`).
    protocol().uses = { [url]: { react: n.dedupe![0].uses } }
    shared(protocol())('react', RealReact.version, fake(RealReact.version))
    const remote = (await import(url)).default
    expect(remote.ns.version).toBe(`falso ${RealReact.version}`)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/a oferta de react não tem .*react useState.*oferta do host mesmo assim/))
    warn.mockRestore()
  })
})
