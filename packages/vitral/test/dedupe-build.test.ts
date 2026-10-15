// Build com dedupe: a cópia própria vira um chunk separado e o remote usa a
// versão oferecida na página quando ela serve. Os arquivos gerados rodam aqui
// mesmo, no Node.
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
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
    expect(m.dedupe).toEqual([{ name: 'react', range: `^${RealReact.version}`, version: RealReact.version, file: expect.stringMatching(/^split\/.*own.*react.*\.js$/), chunks: [] }])
    expect(m.files![m.dedupe![0].file]).toMatch(/^sha384-/)
    // O loader baixa a entrada, o módulo de dependências e o remote juntos; a cópia própria, só se precisar.
    expect(m.split!.chunks).not.toContain(m.dedupe![0].file)
    expect(m.split!.chunks!.length).toBeGreaterThan(0)
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
