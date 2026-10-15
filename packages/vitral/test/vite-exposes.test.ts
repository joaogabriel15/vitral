import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import vitral from '../src/vite'
import { exposeKeys, loadExposes, resolveExposesId } from '../src/vite-exposes'
import type { RemoteManifest } from '../src/index'

const root = resolve(__dirname, 'fixtures/vite-remote')
const outDir = mkdtempSync(join(tmpdir(), 'vitral-exposes-'))
let manifest: RemoteManifest

beforeAll(async () => {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [vitral({ entry: 'src/remote.js', exposes: { './Mini': 'src/mini.js', api: 'src/api.js' } })],
    build: { outDir, emptyOutDir: true, assetsInlineLimit: 0 },
  })
  manifest = JSON.parse(readFileSync(join(outDir, 'vitral.json'), 'utf8'))
}, 60_000)

afterAll(() => rmSync(outDir, { recursive: true, force: true }))

describe('plugin vite com exposes', () => {
  it('lista as partes no manifesto, com chaves normalizadas', () => {
    expect(manifest.exposes).toEqual(['./Mini', './api'])
    expect(manifest.entry).toMatch(/^remote-[\w-]+\.js$/)
  })

  it('continua um arquivo JS só, coberto pelo integrity', () => {
    expect(readdirSync(outDir).filter((f) => f.endsWith('.js'))).toEqual([manifest.entry])
    const code = readFileSync(join(outDir, manifest.entry))
    expect(manifest.integrity).toBe('sha384-' + createHash('sha384').update(code).digest('base64'))
  })

  it('o arquivo exporta o default e o mapa exposes, com módulos compartilhados', async () => {
    const ns = await import(/* @vite-ignore */ pathToFileURL(join(outDir, manifest.entry)).href)
    expect(typeof ns.default.mount).toBe('function')
    expect(Object.keys(ns.exposes)).toEqual(['./Mini', './api'])
    const api = await ns.exposes['./api']()
    const mini = await ns.exposes['./Mini']()
    api.adicionar()
    api.adicionar()
    const el = { textContent: '', replaceChildren() {} }
    mini.default.mount(el)
    expect(el.textContent).toBe('itens: 2')
  })
})

describe('entrada virtual', () => {
  it('normaliza chaves e recusa chave vazia', () => {
    expect(exposeKeys({ a: 'a.js', './b': 'b.js', '/c': 'c.js' })).toEqual({ './a': 'a.js', './b': 'b.js', './c': 'c.js' })
    expect(() => exposeKeys({ './': 'x.js' })).toThrow(/chave inválida/)
  })

  it('só responde pelo próprio id', () => {
    expect(resolveExposesId('/proj/__vitral_exposes__.js')).toBe('\0vitral-exposes')
    expect(resolveExposesId('C:\\proj\\__vitral_exposes__.js')).toBe('\0vitral-exposes')
    expect(resolveExposesId('/proj/src/main.js')).toBeNull()
    expect(loadExposes('/proj/src/main.js', '/proj', 'src/r.js', {})).toBeNull()
  })

  it('reexporta o remote e gera um import() por parte', () => {
    const code = loadExposes('\0vitral-exposes', '/proj', 'src/r.js', { Mini: 'src/m.js' })!
    const entry = JSON.stringify(resolve('/proj/src/r.js').replace(/\\/g, '/'))
    const mini = JSON.stringify(resolve('/proj/src/m.js').replace(/\\/g, '/'))
    expect(code).toContain(`export { default } from ${entry}`)
    expect(code).toContain(`export * from ${entry}`)
    expect(code).toContain(`"./Mini": () => import(${mini})`)
  })
})
